import type { UserRepository } from './UserRepository'
import type { SupplierUser } from '@/types'
import { apiClient } from '@/api/client'

export class ApiUserRepository implements UserRepository {
  async list(search?: string): Promise<SupplierUser[]> {
    return apiClient.get<SupplierUser[]>('/users', search ? { search } : undefined)
  }

  async getById(id: string): Promise<SupplierUser | null> {
    return apiClient.get<SupplierUser | null>(`/users/${id}`)
  }
}
