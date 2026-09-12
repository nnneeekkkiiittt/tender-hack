import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, type User, type Role } from '@/api/contracts'
import { useAuthStore } from '@/store/authStore'
import { isDemoMode } from '@/config/env'

const labels: Record<Role, string> = {
  admin: 'Admin',
  supportL1: 'L1',
  supportL2: 'L2',
  supportL3: 'L3',
  user: 'Consumer',
}
export function TestAccountMenu() {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const cache = useQueryClient(),
    navigate = useNavigate()
  const current = useAuthStore((s) => s.user)
  const accounts = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: () => api<User[]>('/auth/demo'),
    enabled: !isDemoMode,
    retry: false,
  })
  if (!accounts.data?.length) return null
  const switchTo = async (role: Role) => {
    setBusy(true)
    setError('')
    try {
      await api('/auth/demo/' + role, 'POST', {})
      await cache.cancelQueries()
      cache.clear()
      await useAuthStore.getState().init()
      setOpen(false)
      navigate('/', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-controls="test-account-menu"
        onClick={() => setOpen(!open)}
        className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary"
      >
        Демо
      </button>
      {open && (
        <>
          <button
            aria-label="Закрыть демо-меню"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            id="test-account-menu"
            className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-white p-2 shadow-popover"
          >
            <p className="px-2 py-2 text-xs text-ink-muted">
              Тестовые аккаунты · общие данные. Только для локальной демонстрации.
            </p>
            {accounts.data.map((account) => (
              <button
                key={account.id}
                disabled={busy}
                onClick={() => void switchTo(account.role)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <span>{labels[account.role]}</span>
                <span className="text-xs text-ink-muted">
                  {current?.id === account.id ? 'Вы здесь' : account.name}
                </span>
              </button>
            ))}
            {error && (
              <p role="alert" className="p-2 text-xs text-accent">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
