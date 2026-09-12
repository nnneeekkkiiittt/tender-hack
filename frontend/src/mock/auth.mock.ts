import type { AuthUser } from '@/types'

// One demo account per role — used by the DEMO ROLE SWITCHER.
// These are NOT a real authentication system.
export const DEMO_USERS: Record<AuthUser['role'], AuthUser> = {
  USER: {
    id: 'user_ivanov',
    name: 'Иван Иванов',
    email: 'ivanov@romashka.ru',
    role: 'USER',
    organization: 'ООО Ромашка',
    inn: '7701234567',
  },
  SUPPORT: {
    id: 'support_petrov',
    name: 'Алексей Петров',
    email: 'petrov@mos.ru',
    role: 'SUPPORT',
  },
  ADMIN: {
    id: 'admin_smirnova',
    name: 'Администратор',
    email: 'admin@mos.ru',
    role: 'ADMIN',
  },
}
