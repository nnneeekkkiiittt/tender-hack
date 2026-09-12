// ============ Core domain types ============
// These types are the contract between UI and services/repositories.
// Demo and API implementations both produce/consume these shapes.

export type UserRole = 'USER' | 'SUPPORT' | 'ADMIN'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  supportLevel?: number
  organization?: string
  inn?: string
  avatarUrl?: string
}

export interface SupplierUser {
  id: string
  name: string
  organization?: string
  inn?: string
  email?: string
  phone?: string
  ticketsCount?: number
  lastActivity?: string // ISO date
  status?: UserStatus
}

export type EmployeeRole = 'EMPLOYEE' | 'SENIOR_EMPLOYEE' | 'supportL1' | 'supportL2' | 'supportL3'
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE'

export interface SupportEmployee {
  id: string
  name: string
  email: string
  role: EmployeeRole
  status?: EmployeeStatus
  lastLogin?: string // ISO date
  activeTickets?: number
}

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_REPLY'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export type TicketCategory =
  | 'TECHNICAL'
  | 'DOCUMENTS'
  | 'PROCUREMENT'
  | 'ACCOUNT'
  | 'CONTRACT'
  | 'OTHER'

export type MessageAuthorRole = 'USER' | 'AI' | 'SUPPORT' | 'ADMIN' | 'SYSTEM'

export interface MessageAttachment {
  id: string
  name: string
  sizeKb: number
}

export interface TicketMessage {
  id: string
  ticketId: string
  authorId: string
  authorName: string
  authorRole: MessageAuthorRole
  content: string
  createdAt: string // ISO date
  attachments?: MessageAttachment[]
  isAiAnalysis?: boolean
  sources?: string[]
  disliked?: boolean
  liked?: boolean
  reaction?: { like: boolean; reasons: string[] } | null
  mlContext?: import('@/api/contracts').MlContext | null
}

export interface Ticket {
  id: string
  number: string // display id, e.g. "#1248"
  title: string
  description: string
  status: TicketStatus
  priority?: TicketPriority
  category: TicketCategory
  userId: string
  userName: string
  userOrganization?: string
  supportId?: string
  supportName?: string
  createdAt: string // ISO date
  updatedAt: string // ISO date
  messages: TicketMessage[]
  subtopic?: string
  nextBefore?: string | null
  aiHelped?: boolean
  handlingLevel?: number
}

// ============ Analytics ============

export type DateRangeKey = 'today' | '7d' | '30d' | '90d'

/** Direction + magnitude of a period-over-period change. Whether "up" or
 * "down" is good depends on the metric (e.g. backlog down = good, SLA up =
 * good) — that judgement is made where the value is displayed, not here. */
export interface TrendValue {
  value: number // magnitude, always positive (percentage points or %)
  direction: 'up' | 'down'
}

export interface AnalyticsCategoryBreakdown {
  category: TicketCategory
  label: string
  value: number
  percent: number
  /** Share of this category's tickets resolved by AI without escalation, % */
  aiResolutionRate: number
  /** Share escalated to a human agent, % */
  escalationRate: number
  avgResolutionMinutes: number
  /** Rated 0–5, matches how CSAT is shown per-category in the UI */
  csat: number
}

export interface AnalyticsDailyPoint {
  date: string // e.g. "12 авг", or "09:00" for the "today" range
  total: number
  resolved: number
  inProgress: number
}

export interface EmployeeLoad {
  employeeId: string
  employeeName: string
  activeTickets: number
  resolvedThisMonth: number
  avgResponseMinutes: number
}

export interface EmployeePerformance {
  employeeId: string
  employeeName: string
  ticketsHandled: number
  avgResponseTime: string // pre-formatted, e.g. "3:21"
  avgResolutionTime: string // pre-formatted, e.g. "14:32"
  slaRate: number
  csat: number // 0–5
}

export interface BacklogSnapshot {
  active: number
  new: number
  inProgress: number
  waitingReply: number
  overdue: number
}

