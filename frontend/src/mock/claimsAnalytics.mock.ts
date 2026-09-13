import type {
  ClaimsAnalyticsData,
  EscalationResult,
  OperatorMetricsRow,
  TopicMetricsResult,
} from '@/types'

// DEMO DATA for /admin/analytics in DEMO MODE. Shaped identically to what
// ApiClaimsAnalyticsService derives from the real backend (OperatorMetricsResult /
// TopicMetricsResult / EscalationResult) so the page never needs to know which
// mode it's in.

const DEMO_OPERATORS: OperatorMetricsRow[] = [
  { operator_id: 1, name: 'Иван Петров', dislike_percentage: 6.4, avg_response_time_seconds: 201, resolved_self_percentage: 78.2, top_dislike_reason: 'SLOW WORK' },
  { operator_id: 2, name: 'Анна Смирнова', dislike_percentage: 9.1, avg_response_time_seconds: 252, resolved_self_percentage: 71.5, top_dislike_reason: 'INCORRECT ANSWER' },
  { operator_id: 3, name: 'Дмитрий Козлов', dislike_percentage: 12.8, avg_response_time_seconds: 301, resolved_self_percentage: 64.9, top_dislike_reason: 'SLOW WORK' },
  { operator_id: 4, name: 'Алексей Новиков', dislike_percentage: 7.7, avg_response_time_seconds: 228, resolved_self_percentage: 74.0, top_dislike_reason: 'IRRELEVANT ANSWER' },
]

// AI is a real row in `users` (id 0) since migration 009-add-ai-row.sql —
// mirrored here for demo/API parity. Intentionally NOT part of
// DEMO_OPERATORS/weightedAggregate — see AI_OPERATOR_ID in
// ApiClaimsAnalyticsService for why it's kept separate.
const DEMO_AI_OPERATOR: OperatorMetricsRow = {
  operator_id: 0,
  name: 'AI',
  dislike_percentage: 11.2,
  avg_response_time_seconds: 14,
  resolved_self_percentage: 69.4,
  top_dislike_reason: 'INCORRECT ANSWER',
}

// Weighted by a plausible claims-handled count per operator — mirrors how
// ApiClaimsAnalyticsService weights the real aggregate (see its comments).
const DEMO_WEIGHTS = [184, 167, 203, 176]

function weightedAggregate(): ClaimsAnalyticsData['operatorAi']['aggregate'] {
  const totalWeight = DEMO_WEIGHTS.reduce((a, b) => a + b, 0)
  const weighted = (pick: (o: OperatorMetricsRow) => number) =>
    DEMO_OPERATORS.reduce((sum, o, i) => sum + pick(o) * DEMO_WEIGHTS[i], 0) / totalWeight

  const reasonCounts = new Map<string, number>()
  DEMO_OPERATORS.forEach((o, i) => {
    if (!o.top_dislike_reason) return
    reasonCounts.set(o.top_dislike_reason, (reasonCounts.get(o.top_dislike_reason) ?? 0) + DEMO_WEIGHTS[i])
  })
  const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    dislikePercentage: weighted((o) => o.dislike_percentage),
    avgResponseTimeSeconds: weighted((o) => o.avg_response_time_seconds),
    resolvedSelfPercentage: weighted((o) => o.resolved_self_percentage),
    topDislikeReason: topReason,
  }
}

const DEMO_TOPICS: TopicMetricsResult[] = [
  { topic: 'Авторизация', subtopic: 'Вход в систему', subtopic_share_percentage: 28.4, avg_resolution_time_hours: 3.2, ai_resolved_percentage: 74 },
  { topic: 'Оплата', subtopic: 'Ошибки платежа', subtopic_share_percentage: 18.2, avg_resolution_time_hours: 1.8, ai_resolved_percentage: 81 },
  { topic: 'Закупки', subtopic: 'Размещение закупки', subtopic_share_percentage: 15.6, avg_resolution_time_hours: 5.4, ai_resolved_percentage: 52 },
  { topic: 'Документы', subtopic: 'Требования к поставщику', subtopic_share_percentage: 13.1, avg_resolution_time_hours: 2.1, ai_resolved_percentage: 69 },
  { topic: 'Технический вопрос', subtopic: 'Не загружается файл', subtopic_share_percentage: 11.7, avg_resolution_time_hours: 4.0, ai_resolved_percentage: 38 },
  { topic: 'Личный кабинет', subtopic: 'Электронная подпись', subtopic_share_percentage: 8.3, avg_resolution_time_hours: 2.6, ai_resolved_percentage: 63 },
  { topic: 'Контракт', subtopic: 'Сроки подписания', subtopic_share_percentage: 4.7, avg_resolution_time_hours: 6.1, ai_resolved_percentage: 45 },
]

const DEMO_ESCALATIONS: EscalationResult[] = [
  { topic: 'Оплата', subtopic: 'Ошибки платежа', current_week: 47, avg_4_weeks: 19.75, growth_percent: 137.9, alert_level: 'CRIT' },
  { topic: 'Технический вопрос', subtopic: 'Не загружается файл', current_week: 34, avg_4_weeks: 21.5, growth_percent: 58.1, alert_level: 'WARN' },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getDemoClaimsAnalytics(operatorId?: number): Promise<ClaimsAnalyticsData> {
  await wait(300)

  if (operatorId === DEMO_AI_OPERATOR.operator_id) {
    return {
      operatorAi: {
        operators: [],
        aggregate: { dislikePercentage: null, avgResponseTimeSeconds: null, resolvedSelfPercentage: null, topDislikeReason: null },
        aiOperator: DEMO_AI_OPERATOR,
      },
      topics: { topics: DEMO_TOPICS, truncated: false, totalTopicsFound: DEMO_TOPICS.length },
      escalations: DEMO_ESCALATIONS,
    }
  }

  if (operatorId) {
    const single = DEMO_OPERATORS.find((o) => o.operator_id === operatorId)
    return {
      operatorAi: {
        operators: single ? [single] : [],
        aggregate: single
          ? {
              dislikePercentage: single.dislike_percentage,
              avgResponseTimeSeconds: single.avg_response_time_seconds,
              resolvedSelfPercentage: single.resolved_self_percentage,
              topDislikeReason: single.top_dislike_reason ?? null,
            }
          : { dislikePercentage: null, avgResponseTimeSeconds: null, resolvedSelfPercentage: null, topDislikeReason: null },
        aiOperator: null,
      },
      topics: { topics: DEMO_TOPICS, truncated: false, totalTopicsFound: DEMO_TOPICS.length },
      escalations: DEMO_ESCALATIONS,
    }
  }

  return {
    operatorAi: { operators: DEMO_OPERATORS, aggregate: weightedAggregate(), aiOperator: DEMO_AI_OPERATOR },
    topics: { topics: DEMO_TOPICS, truncated: false, totalTopicsFound: DEMO_TOPICS.length },
    escalations: DEMO_ESCALATIONS,
  }
}

export const DEMO_OPERATOR_ROSTER = DEMO_OPERATORS.map((o) => ({ id: o.operator_id, name: o.name }))
