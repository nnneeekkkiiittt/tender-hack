import { isDemoMode } from '@/config/env'
import React from 'react'
import { Outlet } from 'react-router-dom'
import { Inbox, User as UserIcon, ShieldAlert, BarChart3 } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/store/authStore'

export function SupportLayout() {
  const level = useAuthStore((s) => s.user?.supportLevel)
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        groups={[
          {
            items: [
              { to: '/support', label: level ? `Очередь L${level}` : 'Все заявки', icon: Inbox, end: true },
              { to: '/support/mine', label: 'Мои заявки', icon: UserIcon },
              ...(isDemoMode
                ? [{ to: '/support/control', label: 'На контроле', icon: ShieldAlert }]
                : []),
              { to: '/support/stats', label: 'Статистика', icon: BarChart3 },
            ],
          },
        ]}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
