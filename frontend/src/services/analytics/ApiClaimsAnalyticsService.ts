import type { ClaimsAnalyticsService } from './ClaimsAnalyticsService'
import { analyticsApi } from '@/api/analyticsClient'
import { mapWithConcurrency } from './concurrency'
import type {
  AnalyticsClaimRecord,
  AnalyticsReactionRecord,
  AnalyticsUserRecord,
  ClaimsAnalyticsData,
  EscalationResult,
  OperatorMetricsResult,
  OperatorMetricsRow,
  TopicAnalytics,
  TopicMetricsResult,
} from '@/types'

// "Operators" = support agents in the L1/L2/L3 queue (see the Claim model's
// handling_level and the README's AI -> L1 -> L2 -> L3 escalation chain).
// Admins are not part of that chain and are excluded.
const OPERATOR_ROLES = ['supportL1', 'supportL2', 'supportL3']

// AI is a real row in `users` — id 0, role 'supportL1' (migration
// 009-add-ai-row.sql) — so it comes back from
// /analytics/users?roles=supportL1,... like any human operator. It is kept
// OUT of the human roster/weighted aggregate below (most claims start with
// AI, so it would dominate by volume) and surfaced separately as `aiOperator`.
const AI_OPERATOR_ID = 0

// The raw /analytics/claims and /analytics/reactions endpoints have no
// aggregate/count variant and no explicit server-side max on `limit` — this
// is a pragmatic single-page fetch used only to derive weighting counts and
// to discover topic/subtopic pairs. If the real dataset ever exceeds this,
// the weighted aggregate and topic discovery would under-count; documented
// here rather than silently wrong.
const RAW_FETCH_LIMIT = 2000
const OPERATOR_ROSTER_LIMIT = 200

const OPERATOR_CONCURRENCY = 5
const TOPIC_CONCURRENCY = 5
// Avoid firing one request per topic/subtopic pair unboundedly — only fetch
// metrics for the most frequent pairs. See getTopics().
const MAX_TOPICS = 25

// Go's `var result []T; return result, nil` (used throughout dm.go) marshals
// to JSON `null` when there are zero rows, not `[]`. Every raw-array fetch
// below goes through this so a `for...of`/`.map()` never throws on `null`.
function orEmpty<T>(value: T[] | null | undefined): T[] {
  return value ?? []
}

async function fetchOperatorRoster(): Promise<AnalyticsUserRecord[]> {
  const result = await analyticsApi.get<AnalyticsUserRecord[] | null>('/api/v1/analytics/users', {
    roles: OPERATOR_ROLES.join(','),
    limit: OPERATOR_ROSTER_LIMIT,
  })
  return orEmpty(result)
}

async function fetchOperatorMetrics(operatorId: number): Promise<OperatorMetricsResult> {
  return analyticsApi.get<OperatorMetricsResult>('/api/v1/metrics/operator', { operator_id: operatorId })
}

async function fetchClaimsForOperators(operatorIds: number[]): Promise<AnalyticsClaimRecord[]> {
  if (operatorIds.length === 0) return []
  const result = await analyticsApi.get<AnalyticsClaimRecord[] | null>('/api/v1/analytics/claims', {
    operator_ids: operatorIds.join(','),
    limit: RAW_FETCH_LIMIT,
  })
  return orEmpty(result)
}

async function fetchOperatorReactions(operatorIds: number[]): Promise<AnalyticsReactionRecord[]> {
  if (operatorIds.length === 0) return []
  const result = await analyticsApi.get<AnalyticsReactionRecord[] | null>('/api/v1/analytics/reactions', {
    operator_ids: operatorIds.join(','),
    target_kinds: 'OPERATOR',
    limit: RAW_FETCH_LIMIT,
  })
  return orEmpty(result)
}

async function fetchAllClaimsForTopics(): Promise<AnalyticsClaimRecord[]> {
  const result = await analyticsApi.get<AnalyticsClaimRecord[] | null>('/api/v1/analytics/claims', { limit: RAW_FETCH_LIMIT })
  return orEmpty(result)
}

