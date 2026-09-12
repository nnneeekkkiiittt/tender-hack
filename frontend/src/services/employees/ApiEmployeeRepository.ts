import type { CreateEmployeePayload, EmployeeRepository } from './EmployeeRepository'
import type { SupportEmployee } from '@/types'
import { api, type Page, type User } from '@/api/contracts'
const adapt = (u: User): SupportEmployee => ({
  id: u.id,
  name: u.name,
  email: '',
  role: u.role as SupportEmployee['role'],
})
export class ApiEmployeeRepository implements EmployeeRepository {
  async listPage(search = '', offset = 0) {
    const page = await api<Page<User>>('/employees', 'GET', undefined, { search, offset })
    return { ...page, items: page.items.map(adapt) }
  }
  async list(search?: string) {
    return (await this.listPage(search)).items
  }
  async create(p: CreateEmployeePayload) {
    return adapt(
      await api<User>('/employees', 'POST', { name: p.name, role: p.role, password: p.password }),
    )
  }
  async update(id: string, p: Partial<SupportEmployee>) {
    return adapt(await api<User>('/employees/' + id, 'PATCH', { name: p.name, role: p.role }))
  }
  async toggleStatus(): Promise<SupportEmployee> {
    throw new Error('Активация и деактивация недоступны')
  }
}
