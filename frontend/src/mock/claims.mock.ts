import type { ClaimRecord, ClaimResolvedBy, TicketStatus } from '@/types'

// DEMO DATA: a synthetic but internally-consistent raw "claims" dataset
// standing in for a backend claims/messages/reactions feed. Every metric on
// the Analytics page is computed by aggregating THIS data (see
// DemoAnalyticsService) — nothing on that page is a hardcoded percentage.
//
// Generation is deterministic (seeded PRNG) so the numbers — and therefore
// the whole demo (including which topics trigger WARN/CRIT) — stay stable
// across reloads instead of reshuffling on every render.

function mulberry32(seed: number) {
  let s = seed
  return function random() {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20260912)

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function pick<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1))
}

function randomInWindow(start: Date, end: Date): Date {
  return new Date(start.getTime() + rng() * Math.max(0, end.getTime() - start.getTime()))
}

// --- Week windows, anchored to "now" (Monday-start, UTC) ---

function startOfWeekUTC(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date
}

const NOW = new Date()
const CURRENT_WEEK_START = startOfWeekUTC(NOW)

/** weeksAgo = 0 -> current week (partial, up to now); 1 -> most recent full week; etc. */
export function weekWindow(weeksAgo: number): { start: Date; end: Date } {
  const start = new Date(CURRENT_WEEK_START.getTime() - weeksAgo * 7 * 86400000)
  const end = weeksAgo === 0 ? NOW : new Date(start.getTime() + 7 * 86400000)
  return { start, end }
}

// Covers the 90-day filter option with a little headroom.
const WEEKS_OF_HISTORY = 14

interface SubtopicSeed {
  subtopic: string
  baseWeeklyVolume: number
  avgResolutionMinutes: number
  dislikeBaseRate: number // 0..1
  /** Extra multiplier applied ONLY to the current week — this is what creates escalations. */
  currentWeekSpike: number
}

// Two subtopics are deliberately seeded with a current-week spike (one WARN,
// one CRIT) so the escalation widget has something real to show. The rest —
// including a topic with consistently high volume ("Авторизация") — stay
// within normal week-to-week fluctuation, demonstrating that being popular
// alone never triggers an alert.
const SUBTOPIC_SEEDS: SubtopicSeed[] = [
  { subtopic: 'Авторизация', baseWeeklyVolume: 92, avgResolutionMinutes: 8, dislikeBaseRate: 0.10, currentWeekSpike: 1.08 },
  { subtopic: 'Технические проблемы', baseWeeklyVolume: 48, avgResolutionMinutes: 24, dislikeBaseRate: 0.22, currentWeekSpike: 1.67 },
  { subtopic: 'Размещение закупки', baseWeeklyVolume: 34, avgResolutionMinutes: 33, dislikeBaseRate: 0.15, currentWeekSpike: 1.12 },
  { subtopic: 'Ошибка оплаты', baseWeeklyVolume: 24, avgResolutionMinutes: 38, dislikeBaseRate: 0.28, currentWeekSpike: 2.43 },
  { subtopic: 'Документы и требования', baseWeeklyVolume: 52, avgResolutionMinutes: 15, dislikeBaseRate: 0.12, currentWeekSpike: 1.05 },
  { subtopic: 'Электронная подпись', baseWeeklyVolume: 27, avgResolutionMinutes: 12, dislikeBaseRate: 0.14, currentWeekSpike: 0.95 },
  { subtopic: 'Личный кабинет', baseWeeklyVolume: 36, avgResolutionMinutes: 10, dislikeBaseRate: 0.11, currentWeekSpike: 1.02 },
]

const DISLIKE_REASONS: { reason: string; weight: number }[] = [
  { reason: 'Ответ не помог', weight: 45 },
  { reason: 'Неверная информация', weight: 25 },
  { reason: 'Слишком долго ждать', weight: 15 },
  { reason: 'Ответ не по теме', weight: 15 },
]

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

