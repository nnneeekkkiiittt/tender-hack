import type { CreateEmployeePayload, EmployeeRepository } from './EmployeeRepository'
import type { SupportEmployee } from '@/types'
import { apiClient } from '@/api/client'

export class ApiEmployeeRepository implements EmployeeRepository {
  async list(search?: string): Promise<SupportEmployee[]> {
    return apiClient.get<SupportEmployee[]>('/employees', search ? { search } : undefined)
  }

  async create(payload: CreateEmployeePayload): Promise<SupportEmployee> {
    return apiClient.post<SupportEmployee>('/employees', payload)
  }

  async update(id: string, patch: Partial<Pick<SupportEmployee, 'name' | 'email' | 'role'>>): Promise<SupportEmployee> {
    return apiClient.patch<SupportEmployee>(`/employees/${id}`, patch)
  }

  async toggleStatus(id: string): Promise<SupportEmployee> {
    return apiClient.patch<SupportEmployee>(`/employees/${id}/toggle-status`, {})
  }
}
