import type { AnalyticsService } from './AnalyticsService'
import type { Analytics, DateRangeKey } from '@/types'
import { apiClient } from '@/api/client'

export class ApiAnalyticsService implements AnalyticsService {
  async getOverview(range: DateRangeKey = '30d'): Promise<Analytics> {
    return apiClient.get<Analytics>('/analytics/overview', { range })
  }
}
