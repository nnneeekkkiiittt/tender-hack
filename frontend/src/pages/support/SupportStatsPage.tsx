import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ticket as TicketIcon, Clock, Sparkles, ShieldCheck } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { StatCard } from '@/components/admin/StatCard'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { analyticsService } from '@/services/analytics'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export function SupportStatsPage() {
  const { user } = useAuthStore()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-stats-overview'],
    queryFn: () => analyticsService.getOverview(),
  })

  const mine = data?.employeeLoad.find((e) => e.employeeId === user?.id)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Статистика</h1>
      <p className="mt-1 text-sm text-ink-muted">Ваша нагрузка и общие показатели поддержки</p>

      {isLoading && <LoadingState label="Загрузка статистики..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="У меня в работе" value={String(mine?.activeTickets ?? 0)} icon={TicketIcon} tone="accent" />
            <StatCard label="Решено мной за месяц" value={String(mine?.resolvedThisMonth ?? 0)} icon={ShieldCheck} tone="success" />
            <StatCard label="Среднее время ответа" value={data.averageResponseTime} icon={Clock} tone="primary" />
            <StatCard label="Решено с помощью AI" value={`${data.aiResolutionRate}%`} icon={Sparkles} tone="info" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Заявки за последние 30 дней</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTickets} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" name="Всего" stroke="#174A85" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resolved" name="Решено" stroke="#15803D" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Нагрузка сотрудников</h2>
              <ul className="mt-4 space-y-2">
                {data.employeeLoad.map((e) => {
                  const isMe = e.employeeId === user?.id
                  return (
                    <li
                      key={e.employeeId}
                      className={cn('flex items-center justify-between rounded-md px-3 py-2 text-sm', isMe && 'bg-primary/5')}
                    >
                      <span className={cn('font-medium', isMe ? 'text-primary' : 'text-ink')}>
                        {e.employeeName}
                        {isMe && ' (вы)'}
                      </span>
                      <span className="text-ink-muted">{e.activeTickets} в работе</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Категории обращений</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categories} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={170}
                    tick={{ fontSize: 12, fill: '#374151' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                  <Bar dataKey="value" name="Обращений" fill="#2F6FB3" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
