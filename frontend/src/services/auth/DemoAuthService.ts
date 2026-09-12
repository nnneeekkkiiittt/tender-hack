import type { AuthService } from './AuthService'
import type { AuthUser, RegisterPayload, UserRole } from '@/types'
import { DEMO_USERS } from '@/mock/auth.mock'
import { demoStorage, DEMO_STORAGE_KEYS } from '@/lib/storage'

const DELAY = 350

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class DemoAuthService implements AuthService {
  async getCurrentUser(): Promise<AuthUser | null> {
    const role = demoStorage.get<UserRole | null>(DEMO_STORAGE_KEYS.currentRole, null)
    if (!role) return null
    return DEMO_USERS[role]
  }

  async login(): Promise<AuthUser> {
    await wait(DELAY)
    // In demo mode, any credentials land the visitor on the demo role selector.
    // We default to the USER role so the primary flow (ask → ticket) is reachable immediately.
    demoStorage.set(DEMO_STORAGE_KEYS.currentRole, 'USER')
    return DEMO_USERS.USER
  }

  async loginWithGosuslugi(): Promise<AuthUser> {
    await wait(DELAY)
    demoStorage.set(DEMO_STORAGE_KEYS.currentRole, 'USER')
    return DEMO_USERS.USER
  }

  async register(payload: RegisterPayload): Promise<AuthUser> {
    await wait(DELAY)
    const user: AuthUser = {
      id: 'user_' + Math.random().toString(36).slice(2, 8),
      name: payload.name,
      email: payload.email,
      role: 'USER',
      organization: payload.organization,
      inn: payload.inn,
    }
    demoStorage.set(DEMO_STORAGE_KEYS.currentRole, 'USER')
    return user
  }

  async logout(): Promise<void> {
    demoStorage.remove(DEMO_STORAGE_KEYS.currentRole)
  }

  async switchDemoRole(role: UserRole): Promise<AuthUser> {
    await wait(150)
    demoStorage.set(DEMO_STORAGE_KEYS.currentRole, role)
    return DEMO_USERS[role]
  }
}
