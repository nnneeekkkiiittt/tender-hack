import React from 'react'
import { Outlet } from 'react-router-dom'
import { Inbox, User as UserIcon, ShieldAlert, BarChart3 } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export function SupportLayout() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        groups={[
          {
            items: [
              { to: '/support', label: 'Все заявки', icon: Inbox, end: true },
              { to: '/support/mine', label: 'Мои заявки', icon: UserIcon },
              { to: '/support/control', label: 'На контроле', icon: ShieldAlert },
              { to: '/support/stats', label: 'Статистика', icon: BarChart3 },
            ],
          },
        ]}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
