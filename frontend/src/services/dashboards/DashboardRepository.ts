import type { CreateDashboardPayload, DashboardTemplate } from '@/types'

export interface DashboardRepository {
  list(): Promise<DashboardTemplate[]>
  get(id: string): Promise<DashboardTemplate | null>
  create(payload: CreateDashboardPayload): Promise<DashboardTemplate>
  update(id: string, payload: CreateDashboardPayload): Promise<DashboardTemplate>
  remove(id: string): Promise<void>
  /** Returns a short-lived, signed Metabase embed URL for one widget's
   * question/card. Only meaningful in API mode — throws in demo mode,
   * where widgets are rendered locally instead (see DemoDashboardRepository). */
  getEmbedUrl(dashboardId: string, widgetId: string): Promise<string>
}
