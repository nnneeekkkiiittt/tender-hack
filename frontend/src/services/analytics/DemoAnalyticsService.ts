import type { AnalyticsService } from './AnalyticsService'
import type { Analytics, DateRangeKey } from '@/types'
import { ANALYTICS_BY_RANGE } from '@/mock/analytics.mock'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class DemoAnalyticsService implements AnalyticsService {
  async getOverview(range: DateRangeKey = '30d'): Promise<Analytics> {
    await wait(300)
    return ANALYTICS_BY_RANGE[range]
  }
}
