import type { AuthService } from './AuthService'
import type { AuthUser, LoginPayload, RegisterPayload } from '@/types'
import { apiClient } from '@/api/client'

// Placeholder for the real backend integration.
// Swap DemoAuthService -> ApiAuthService in services/auth/index.ts once the
// backend exists — no changes required in pages/components.
export class ApiAuthService implements AuthService {
  async getCurrentUser(): Promise<AuthUser | null> {
    return apiClient.get<AuthUser | null>('/auth/me')
  }

  async login(payload: LoginPayload): Promise<AuthUser> {
    return apiClient.post<AuthUser>('/auth/login', payload)
  }

  async loginWithGosuslugi(): Promise<AuthUser> {
    return apiClient.post<AuthUser>('/auth/gosuslugi', {})
  }

  async register(payload: RegisterPayload): Promise<AuthUser> {
    return apiClient.post<AuthUser>('/auth/register', payload)
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout', {})
  }
}
