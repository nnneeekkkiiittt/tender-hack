import React from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutGrid, Ticket as TicketIcon, Users, UserCog, BarChart3, Settings } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        groups={[
          {
            items: [
              { to: '/admin', label: 'Обзор', icon: LayoutGrid, end: true },
              { to: '/admin/tickets', label: 'Заявки', icon: TicketIcon },
              { to: '/admin/users', label: 'Пользователи', icon: Users },
              { to: '/admin/employees', label: 'Сотрудники', icon: UserCog },
              { to: '/admin/analytics', label: 'Аналитика', icon: BarChart3 },
              { to: '/admin/settings', label: 'Настройки', icon: Settings },
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
