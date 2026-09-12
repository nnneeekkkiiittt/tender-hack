import type { EmployeeRole, SupportEmployee } from '@/types'

export interface CreateEmployeePayload {
  name: string
  email: string
  role: EmployeeRole
}

export interface EmployeeRepository {
  list(search?: string): Promise<SupportEmployee[]>
  create(payload: CreateEmployeePayload): Promise<SupportEmployee>
  update(id: string, patch: Partial<Pick<SupportEmployee, 'name' | 'email' | 'role'>>): Promise<SupportEmployee>
  toggleStatus(id: string): Promise<SupportEmployee>
}
