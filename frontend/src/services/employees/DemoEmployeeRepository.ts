import type { CreateEmployeePayload, EmployeeRepository } from './EmployeeRepository'
import type { SupportEmployee } from '@/types'
import { INITIAL_EMPLOYEES } from '@/mock/employees.mock'
import { demoStorage, DEMO_STORAGE_KEYS } from '@/lib/storage'
import { generateId } from '@/lib/utils'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function loadAll(): SupportEmployee[] {
  return demoStorage.get<SupportEmployee[]>(DEMO_STORAGE_KEYS.employees, INITIAL_EMPLOYEES)
}

function saveAll(employees: SupportEmployee[]) {
  demoStorage.set(DEMO_STORAGE_KEYS.employees, employees)
}

export class DemoEmployeeRepository implements EmployeeRepository {
  async list(search?: string): Promise<SupportEmployee[]> {
    await wait(300)
    const all = loadAll()
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter((e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
  }

  async create(payload: CreateEmployeePayload): Promise<SupportEmployee> {
    await wait(350)
    const employees = loadAll()
    const employee: SupportEmployee = {
      id: generateId('support'),
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: 'ACTIVE',
      lastLogin: new Date().toISOString(),
      activeTickets: 0,
    }
    saveAll([employee, ...employees])
    return employee
  }

  async update(id: string, patch: Partial<Pick<SupportEmployee, 'name' | 'email' | 'role'>>): Promise<SupportEmployee> {
    await wait(300)
    const employees = loadAll()
    const idx = employees.findIndex((e) => e.id === id)
    if (idx === -1) throw new Error('Employee not found')
    employees[idx] = { ...employees[idx], ...patch }
    saveAll(employees)
    return employees[idx]
  }

  async toggleStatus(id: string): Promise<SupportEmployee> {
    await wait(250)
    const employees = loadAll()
    const idx = employees.findIndex((e) => e.id === id)
    if (idx === -1) throw new Error('Employee not found')
    employees[idx] = {
      ...employees[idx],
      status: employees[idx].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }
    saveAll(employees)
    return employees[idx]
  }

  async delete(id: string): Promise<void> {
    await wait(250)
    const employees = loadAll()
    saveAll(employees.filter((e) => e.id !== id))
  }
}
