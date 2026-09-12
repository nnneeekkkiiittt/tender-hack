import { isDemoMode } from '@/config/env'
import type { EmployeeRepository } from './EmployeeRepository'
import { DemoEmployeeRepository } from './DemoEmployeeRepository'
import { ApiEmployeeRepository } from './ApiEmployeeRepository'
import { api, type Page, type User } from '@/api/contracts'

export async function listAssignableEmployees() {
  const items: User[] = []
  let page: Page<User>
  do {
    page = await api<Page<User>>('/employees', 'GET', undefined, {
      offset: items.length,
      limit: 100,
    })
    items.push(...page.items)
  } while (items.length < page.total && page.items.length)
  return items
}

export const employeeRepository: EmployeeRepository = isDemoMode
  ? new DemoEmployeeRepository()
  : new ApiEmployeeRepository()

export type { EmployeeRepository, CreateEmployeePayload } from './EmployeeRepository'

export async function listEmployees(search = '', offset = 0) {
  if (!isDemoMode) return new ApiEmployeeRepository().listPage(search, offset)
  const items = await employeeRepository.list(search)
  return { items: items.slice(offset, offset + 20), total: items.length, offset, limit: 20 }
}