function buildClaim(subtopic: string, createdAt: Date, seed: SubtopicSeed): ClaimRecord {
  const userMsgTime = createdAt
  const messages: ClaimRecord['messages'] = [
    { id: nextId('cmsg'), authorRole: 'USER', createdAt: userMsgTime.toISOString() },
  ]

  const aiReplyTime = new Date(userMsgTime.getTime() + randomInt(15, 45) * 1000)
  const disliked = rng() < seed.dislikeBaseRate
  const aiMessage: ClaimRecord['messages'][number] = {
    id: nextId('cmsg'),
    authorRole: 'AI',
    createdAt: aiReplyTime.toISOString(),
    reaction: disliked ? 'down' : 'up',
  }
  if (disliked) {
    aiMessage.dislikeReason = pickWeighted(
      DISLIKE_REASONS.map((d) => d.reason),
      DISLIKE_REASONS.map((d) => d.weight)
    )
  }
  messages.push(aiMessage)

  let resolvedAt: Date | undefined
  let resolvedBy: ClaimResolvedBy | undefined
  let supportInvolved = false

  if (disliked) {
    // Escalated: an operator follows up some minutes after the AI's answer.
    // The response-time metric measures from the ORIGINAL user message, not
    // from the AI's reply, per the "user -> next operator message" rule.
    supportInvolved = true
    const responseDelayMin = randomInt(2, 18)
    const supportReplyTime = new Date(aiReplyTime.getTime() + responseDelayMin * 60000)
    messages.push({ id: nextId('cmsg'), authorRole: 'SUPPORT', createdAt: supportReplyTime.toISOString() })

    const eventuallyResolved = rng() < 0.82
    if (eventuallyResolved) {
      const resolutionMinutes = Math.max(responseDelayMin + 5, Math.round(seed.avgResolutionMinutes * (0.7 + rng() * 0.8)))
      const candidate = new Date(userMsgTime.getTime() + resolutionMinutes * 60000)
      if (candidate.getTime() <= NOW.getTime()) {
        resolvedAt = candidate
        resolvedBy = 'SUPPORT'
      }
    }
  } else {
    // AI resolved it without operator involvement — effectively immediate.
    const resolutionMinutes = Math.max(1, Math.round(seed.avgResolutionMinutes * 0.25 * (0.6 + rng() * 0.8)))
    const candidate = new Date(userMsgTime.getTime() + resolutionMinutes * 60000)
    if (candidate.getTime() <= NOW.getTime()) {
      resolvedAt = candidate
      resolvedBy = 'AI'
    }
  }

  let status: TicketStatus
  if (resolvedAt) {
    status = rng() < 0.6 ? 'RESOLVED' : 'CLOSED'
  } else if (supportInvolved) {
    status = pick<TicketStatus>(['IN_PROGRESS', 'WAITING_REPLY'])
  } else {
    status = 'OPEN'
  }

  return {
    id: nextId('claim'),
    subtopic,
    createdAt: userMsgTime.toISOString(),
    resolvedAt: resolvedAt?.toISOString(),
    status,
    resolvedBy,
    supportInvolved,
    messages,
  }
}

function generateClaims(): ClaimRecord[] {
  const claims: ClaimRecord[] = []
  for (const seed of SUBTOPIC_SEEDS) {
    for (let w = 0; w < WEEKS_OF_HISTORY; w++) {
      const { start, end } = weekWindow(w)
      const jitter = 0.85 + rng() * 0.3
      const spike = w === 0 ? seed.currentWeekSpike : 1
      const volume = Math.max(0, Math.round(seed.baseWeeklyVolume * jitter * spike))
      for (let i = 0; i < volume; i++) {
        claims.push(buildClaim(seed.subtopic, randomInWindow(start, end), seed))
      }
    }
  }
  return claims
}

export const DEMO_CLAIMS: ClaimRecord[] = generateClaims()
