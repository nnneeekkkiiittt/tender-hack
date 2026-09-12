import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { isDemoMode } from '@/config/env'
import type { UserRole } from '@/types'

const ROLES: { role: UserRole; label: string; path: string }[] = [
  { role: 'USER', label: 'Пользователь', path: '/app' },
  { role: 'SUPPORT', label: 'Саппорт', path: '/support' },
  { role: 'ADMIN', label: 'Администратор', path: '/admin' },
]

// Not a real login mechanism — visible only in DEMO MODE so the hackathon
// jury (or any visitor) can jump between the three role experiences.
export function DemoRoleSwitcher() {
  const { user, switchDemoRole } = useAuthStore()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  if (!isDemoMode) return null

  const handleSelect = async (role: UserRole, path: string) => {
    await switchDemoRole(role)
    navigate(path)
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2">
      <div className="rounded-lg border border-border bg-white shadow-popover">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-accent" />
            Demo mode
          </span>
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {!collapsed && (
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
            {ROLES.map((r) => (
              <button
                key={r.role}
                onClick={() => handleSelect(r.role, r.path)}
                className={cn(
                  'flex-1 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors',
                  user?.role === r.role
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-white text-ink hover:bg-gray-50'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
