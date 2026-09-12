import type { SupportEmployee } from '@/types'

const now = Date.now()
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString()
const daysAgo = (d: number) => new Date(now - d * 24 * 3600_000).toISOString()

export const INITIAL_EMPLOYEES: SupportEmployee[] = [
  {
    id: 'support_petrov',
    name: 'Иван Петров',
    email: 'petrov@mos.ru',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    lastLogin: hoursAgo(2),
    activeTickets: 6,
  },
  {
    id: 'support_smirnova',
    name: 'Анна Смирнова',
    email: 'smirnova@mos.ru',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    lastLogin: hoursAgo(3),
    activeTickets: 4,
  },
  {
    id: 'support_kozlov',
    name: 'Дмитрий Козлов',
    email: 'kozlov@mos.ru',
    role: 'SENIOR_EMPLOYEE',
    status: 'ACTIVE',
    lastLogin: hoursAgo(20),
    activeTickets: 9,
  },
  {
    id: 'support_volkova',
    name: 'Мария Волкова',
    email: 'volkova@mos.ru',
    role: 'EMPLOYEE',
    status: 'INACTIVE',
    lastLogin: daysAgo(5),
    activeTickets: 0,
  },
  {
    id: 'support_novikov',
    name: 'Алексей Новиков',
    email: 'novikov@mos.ru',
    role: 'SENIOR_EMPLOYEE',
    status: 'ACTIVE',
    lastLogin: hoursAgo(1),
    activeTickets: 7,
  },
]
