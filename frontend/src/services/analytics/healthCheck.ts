import { analyticsApi } from '@/api/analyticsClient'

// A dedicated, explicit health check — called once per page visit (via a
// long react-query staleTime), never on every render. See AdminAnalyticsPage.
export async function checkAnalyticsHealth(): Promise<boolean> {
  try {
    await analyticsApi.get<void>('/api/v1/analytics/health-check')
    return true
  } catch {
    return false
  }
}
