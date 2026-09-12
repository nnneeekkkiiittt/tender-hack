import { isDemoMode } from '@/config/env'
import type { AuthService } from './AuthService'
import { DemoAuthService } from './DemoAuthService'
import { ApiAuthService } from './ApiAuthService'

export const authService: AuthService = isDemoMode ? new DemoAuthService() : new ApiAuthService()
export type { AuthService } from './AuthService'
