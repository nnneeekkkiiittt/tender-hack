import { isDemoMode } from '@/config/env'
import type { EmployeeRepository } from './EmployeeRepository'
import { DemoEmployeeRepository } from './DemoEmployeeRepository'
import { ApiEmployeeRepository } from './ApiEmployeeRepository'

export const employeeRepository: EmployeeRepository = isDemoMode
  ? new DemoEmployeeRepository()
  : new ApiEmployeeRepository()

export type { EmployeeRepository, CreateEmployeePayload } from './EmployeeRepository'
