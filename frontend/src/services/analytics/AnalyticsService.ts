import type { Analytics, DateRangeKey } from '@/types'

export interface AnalyticsService {
  getOverview(range?: DateRangeKey): Promise<Analytics>
}