async function fetchTopicMetrics(topic: string, subtopic: string): Promise<TopicMetricsResult> {
  return analyticsApi.get<TopicMetricsResult>('/api/v1/metrics/topic', { topic, subtopic })
}

async function fetchEscalations(): Promise<EscalationResult[]> {
  const result = await analyticsApi.get<EscalationResult[] | null>('/api/v1/metrics/escalations', { threshold: 20 })
  return orEmpty(result)
}

function sortEscalations(items: EscalationResult[]): EscalationResult[] {
  // Purely a display order. The growth-percent MATH and the WARN/CRIT
  // threshold are entirely computed by the backend (dm.go GetEscalations) —
  // this never recomputes or duplicates that formula.
  return [...items].sort((a, b) => {
    if (a.alert_level !== b.alert_level) return a.alert_level === 'CRIT' ? -1 : 1
    return b.growth_percent - a.growth_percent
  })
}

export class ApiClaimsAnalyticsService implements ClaimsAnalyticsService {
  async getClaimsAnalytics(operatorId?: number): Promise<ClaimsAnalyticsData> {
    // operatorId can legitimately be 0 (AI) — `if (operatorId)` would treat
    // that as falsy and silently fall through to the "all operators" branch.
    if (operatorId !== undefined) {
      const [roster, metrics, escalations, topics] = await Promise.all([
        fetchOperatorRoster(),
        fetchOperatorMetrics(operatorId),
        fetchEscalations(),
        this.getTopics(),
      ])
      const name = roster.find((u) => u.id === operatorId)?.name ?? `Оператор #${operatorId}`
      const row: OperatorMetricsRow = { ...metrics, name }
      const isAi = operatorId === AI_OPERATOR_ID

      return {
        operatorAi: {
          operators: isAi ? [] : [row],
          aggregate: isAi
            ? { dislikePercentage: null, avgResponseTimeSeconds: null, resolvedSelfPercentage: null, topDislikeReason: null }
            : {
                dislikePercentage: metrics.dislike_percentage,
                avgResponseTimeSeconds: metrics.avg_response_time_seconds,
                resolvedSelfPercentage: metrics.resolved_self_percentage,
                topDislikeReason: metrics.top_dislike_reason ?? null,
              },
          aiOperator: isAi ? row : null,
        },
        topics,
        escalations: sortEscalations(escalations),
      }
    }

    const fullRoster = await fetchOperatorRoster()
    const roster = fullRoster.filter((u) => u.id !== AI_OPERATOR_ID)
    const aiUser = fullRoster.find((u) => u.id === AI_OPERATOR_ID) ?? null
    const operatorIds = roster.map((u) => u.id)

    const [metricsList, claims, reactions, topics, escalations, aiMetrics] = await Promise.all([
      mapWithConcurrency(operatorIds, OPERATOR_CONCURRENCY, (id) => fetchOperatorMetrics(id)),
      fetchClaimsForOperators(operatorIds),
      fetchOperatorReactions(operatorIds),
      this.getTopics(),
      fetchEscalations(),
      aiUser ? fetchOperatorMetrics(AI_OPERATOR_ID) : Promise.resolve(null),
    ])

    const nameById = new Map(roster.map((u) => [u.id, u.name]))
    const claimsCountByOperator = new Map<number, number>()
    for (const claim of claims) {
      if (claim.operator_id == null) continue
      claimsCountByOperator.set(claim.operator_id, (claimsCountByOperator.get(claim.operator_id) ?? 0) + 1)
    }
    const reactionsCountByOperator = new Map<number, number>()
    for (const reaction of reactions) {
      if (reaction.operator_id == null) continue
      reactionsCountByOperator.set(reaction.operator_id, (reactionsCountByOperator.get(reaction.operator_id) ?? 0) + 1)
    }

    const operators: OperatorMetricsRow[] = metricsList.map((m) => ({
      ...m,
      name: nameById.get(m.operator_id) ?? `Оператор #${m.operator_id}`,
      claimsHandled: claimsCountByOperator.get(m.operator_id) ?? 0,
      reactionsReceived: reactionsCountByOperator.get(m.operator_id) ?? 0,
    }))

    return {
      operatorAi: {
        operators,
        aggregate: computeWeightedAggregate(operators, claims, reactions),
        aiOperator: aiMetrics && aiUser ? { ...aiMetrics, name: aiUser.name } : null,
      },
      topics,
      escalations: sortEscalations(escalations),
    }
  }

