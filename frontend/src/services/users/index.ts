import { isDemoMode } from '@/config/env'
import type { UserRepository } from './UserRepository'
import { DemoUserRepository } from './DemoUserRepository'
import { ApiUserRepository } from './ApiUserRepository'

export const userRepository: UserRepository = isDemoMode ? new DemoUserRepository() : new ApiUserRepository()
export type { UserRepository } from './UserRepository'
