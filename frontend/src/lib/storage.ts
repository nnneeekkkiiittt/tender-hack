// Thin wrapper around localStorage, used ONLY by DEMO MODE repositories/services.
// Never used as a stand-in for real authentication/security.

function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeKey<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (e.g. private mode) — fail silently in demo mode.
  }
}

export const demoStorage = {
  get: readKey,
  set: writeKey,
  remove(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* noop */
    }
  },
}

export const DEMO_STORAGE_KEYS = {
  currentRole: 'th_demo_current_role',
  currentUserId: 'th_demo_current_user_id',
  tickets: 'th_demo_tickets',
  employees: 'th_demo_employees',
  users: 'th_demo_users',
  dashboards: 'th_demo_dashboards',
} as const
