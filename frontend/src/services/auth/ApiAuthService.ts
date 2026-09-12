import type { AuthService } from './AuthService'
import type { AuthUser, LoginPayload, RegisterPayload } from '@/types'
import { api, type User } from '@/api/contracts'
const adapt = (u: User): AuthUser => ({
  id: u.id,
  name: u.name,
  email: '',
  supportLevel: u.role.startsWith('supportL') ? Number(u.role.slice(-1)) : undefined,
  role: u.role === 'admin' ? 'ADMIN' : u.role === 'user' ? 'USER' : 'SUPPORT',
})
export class ApiAuthService implements AuthService {
  async getCurrentUser() {
    const u = await api<User | null>('/auth/me')
    return u ? adapt(u) : null
  }
  async login(p: LoginPayload) {
    return adapt(
      await api<User>('/auth/login', 'POST', {
        name: p.email,
        password: p.password,
        remember: p.remember,
      }),
    )
  }
  async register(p: RegisterPayload) {
    return adapt(await api<User>('/auth/register', 'POST', { name: p.name, password: p.password }))
  }
  async logout() {
    await api('/auth/logout', 'POST', {})
  }
  async loginWithGosuslugi(): Promise<AuthUser> {
    throw new Error('Вход через Госуслуги недоступен')
  }
}