export interface AgingBucket {
  label: string
  count: number
}

export interface ResolutionTimeStats {
  averageMinutes: number
  medianMinutes: number
  p90Minutes: number
}

export interface SlaCategoryViolation {
  category: TicketCategory
  label: string
  violations: number
}

export interface FunnelStage {
  label: string
  value: number
}

export interface TopQuestion {
  question: string
  count: number
}

export interface KnowledgeGaps {
  totalUnresolved: number
  examples: string[]
}

export interface CsatBreakdown {
  ai: number // %
  support: number // %
}

export interface HourlyLoadPoint {
  hour: string
  value: number
}

export interface WeekdayLoadPoint {
  day: string
  value: number
}

export interface UserAnalyticsData {
  activeUsers: number
  newUsers: number
  returningUsers: number
  avgTicketsPerUser: number
  repeatContactRate: number
  repeatContactTrend: TrendValue
  csat: number // %
  topCategories: { label: string; value: number }[]
  newUsersTrend: { date: string; value: number }[]
}

export interface AnalyticsTrends {
  totalTickets: TrendValue
  aiResolutionRate: TrendValue
  escalationRate: TrendValue
  slaRate: TrendValue
  averageResponseTime: TrendValue
  backlog: TrendValue
}

export interface Analytics {
  rangeLabel: string

  totalUsers: number
  totalUsersDelta: number
  supportEmployeesCount: number
  supportEmployeesDelta: number

  totalTickets: number
  aiResolutionRate: number
  escalationRate: number
  slaRate: number
  trends: AnalyticsTrends

  averageResponseTime: string
  averageResolutionTime: string
  resolutionTimeStats: ResolutionTimeStats

  slaInTime: number
  slaViolated: number
  slaViolationsByCategory: SlaCategoryViolation[]

  backlog: BacklogSnapshot
  agingBacklog: AgingBucket[]

  aiFallbackRate: number
  aiPositiveFeedback: number
  aiNegativeFeedback: number
  repeatContactRate: number
  repeatContactTrend: TrendValue
  funnel: FunnelStage[]
  topQuestions: TopQuestion[]
  knowledgeGaps: KnowledgeGaps

  csat: CsatBreakdown

  categories: AnalyticsCategoryBreakdown[]
  dailyTickets: AnalyticsDailyPoint[]
  employeeLoad: EmployeeLoad[]
  employeePerformance: EmployeePerformance[]
  hourlyLoad: HourlyLoadPoint[]
  weekdayLoad: WeekdayLoadPoint[]

  userAnalytics: UserAnalyticsData
}

export interface KnowledgeArticle {
  id: string
  title: string
  excerpt: string
  category: TicketCategory
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  feedback?: 'helpful' | 'not_helpful'
  sources?: string[]
}

// ============ Auth payloads ============

