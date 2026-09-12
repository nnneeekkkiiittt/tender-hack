import { isDemoMode } from '@/config/env'
import type { DashboardRepository } from './DashboardRepository'
import { DemoDashboardRepository } from './DemoDashboardRepository'
import { ApiDashboardRepository } from './ApiDashboardRepository'

export const dashboardRepository: DashboardRepository = isDemoMode
  ? new DemoDashboardRepository()
  : new ApiDashboardRepository()

export type { DashboardRepository } from './DashboardRepository'
