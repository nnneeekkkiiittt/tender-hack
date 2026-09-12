import type { AuthUser, LoginPayload, RegisterPayload, UserRole } from '@/types'

// Contract that both DEMO and API implementations must satisfy.
// Pages/components depend only on this interface — never on localStorage
// or fetch() directly.
export interface AuthService {
  getCurrentUser(): Promise<AuthUser | null>
  login(payload: LoginPayload): Promise<AuthUser>
  loginWithGosuslugi(): Promise<AuthUser>
  register(payload: RegisterPayload): Promise<AuthUser>
  logout(): Promise<void>
  /** DEMO MODE only — real auth never exposes role switching. */
  switchDemoRole?(role: UserRole): Promise<AuthUser>
}