export interface LoginPayload {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterPayload {
  name: string
  organization: string
  inn: string
  email: string
  password: string
}

// ============ Filters ============

export interface TicketFilters {
  status?: TicketStatus | 'ALL'
  search?: string
  ownerId?: string
  onlyControl?: boolean
  category?: TicketCategory
  unassigned?: boolean
  offset?: number
  limit?: number
}
// ============ Operators+AI / Topics / Escalations analytics ============
// These mirror analytics/internal/models/filters.go response structs
// field-for-field (snake_case, matching the Go JSON tags exactly) so there
// is no risk of a silent mapping mistake. See services/analytics/ for the
// aggregation that turns these into UI-ready view models.

export interface OperatorMetricsResult {
  operator_id: number
  dislike_percentage: number
  avg_response_time_seconds: number
  resolved_self_percentage: number
  top_dislike_reason?: string
}

export interface TopicMetricsResult {
  topic: string
  subtopic: string
  subtopic_share_percentage: number
  avg_resolution_time_hours: number
  ai_resolved_percentage: number
}

export type EscalationAlertLevel = 'WARN' | 'CRIT'

export interface EscalationResult {
  topic: string
  subtopic: string
  current_week: number
  avg_4_weeks: number
  growth_percent: number
  alert_level: EscalationAlertLevel | string
}

/** Minimal subset of analytics/internal/models.User actually used by the frontend. */
export interface AnalyticsUserRecord {
  id: number
  name: string
  role: string
  created_at: string
}

/** Minimal subset of analytics/internal/models.Claim actually used by the frontend. */
export interface AnalyticsClaimRecord {
  id: number
  author_id: number
  title: string
  topic: string
  subtopic?: string | null
  status: string
  operator_id?: number | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
  handling_level: number
}

/** Minimal subset of analytics/internal/models.Reaction actually used by the frontend. */
export interface AnalyticsReactionRecord {
  id: number
  claim_id: number
  operator_id?: number | null
  submitted_by: number
  like: boolean
  reasons?: string[]
  target_kind: 'OPERATOR' | 'AI_MESSAGE' | string
  message_id?: number | null
}

/** One row of the Operators+AI breakdown table — backend metrics plus display name. */
export interface OperatorMetricsRow extends OperatorMetricsResult {
  name: string
  /** Real counts behind the percentages, when known — lets the UI show "—"
   * instead of a misleading "0%" when the backend's COALESCE(...,0) fallback
   * really means "no data" rather than "genuinely zero". Undefined in demo
   * mode / for the single-operator view where they aren't computed. */
  claimsHandled?: number
  reactionsReceived?: number
}

export interface OperatorAggregate {
  dislikePercentage: number | null
  avgResponseTimeSeconds: number | null
  resolvedSelfPercentage: number | null
  topDislikeReason: string | null
}

export interface OperatorAiAnalytics {
  operators: OperatorMetricsRow[]
  /** Weighted by real counts derived from raw claims/reactions — never a naive mean of percentages. */
  aggregate: OperatorAggregate
}

export interface TopicAnalytics {
  topics: TopicMetricsResult[]
  /** True if there were more distinct topic/subtopic pairs than we fetched metrics for. */
  truncated: boolean
  totalTopicsFound: number
}

export interface ClaimsAnalyticsData {
  operatorAi: OperatorAiAnalytics
  topics: TopicAnalytics
  escalations: EscalationResult[]
}

// ============ Custom dashboards ("Мои дашборды") ============
// Configuration only — we never persist query RESULTS, only the query
// definition (metric/dimension/filters/visualization). Re-opening a
// dashboard always re-runs the query (via Metabase in API mode, or against
// live demo data in DEMO mode) so the numbers are never stale.

export type DashboardMetric = 'claims_count' | 'ai_resolved_percentage' | 'escalation_growth'

export type DashboardDimension = 'subtopic' | 'operator' | 'week'

export type DashboardVisualization = 'bar' | 'line' | 'table'

export const DASHBOARD_METRIC_LABEL: Record<DashboardMetric, string> = {
  claims_count: 'Количество обращений',
  ai_resolved_percentage: 'Доля решено AI',
  escalation_growth: 'Рост обращений (%)',
}

export const DASHBOARD_DIMENSION_LABEL: Record<DashboardDimension, string> = {
  subtopic: 'Подтема',
  operator: 'Оператор',
  week: 'Неделя',
}

export interface DashboardWidget {
  id: string
  title: string
  metric: DashboardMetric
  dimension: DashboardDimension
  visualization: DashboardVisualization
  /** Set only in API mode once the backend has created the matching Metabase question/card. */
  metabaseQuestionId?: number | null
  metabaseCardId?: number | null
}

export interface DashboardTemplate {
  id: string
  name: string
  description: string
  ownerId: string
  createdAt: string
  updatedAt: string
  widgets: DashboardWidget[]
  /** Set only in API mode once the backend has created the matching Metabase dashboard. */
  metabaseDashboardId?: number | null
}

export interface CreateDashboardPayload {
  name: string
  description: string
  widgets: Omit<DashboardWidget, 'id' | 'metabaseQuestionId' | 'metabaseCardId'>[]
}
