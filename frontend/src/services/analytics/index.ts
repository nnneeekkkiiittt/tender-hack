import { isDemoMode } from '@/config/env'
import type { AnalyticsService } from './AnalyticsService'
import { DemoAnalyticsService } from './DemoAnalyticsService'
import { ApiAnalyticsService } from './ApiAnalyticsService'
import type { ClaimsAnalyticsService } from './ClaimsAnalyticsService'
import { DemoClaimsAnalyticsService } from './DemoClaimsAnalyticsService'
import { ApiClaimsAnalyticsService } from './ApiClaimsAnalyticsService'

export const analyticsService: AnalyticsService = isDemoMode
  ? new DemoAnalyticsService()
  : new ApiAnalyticsService()

export const claimsAnalyticsService: ClaimsAnalyticsService = isDemoMode
  ? new DemoClaimsAnalyticsService()
  : new ApiClaimsAnalyticsService()

export type { AnalyticsService } from './AnalyticsService'
export type { ClaimsAnalyticsService } from './ClaimsAnalyticsService'
