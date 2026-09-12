import type { ClaimsAnalyticsService } from './ClaimsAnalyticsService'
import type { ClaimsAnalyticsData } from '@/types'
import { getDemoClaimsAnalytics } from '@/mock/claimsAnalytics.mock'

export class DemoClaimsAnalyticsService implements ClaimsAnalyticsService {
  async getClaimsAnalytics(operatorId?: number): Promise<ClaimsAnalyticsData> {
    return getDemoClaimsAnalytics(operatorId)
  }
}
