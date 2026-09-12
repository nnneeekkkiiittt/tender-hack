import { isDemoMode } from '@/config/env'
import type { UserRepository } from './UserRepository'
import { DemoUserRepository } from './DemoUserRepository'
import { ApiUserRepository } from './ApiUserRepository'

export const userRepository: UserRepository = isDemoMode
  ? new DemoUserRepository()
  : new ApiUserRepository()
export type { UserRepository } from './UserRepository'

import type { Page } from '@/api/contracts'
import type { SupplierUser } from '@/types'
export async function listUsers(
  search = '',
  offset = 0,
): Promise<Page<Pick<SupplierUser, 'id' | 'name'> & Partial<SupplierUser>>> {
  if (!isDemoMode) return new ApiUserRepository().listPage(search, offset)
  const items = await userRepository.list(search)
  return { items: items.slice(offset, offset + 20), total: items.length, offset, limit: 20 }
}
