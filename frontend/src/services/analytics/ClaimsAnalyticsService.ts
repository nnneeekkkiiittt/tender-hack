import type { ClaimsAnalyticsData } from '@/types'

// Powers /admin/analytics (Операторы+AI / Темы / Эскалации). Deliberately
// separate from AnalyticsService/getOverview above, which still powers the
// unrelated /admin Overview dashboard.
export interface ClaimsAnalyticsService {
  getClaimsAnalytics(operatorId?: number): Promise<ClaimsAnalyticsData>
}
