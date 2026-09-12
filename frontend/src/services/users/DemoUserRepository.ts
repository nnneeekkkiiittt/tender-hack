import type { UserRepository } from './UserRepository'
import type { SupplierUser } from '@/types'
import { INITIAL_USERS } from '@/mock/users.mock'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class DemoUserRepository implements UserRepository {
  async list(search?: string): Promise<SupplierUser[]> {
    await wait(300)
    if (!search) return INITIAL_USERS
    const q = search.toLowerCase()
    return INITIAL_USERS.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.organization || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q),
    )
  }

  async getById(id: string): Promise<SupplierUser | null> {
    await wait(150)
    return INITIAL_USERS.find((u) => u.id === id) ?? null
  }
}
