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
  organization?: string
  inn?: string
  avatarUrl?: string
}

export interface SupplierUser {
  id: string
  name: string
  organization: string
  inn: string
  email: string
  phone?: string
  ticketsCount: number
  lastActivity: string // ISO date
  status: UserStatus
}

export type EmployeeRole = 'EMPLOYEE' | 'SENIOR_EMPLOYEE'
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE'

export interface SupportEmployee {
  id: string
  name: string
  email: string
  role: EmployeeRole
  status: EmployeeStatus
  lastLogin: string // ISO date
  activeTickets: number
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REPLY' | 'RESOLVED' | 'CLOSED'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export type TicketCategory =
  | 'TECHNICAL'
  | 'DOCUMENTS'
  | 'PROCUREMENT'
  | 'ACCOUNT'
  | 'CONTRACT'
  | 'OTHER'

export type MessageAuthorRole = 'USER' | 'AI' | 'SUPPORT'

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
}

export interface Ticket {
  id: string
  number: string // display id, e.g. "#1248"
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  userId: string
  userName: string
  userOrganization: string
  supportId?: string
  supportName?: string
  createdAt: string // ISO date
  updatedAt: string // ISO date
  messages: TicketMessage[]
  aiHelped?: boolean
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
}
