import React from 'react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { Inbox, Clock, Gauge, TrendingUp, ShieldCheck, Star, Users } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import { formatMinutes } from '@/lib/utils'
import type { Analytics } from '@/types'

interface SupportTabProps {
  data: Analytics
}

export function SupportTab({ data }: SupportTabProps) {
  const ticketsPerAgent = data.employeePerformance.length
    ? Math.round(data.employeePerformance.reduce((sum, e) => sum + e.ticketsHandled, 0) / data.employeePerformance.length)
    : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Backlog" value={data.backlog.active.toLocaleString('ru-RU')} trend={data.trends.backlog} goodDirection="down" icon={Inbox} tone="accent" />
        <StatCard label="Среднее время ответа" value={data.averageResponseTime} trend={data.trends.averageResponseTime} goodDirection="down" icon={Clock} tone="primary" />
        <StatCard label="Среднее время решения" value={data.averageResolutionTime} icon={Gauge} tone="info" />
        <StatCard label="P90 решения" value={formatMinutes(data.resolutionTimeStats.p90Minutes)} icon={TrendingUp} tone="accent" />
        <StatCard label="SLA соблюдение" value={`${data.slaRate}%`} trend={data.trends.slaRate} icon={ShieldCheck} tone="success" />
        <StatCard label="CSAT поддержки" value={`${data.csat.support}%`} icon={Star} tone="success" />
        <StatCard label="Заявок на агента" value={String(ticketsPerAgent)} icon={Users} tone="primary" />
        <StatCard label="Медиана решения" value={formatMinutes(data.resolutionTimeStats.medianMinutes)} icon={Gauge} tone="info" />
      </div>

      <div className="rounded-lg border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Производительность сотрудников</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3 font-medium">Сотрудник</th>
                <th className="px-5 py-3 font-medium">Заявки</th>
                <th className="px-5 py-3 font-medium">Среднее время ответа</th>
                <th className="px-5 py-3 font-medium">Среднее время решения</th>
                <th className="px-5 py-3 font-medium">SLA</th>
                <th className="px-5 py-3 font-medium">CSAT</th>
              </tr>
            </thead>
            <tbody>
              {data.employeePerformance.map((e) => (
                <tr key={e.employeeId} className="border-b border-border last:border-0 hover:bg-gray-50/70">
                  <td className="px-5 py-3.5 font-medium text-ink">{e.employeeName}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{e.ticketsHandled}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{e.avgResponseTime}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{e.avgResolutionTime}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{e.slaRate}%</td>
                  <td className="px-5 py-3.5 text-ink-muted">{e.csat.toFixed(1)} / 5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Нагрузка по часам</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourlyLoad} margin={{ left: -20, right: 10 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                <Bar dataKey="value" name="Обращений" fill="#174A85" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Нагрузка по дням недели</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekdayLoad} margin={{ left: -20, right: 10 }}>
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                <Bar dataKey="value" name="Обращений" fill="#2F6FB3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
