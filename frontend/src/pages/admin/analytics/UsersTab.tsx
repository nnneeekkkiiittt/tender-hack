import React from 'react'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { Users, UserPlus, Repeat2, Ticket as TicketIcon, RotateCcw, Star } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import type { Analytics } from '@/types'

interface UsersTabProps {
  data: Analytics
}

export function UsersTab({ data }: UsersTabProps) {
  const ua = data.userAnalytics

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Активные пользователи" value={ua.activeUsers.toLocaleString('ru-RU')} icon={Users} tone="primary" />
        <StatCard label="Новые пользователи" value={ua.newUsers.toLocaleString('ru-RU')} icon={UserPlus} tone="success" />
        <StatCard label="Вернувшиеся пользователи" value={ua.returningUsers.toLocaleString('ru-RU')} icon={Repeat2} tone="info" />
        <StatCard label="Обращений на пользователя" value={ua.avgTicketsPerUser.toFixed(2)} icon={TicketIcon} tone="primary" />
        <StatCard label="Повторные обращения" value={`${ua.repeatContactRate}%`} trend={ua.repeatContactTrend} goodDirection="down" icon={RotateCcw} tone="accent" />
        <StatCard label="CSAT" value={`${ua.csat}%`} icon={Star} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Топ категорий по пользователям</h2>
          <ul className="mt-3 space-y-2">
            {ua.topCategories.map((c) => (
              <li key={c.label} className="flex items-center justify-between text-sm">
                <span className="text-ink">{c.label}</span>
                <span className="font-medium text-ink-muted">{c.value.toLocaleString('ru-RU')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Динамика новых пользователей</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ua.newUsersTrend} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="newUsersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#15803D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                <Area type="monotone" dataKey="value" name="Новых пользователей" stroke="#15803D" fill="url(#newUsersGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
