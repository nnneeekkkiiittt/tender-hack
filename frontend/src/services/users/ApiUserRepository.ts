import type { UserRepository } from './UserRepository'
import type { SupplierUser } from '@/types'
import { api, type Page, type User } from '@/api/contracts'
export class ApiUserRepository implements UserRepository {
  async listPage(search = '', offset = 0): Promise<Page<SupplierUser>> {
    return api<Page<User>>('/users', 'GET', undefined, { search, offset })
  }
  async list(search?: string) {
    return (await this.listPage(search)).items
  }
  async getById(): Promise<SupplierUser | null> {
    throw new Error('Подробный профиль пользователя недоступен; используйте автора заявки')
  }
}
