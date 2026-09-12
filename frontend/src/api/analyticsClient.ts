import { ANALYTICS_API_URL } from '@/config/env'

// Dedicated fetch client for the standalone analytics Go microservice.
// Deliberately NOT the same client as api/contracts.ts `api()`: that one
// expects the main backend's JSON error envelope (`{ detail }`) and
// dispatches a `session-expired` event on 401 — neither applies here. The
// analytics service has no session/auth concept and returns plain-text
// error bodies (net/http.Error), so we parse errors accordingly.

export class AnalyticsApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options: { method?: string; params?: Record<string, unknown>; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', params, body } = options
  const url = new URL(ANALYTICS_API_URL.replace(/\/$/, '') + path)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Network failure / CORS / service down — surface as a clear, typed error
    // rather than an unhandled rejection so callers can show ErrorState.
    throw new AnalyticsApiError(0, 'Сервис аналитики недоступен')
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new AnalyticsApiError(response.status, text.trim() || `Ошибка аналитики (${response.status})`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const analyticsApi = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(path, { params }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
