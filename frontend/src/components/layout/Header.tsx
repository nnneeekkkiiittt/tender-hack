import { TestAccountMenu } from '@/components/demo/TestAccountMenu'
import { PasswordModal } from '@/components/accounts/PasswordModal'
import { isDemoMode } from '@/config/env'
import React, { useState } from 'react'
import { Bell, Menu, LogOut, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import type { UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  USER: 'Поставщик',
  SUPPORT: 'Сотрудник поддержки',
  ADMIN: 'Администратор',
}

interface HeaderProps {
  title?: React.ReactNode
}

export function Header({ title }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const { toggleMobileSidebar } = useUiStore()
  const navigate = useNavigate()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileSidebar}
          className="rounded-md p-2 text-ink-muted hover:bg-gray-100 lg:hidden"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title && <div className="text-[15px] font-medium text-ink">{title}</div>}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <TestAccountMenu />
        <button
          className="relative rounded-md p-2 text-ink-muted hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
          aria-label="Уведомления"
          disabled={!isDemoMode}
          title="Уведомления пока недоступны"
        >
          <Bell className="h-5 w-5" />
          {isDemoMode && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
          >
            <Avatar name={user?.name ?? '?'} size="sm" />
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-tight text-ink">{user?.name}</div>
              <div className="text-xs leading-tight text-ink-muted">
                {user ? ROLE_LABEL[user.role] : ''}
              </div>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-ink-muted sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-md border border-border bg-white py-1 shadow-popover">
                <div className="border-b border-border px-3.5 py-2.5 sm:hidden">
                  <div className="text-sm font-medium text-ink">{user?.name}</div>
                  <div className="text-xs text-ink-muted">{user ? ROLE_LABEL[user.role] : ''}</div>
                </div>
                {!isDemoMode && (
                  <button
                    className="w-full px-3.5 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => {
                      setMenuOpen(false)
                      setPasswordOpen(true)
                    }}
                  >
                    Изменить пароль
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-ink hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  )
}
