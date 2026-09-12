import type { DashboardRepository } from './DashboardRepository'
import type { CreateDashboardPayload, DashboardTemplate } from '@/types'
import { analyticsApi } from '@/api/analyticsClient'

export class ApiDashboardRepository implements DashboardRepository {
  async list(): Promise<DashboardTemplate[]> {
    return analyticsApi.get<DashboardTemplate[]>('/api/v1/dashboards')
  }

  async get(id: string): Promise<DashboardTemplate | null> {
    try {
      return await analyticsApi.get<DashboardTemplate>(`/api/v1/dashboards/${id}`)
    } catch {
      return null
    }
  }

  async create(payload: CreateDashboardPayload): Promise<DashboardTemplate> {
    return analyticsApi.post<DashboardTemplate>('/api/v1/dashboards', payload)
  }

  async update(id: string, payload: CreateDashboardPayload): Promise<DashboardTemplate> {
    return analyticsApi.put<DashboardTemplate>(`/api/v1/dashboards/${id}`, payload)
  }

  async remove(id: string): Promise<void> {
    await analyticsApi.delete<void>(`/api/v1/dashboards/${id}`)
  }

  async getEmbedUrl(dashboardId: string, widgetId: string): Promise<string> {
    const result = await analyticsApi.get<{ url: string }>(
      `/api/v1/dashboards/${dashboardId}/widgets/${widgetId}/embed-url`,
    )
    return result.url
  }
}
