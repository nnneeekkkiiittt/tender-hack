import { API_URL } from '@/config/env'

// Minimal fetch wrapper used only by API-mode service implementations.
// Not used at all while VITE_APP_MODE=demo.
async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(API_URL + path)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const response = await fetch(url.toString(), {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || `Request failed: ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
