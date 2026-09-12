import { isDemoMode } from '@/config/env'
import type { AnalyticsService } from './AnalyticsService'
import { DemoAnalyticsService } from './DemoAnalyticsService'
import { ApiAnalyticsService } from './ApiAnalyticsService'

export const analyticsService: AnalyticsService = isDemoMode
  ? new DemoAnalyticsService()
  : new ApiAnalyticsService()

export type { AnalyticsService } from './AnalyticsService'
