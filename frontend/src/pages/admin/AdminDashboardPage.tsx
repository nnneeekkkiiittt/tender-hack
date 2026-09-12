import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ticket as TicketIcon, Sparkles, ArrowRightLeft, ShieldCheck, Users, UserCog } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { StatCard } from '@/components/admin/StatCard'
import { BacklogCard } from '@/components/admin/BacklogCard'
import { CategoryDetailModal } from '@/components/admin/CategoryDetailModal'
import { DateRangeSelector } from '@/components/admin/DateRangeSelector'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { analyticsService } from '@/services/analytics'
import { useAnalyticsUiStore } from '@/store/analyticsStore'
import { formatMinutes } from '@/lib/utils'
import type { AnalyticsCategoryBreakdown } from '@/types'

const PIE_COLORS = ['#174A85', '#2F6FB3', '#D71920', '#6B7280', '#B45309']

export function AdminDashboardPage() {
  const range = useAnalyticsUiStore((s) => s.range)
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategoryBreakdown | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-analytics-overview', range],
    queryFn: () => analyticsService.getOverview(range),
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Общая статистика</h1>
          <p className="mt-1 text-sm text-ink-muted">Ключевые показатели работы системы</p>
        </div>
        <DateRangeSelector />
      </div>

      {isLoading && <LoadingState label="Загрузка статистики..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          {/* Primary KPIs: support-efficiency oriented */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Обращений всего"
              value={data.totalTickets.toLocaleString('ru-RU')}
              trend={data.trends.totalTickets}
              icon={TicketIcon}
              tone="primary"
            />
            <StatCard
              label="Решено AI"
              value={`${data.aiResolutionRate}%`}
              trend={data.trends.aiResolutionRate}
              icon={Sparkles}
              tone="success"
            />
            <StatCard
              label="Передано сотруднику"
              value={`${data.escalationRate}%`}
              trend={data.trends.escalationRate}
              goodDirection="down"
              icon={ArrowRightLeft}
              tone="accent"
            />
            <StatCard
              label="SLA соблюдение"
              value={`${data.slaRate}%`}
              trend={data.trends.slaRate}
              icon={ShieldCheck}
              tone="info"
            />
          </div>

          {/* Secondary: users / employees / backlog */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_0.8fr_1.6fr]">
            <StatCard label="Всего пользователей" value={data.totalUsers.toLocaleString('ru-RU')} delta={data.totalUsersDelta} icon={Users} tone="primary" />
            <StatCard
              label="Сотрудников поддержки"
              value={String(data.supportEmployeesCount)}
              delta={data.supportEmployeesDelta}
              deltaLabel=" новых"
              icon={UserCog}
              tone="info"
            />
            <BacklogCard backlog={data.backlog} trend={data.trends.backlog} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Заявки: {data.rangeLabel}</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTickets} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" name="Всего" stroke="#174A85" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resolved" name="Решено" stroke="#15803D" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="inProgress" name="В работе" stroke="#D71920" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Категории обращений</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Нажмите на категорию для подробностей</p>
              <div className="mt-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.categories} dataKey="value" nameKey="label" innerRadius={50} outerRadius={72} paddingAngle={2}>
                      {data.categories.map((entry, index) => (
                        <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} className="cursor-pointer" onClick={() => setActiveCategory(entry)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1">
                {data.categories.map((c, i) => (
                  <li key={c.category}>
                    <button
                      onClick={() => setActiveCategory(c)}
                      className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2 text-ink-muted">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {c.label}
                      </span>
                      <span className="font-medium text-ink">{c.percent}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Показатели поддержки</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Среднее время ответа" value={data.averageResponseTime} />
              <Metric label="Среднее время решения" value={data.averageResolutionTime} />
              <Metric label="Медиана решения" value={formatMinutes(data.resolutionTimeStats.medianMinutes)} />
              <Metric label="P90 решения" value={formatMinutes(data.resolutionTimeStats.p90Minutes)} />
              <Metric label="Доля AI-решений" value={`${data.aiResolutionRate}%`} />
              <Metric label="SLA соблюдение" value={`${data.slaRate}%`} />
            </div>
          </div>
        </>
      )}

      <CategoryDetailModal category={activeCategory} onClose={() => setActiveCategory(null)} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    </div>
  )
}
