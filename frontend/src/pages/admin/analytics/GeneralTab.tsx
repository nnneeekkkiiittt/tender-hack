import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { StatCard } from '@/components/admin/StatCard'
import { Clock, Gauge, TrendingUp, ShieldCheck } from 'lucide-react'
import { formatMinutes } from '@/lib/utils'
import type { Analytics, AnalyticsCategoryBreakdown } from '@/types'

interface GeneralTabProps {
  data: Analytics
  onSelectCategory: (category: AnalyticsCategoryBreakdown) => void
}

export function GeneralTab({ data, onSelectCategory }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Динамика обращений: {data.rangeLabel}</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailyTickets} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#174A85" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#174A85" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
              <Area type="monotone" dataKey="total" name="Обращений" stroke="#174A85" fill="url(#totalGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Среднее решения" value={formatMinutes(data.resolutionTimeStats.averageMinutes)} icon={Clock} tone="primary" />
        <StatCard label="Медиана решения" value={formatMinutes(data.resolutionTimeStats.medianMinutes)} icon={Gauge} tone="info" />
        <StatCard label="P90 решения" value={formatMinutes(data.resolutionTimeStats.p90Minutes)} icon={TrendingUp} tone="accent" />
        <StatCard label="SLA соблюдение" value={`${data.slaRate}%`} trend={data.trends.slaRate} icon={ShieldCheck} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">SLA: где происходят нарушения</h2>
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            <div>
              <p className="text-xl font-semibold text-success">{data.slaInTime.toLocaleString('ru-RU')}</p>
              <p className="text-ink-muted">В срок</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-accent">{data.slaViolated.toLocaleString('ru-RU')}</p>
              <p className="text-ink-muted">Нарушено</p>
            </div>
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slaViolationsByCategory} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                <Bar dataKey="violations" name="Нарушений SLA" fill="#D71920" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Возраст активных заявок</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Сколько обращений «зависло» в очереди</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.agingBacklog} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
                <Bar dataKey="count" name="Заявок" fill="#2F6FB3" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Распределение по категориям</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Нажмите на столбец для подробностей по категории</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.categories} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
              <Bar
                dataKey="value"
                name="Обращений"
                fill="#2F6FB3"
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
                onClick={(entry: any) => onSelectCategory(entry)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
