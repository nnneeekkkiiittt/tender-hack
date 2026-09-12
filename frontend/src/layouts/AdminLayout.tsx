import React from 'react'
import { Outlet } from 'react-router-dom'
import { Ticket as TicketIcon, Users, UserCog, BarChart3, Settings } from 'lucide-react'
import { Sidebar, NavItemLink } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        groups={[
          {
            items: [
              { to: '/admin', label: 'Аналитика', icon: BarChart3, end: true },
              { to: '/admin/tickets', label: 'Заявки', icon: TicketIcon },
              { to: '/admin/users', label: 'Пользователи', icon: Users },
              { to: '/admin/employees', label: 'Сотрудники', icon: UserCog },
            ],
          },
        ]}
        footer={<NavItemLink item={{ to: '/admin/settings', label: 'Настройки', icon: Settings }} />}
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