  private async getTopics(): Promise<TopicAnalytics> {
    // /metrics/topic requires both topic AND subtopic, and there is no
    // "list all topics" endpoint — so distinct pairs are discovered from the
    // raw claims feed first (per the task's explicit instruction #9).
    const claims = await fetchAllClaimsForTopics()
    const pairCounts = new Map<string, { topic: string; subtopic: string; count: number }>()
    for (const claim of claims) {
      if (!claim.subtopic) continue
      const key = `${claim.topic}\u0000${claim.subtopic}`
      const existing = pairCounts.get(key)
      if (existing) existing.count += 1
      else pairCounts.set(key, { topic: claim.topic, subtopic: claim.subtopic, count: 1 })
    }

    const pairs = [...pairCounts.values()].sort((a, b) => b.count - a.count)
    const truncated = pairs.length > MAX_TOPICS
    const selected = pairs.slice(0, MAX_TOPICS)

    const topics = await mapWithConcurrency(selected, TOPIC_CONCURRENCY, (pair) =>
      fetchTopicMetrics(pair.topic, pair.subtopic),
    )

    return { topics, truncated, totalTopicsFound: pairs.length }
  }
}

// Weighted by REAL counts derived from raw claims/reactions — never a naive
// mean of operator percentages, since operators handle very different
// volumes (see the task's explicit "не придумывать denominator" rule):
//
//  - resolved_self_percentage is weighted by claims assigned to the operator
//    — the exact denominator the backend's own SQL uses
//    (COUNT(*) claims WHERE operator_id = X).
//  - dislike_percentage is weighted by reactions targeting the operator
//    (target_kind='OPERATOR'), again matching the backend's own denominator.
//  - avg_response_time_seconds has no exposed sample-count from the backend
//    (it comes from a LAG() window over messages, not a simple count); claims
//    handled is used as the closest available proxy weight. This is an
//    approximation, documented here rather than hidden.
function computeWeightedAggregate(
  operators: OperatorMetricsRow[],
  claims: { operator_id?: number | null }[],
  reactions: { operator_id?: number | null; like: boolean; reasons?: string[] }[],
) {
  const claimsCountByOperator = new Map<number, number>()
  for (const claim of claims) {
    if (claim.operator_id == null) continue
    claimsCountByOperator.set(claim.operator_id, (claimsCountByOperator.get(claim.operator_id) ?? 0) + 1)
  }

  const reactionsCountByOperator = new Map<number, number>()
  for (const reaction of reactions) {
    if (reaction.operator_id == null) continue
    reactionsCountByOperator.set(reaction.operator_id, (reactionsCountByOperator.get(reaction.operator_id) ?? 0) + 1)
  }

  const weightedMean = (weightMap: Map<number, number>, pick: (o: OperatorMetricsRow) => number): number | null => {
    let weightedSum = 0
    let totalWeight = 0
    for (const operator of operators) {
      const weight = weightMap.get(operator.operator_id) ?? 0
      weightedSum += pick(operator) * weight
      totalWeight += weight
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null
  }

  const reasonCounts = new Map<string, number>()
  for (const reaction of reactions) {
    if (reaction.like) continue
    for (const reason of reaction.reasons ?? []) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
    }
  }
  const topDislikeReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    dislikePercentage: weightedMean(reactionsCountByOperator, (o) => o.dislike_percentage),
    avgResponseTimeSeconds: weightedMean(claimsCountByOperator, (o) => o.avg_response_time_seconds),
    resolvedSelfPercentage: weightedMean(claimsCountByOperator, (o) => o.resolved_self_percentage),
    topDislikeReason,
  }
}
