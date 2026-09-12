import { api } from './contracts'
export const apiClient = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    api<T>(path, 'GET', undefined, params),
  post: <T>(path: string, body: unknown) => api<T>(path, 'POST', body),
  patch: <T>(path: string, body: unknown) => api<T>(path, 'PATCH', body),
  put: <T>(path: string, body: unknown) => api<T>(path, 'PUT', body),
  delete: <T>(path: string) => api<T>(path, 'DELETE'),
}
