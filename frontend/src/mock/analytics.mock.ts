import type {
  Analytics,
  AnalyticsCategoryBreakdown,
  AnalyticsDailyPoint,
  DateRangeKey,
  EmployeeLoad,
  EmployeePerformance,
  TrendValue,
} from '@/types'

// All numbers on this file are DEMO DATA. Every range below is derived from
// one canonical (30-day) dataset by a scale factor, so the shape stays
// internally consistent while still feeling different per period. When a
// real backend exists, ApiAnalyticsService.getOverview(range) replaces this
// file entirely — no page needs to change.

const RANGE_FACTOR: Record<DateRangeKey, number> = {
  today: 0.045,
  '7d': 0.24,
  '30d': 1,
  '90d': 2.85,
}

const RANGE_LABEL: Record<DateRangeKey, string> = {
  today: 'сегодня',
  '7d': 'последние 7 дней',
  '30d': 'последние 30 дней',
  '90d': 'последние 90 дней',
}

// Small deterministic (non-random) rate nudges so percentages aren't
// identical across every range, without needing per-range hand-written data.
const RATE_NUDGE: Record<DateRangeKey, number> = {
  today: -3,
  '7d': -1,
  '30d': 0,
  '90d': 2,
}

function scaleCount(base: number, range: DateRangeKey): number {
  return Math.max(0, Math.round(base * RANGE_FACTOR[range]))
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function trend(value: number, direction: TrendValue['direction']): TrendValue {
  return { value, direction }
}

function buildDailyTickets(range: DateRangeKey): AnalyticsDailyPoint[] {
  if (range === 'today') {
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    const shape = [8, 14, 19, 22, 17, 15, 20, 24, 21, 13, 7]
    return hours.map((h, i) => ({
      date: h,
      total: shape[i],
      resolved: Math.round(shape[i] * 0.74),
      inProgress: Math.round(shape[i] * 0.26),
    }))
  }
  if (range === '7d') {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    const shape = [148, 162, 171, 158, 176, 96, 74]
    return days.map((d, i) => ({
      date: d,
      total: shape[i],
      resolved: Math.round(shape[i] * 0.76),
      inProgress: Math.round(shape[i] * 0.24),
    }))
  }
  if (range === '90d') {
    const weeks = ['Нед. 1', 'Нед. 2', 'Нед. 3', 'Нед. 4', 'Нед. 5', 'Нед. 6', 'Нед. 7', 'Нед. 8', 'Нед. 9', 'Нед. 10', 'Нед. 11', 'Нед. 12']
    const shape = [880, 910, 940, 905, 980, 1010, 1040, 1005, 1070, 1110, 1145, 1180]
    return weeks.map((w, i) => ({
      date: w,
      total: shape[i],
      resolved: Math.round(shape[i] * 0.77),
      inProgress: Math.round(shape[i] * 0.23),
    }))
  }
  // 30d (canonical)
  const days = ['12 авг', '16 авг', '20 авг', '24 авг', '28 авг', '1 сен', '5 сен', '9 сен']
  const shape = [132, 148, 121, 165, 158, 172, 181, 176]
  return days.map((d, i) => ({
    date: d,
    total: shape[i],
    resolved: Math.round(shape[i] * 0.775),
    inProgress: shape[i] - Math.round(shape[i] * 0.775),
  }))
}

interface CategorySeed {
  category: AnalyticsCategoryBreakdown['category']
  label: string
  percent: number
  aiResolutionRate: number
  avgResolutionMinutes: number
  csat: number
}

const CATEGORY_SEEDS: CategorySeed[] = [
  { category: 'TECHNICAL', label: 'Технические вопросы', percent: 34, aiResolutionRate: 61, avgResolutionMinutes: 22, csat: 4.3 },
  { category: 'DOCUMENTS', label: 'Документы и требования', percent: 27, aiResolutionRate: 78, avgResolutionMinutes: 11, csat: 4.6 },
  { category: 'PROCUREMENT', label: 'Участие в закупке', percent: 18, aiResolutionRate: 69, avgResolutionMinutes: 15, csat: 4.5 },
  { category: 'ACCOUNT', label: 'Личный кабинет', percent: 12, aiResolutionRate: 82, avgResolutionMinutes: 8, csat: 4.7 },
  { category: 'OTHER', label: 'Прочее', percent: 9, aiResolutionRate: 74, avgResolutionMinutes: 13, csat: 4.4 },
]

function buildCategories(range: DateRangeKey, totalTickets: number): AnalyticsCategoryBreakdown[] {
  return CATEGORY_SEEDS.map((seed) => ({
    category: seed.category,
    label: seed.label,
    percent: seed.percent,
    value: Math.round((totalTickets * seed.percent) / 100),
    aiResolutionRate: clampPercent(seed.aiResolutionRate + RATE_NUDGE[range] / 2),
    escalationRate: clampPercent(100 - (seed.aiResolutionRate + RATE_NUDGE[range] / 2)),
    avgResolutionMinutes: seed.avgResolutionMinutes,
    csat: seed.csat,
  }))
}

const EMPLOYEE_SEEDS = [
  { employeeId: 'support_petrov', employeeName: 'Иван Петров', tickets: 184, avgResponseTime: '3:21', avgResolutionTime: '14:32', slaRate: 98, csat: 4.8, avgResponseMinutes: 3 },
  { employeeId: 'support_smirnova', employeeName: 'Анна Смирнова', tickets: 167, avgResponseTime: '4:12', avgResolutionTime: '17:04', slaRate: 96, csat: 4.6, avgResponseMinutes: 4 },
  { employeeId: 'support_kozlov', employeeName: 'Дмитрий Козлов', tickets: 203, avgResponseTime: '5:01', avgResolutionTime: '19:41', slaRate: 91, csat: 4.3, avgResponseMinutes: 5 },
  { employeeId: 'support_novikov', employeeName: 'Алексей Новиков', tickets: 176, avgResponseTime: '3:48', avgResolutionTime: '15:57', slaRate: 95, csat: 4.5, avgResponseMinutes: 4 },
]

function buildEmployeePerformance(range: DateRangeKey): EmployeePerformance[] {
  return EMPLOYEE_SEEDS.map((e) => ({
    employeeId: e.employeeId,
    employeeName: e.employeeName,
    ticketsHandled: scaleCount(e.tickets, range),
    avgResponseTime: e.avgResponseTime,
    avgResolutionTime: e.avgResolutionTime,
    slaRate: clampPercent(e.slaRate + RATE_NUDGE[range] / 2),
    csat: e.csat,
  }))
}

function buildEmployeeLoad(range: DateRangeKey): EmployeeLoad[] {
  return EMPLOYEE_SEEDS.map((e) => ({
    employeeId: e.employeeId,
    employeeName: e.employeeName,
    activeTickets: Math.max(1, Math.round(e.tickets / 30)),
    resolvedThisMonth: scaleCount(e.tickets, range),
    avgResponseMinutes: e.avgResponseMinutes,
  }))
}

function buildHourlyLoad(): { hour: string; value: number }[] {
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
  const shape = [38, 64, 92, 108, 84, 71, 96, 115, 101, 68, 34]
  return hours.map((hour, i) => ({ hour, value: shape[i] }))
}

function buildWeekdayLoad(): { day: string; value: number }[] {
  return [
    { day: 'Понедельник', value: 780 },
    { day: 'Вторник', value: 845 },
    { day: 'Среда', value: 910 },
    { day: 'Четверг', value: 860 },
    { day: 'Пятница', value: 720 },
  ]
}

function buildAnalyticsForRange(range: DateRangeKey): Analytics {
  const totalTickets = scaleCount(4291, range)
  const aiResolutionRate = clampPercent(71 + RATE_NUDGE[range])
  const escalationRate = clampPercent(100 - aiResolutionRate)
  const slaRate = clampPercent(96 + RATE_NUDGE[range] / 3)
  const slaViolated = Math.max(0, Math.round((totalTickets * (100 - slaRate)) / 100))
  const slaInTime = totalTickets - slaViolated

  return {
    rangeLabel: RANGE_LABEL[range],

    totalUsers: 12481,
    totalUsersDelta: 12,
    supportEmployeesCount: 24,
    supportEmployeesDelta: 3,

    totalTickets,
    aiResolutionRate,
    escalationRate,
    slaRate,
    trends: {
      totalTickets: trend(range === '90d' ? 11 : range === '30d' ? 8 : range === '7d' ? 6 : 5, 'up'),
      aiResolutionRate: trend(5, 'up'),
      escalationRate: trend(5, 'down'),
      slaRate: trend(2, 'up'),
      averageResponseTime: trend(18, 'down'),
      backlog: trend(7, 'down'),
    },

    averageResponseTime: '4 мин',
    averageResolutionTime: '2 ч 15 мин',
    resolutionTimeStats: { averageMinutes: 135, medianMinutes: 48, p90Minutes: 310 },

    slaInTime,
    slaViolated,
    slaViolationsByCategory: [
      { category: 'TECHNICAL', label: 'Технические вопросы', violations: Math.round(slaViolated * 0.35) },
      { category: 'DOCUMENTS', label: 'Документы и требования', violations: Math.round(slaViolated * 0.26) },
      { category: 'PROCUREMENT', label: 'Участие в закупке', violations: Math.round(slaViolated * 0.18) },
      { category: 'ACCOUNT', label: 'Личный кабинет', violations: Math.round(slaViolated * 0.12) },
      { category: 'OTHER', label: 'Прочее', violations: Math.round(slaViolated * 0.09) },
    ],

    backlog: {
      active: scaleCount(384, range),
      new: scaleCount(82, range),
      inProgress: scaleCount(147, range),
      waitingReply: scaleCount(103, range),
      overdue: scaleCount(52, range),
    },
    agingBacklog: [
      { label: '< 1 часа', count: scaleCount(82, range) },
      { label: '1–4 часа', count: scaleCount(91, range) },
      { label: '4–24 часа', count: scaleCount(67, range) },
      { label: '1–3 дня', count: scaleCount(31, range) },
      { label: '> 3 дней', count: scaleCount(13, range) },
    ],

    aiFallbackRate: clampPercent(8 - RATE_NUDGE[range] / 2),
    aiPositiveFeedback: clampPercent(87 + RATE_NUDGE[range] / 2),
    aiNegativeFeedback: clampPercent(13 - RATE_NUDGE[range] / 2),
    repeatContactRate: Math.max(0, +(14.2 - RATE_NUDGE[range] / 2).toFixed(1)),
    repeatContactTrend: trend(3.1, 'down'),
    funnel: [
      { label: 'Все обращения', value: totalTickets },
      { label: 'AI обработал', value: totalTickets },
      { label: 'AI решил', value: scaleCount(3047, range) },
      { label: 'Передано сотруднику', value: totalTickets - scaleCount(3047, range) },
      { label: 'Саппорт решил', value: scaleCount(1162, range) },
      { label: 'Повторно открыты', value: scaleCount(82, range) },
    ],
    topQuestions: [
      { question: 'Как подать заявку?', count: scaleCount(482, range) },
      { question: 'Почему не загружается файл?', count: scaleCount(391, range) },
      { question: 'Как получить ЭЦП?', count: scaleCount(284, range) },
      { question: 'Где найти закупку?', count: scaleCount(241, range) },
      { question: 'Как изменить данные?', count: scaleCount(198, range) },
    ],
    knowledgeGaps: {
      totalUnresolved: scaleCount(143, range),
      examples: [
        'Как исправить ошибку X?',
        'Можно ли изменить данные после подачи?',
        'Что делать, если документ не загружается?',
      ],
    },

    csat: { ai: clampPercent(87 + RATE_NUDGE[range] / 2), support: clampPercent(94 + RATE_NUDGE[range] / 3) },

    categories: buildCategories(range, totalTickets),
    dailyTickets: buildDailyTickets(range),
    employeeLoad: buildEmployeeLoad(range),
    employeePerformance: buildEmployeePerformance(range),
    hourlyLoad: buildHourlyLoad(),
    weekdayLoad: buildWeekdayLoad(),

    userAnalytics: {
      activeUsers: scaleCount(3210, range),
      newUsers: scaleCount(412, range),
      returningUsers: scaleCount(2798, range),
      avgTicketsPerUser: +(1.34 + RATE_NUDGE[range] / 100).toFixed(2),
      repeatContactRate: Math.max(0, +(14.2 - RATE_NUDGE[range] / 2).toFixed(1)),
      repeatContactTrend: trend(3.1, 'down'),
      csat: clampPercent(90 + RATE_NUDGE[range] / 3),
      topCategories: CATEGORY_SEEDS.slice(0, 3).map((c) => ({ label: c.label, value: Math.round((totalTickets * c.percent) / 100) })),
      newUsersTrend: buildDailyTickets(range).map((d) => ({ date: d.date, value: Math.round(d.total * 0.18) })),
    },
  }
}

export const ANALYTICS_BY_RANGE: Record<DateRangeKey, Analytics> = {
  today: buildAnalyticsForRange('today'),
  '7d': buildAnalyticsForRange('7d'),
  '30d': buildAnalyticsForRange('30d'),
  '90d': buildAnalyticsForRange('90d'),
}

// Kept for any code that still wants a default snapshot without specifying
// a range (equivalent to the 30-day view).
export const ANALYTICS_DATA: Analytics = ANALYTICS_BY_RANGE['30d']
