import type { SupplierUser } from '@/types'

export interface UserRepository {
  list(search?: string): Promise<SupplierUser[]>
  getById(id: string): Promise<SupplierUser | null>
}
