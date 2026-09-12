import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { claimsAnalyticsService } from '@/services/analytics'
import type { DashboardWidget } from '@/types'

interface DemoWidgetChartProps {
  widget: DashboardWidget
}

// Demo-mode widget rendering: real (demo) data, our own Recharts renderer —
// deliberately NOT trying to imitate a Metabase chart. See ApiWidgetEmbed
// for the API-mode equivalent (a real embedded Metabase visualization).
export function DemoWidgetChart({ widget }: DemoWidgetChartProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['claims-analytics', 'all'],
    queryFn: () => claimsAnalyticsService.getClaimsAnalytics(),
  })

  if (isLoading) return <LoadingState compact label="Загрузка данных..." />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data) return null

  if (widget.dimension === 'operator') {
    const rows = data.operatorAi.operators.map((o) => ({
      name: o.name,
      value: widget.metric === 'claims_count' ? o.claimsHandled ?? 0 : o.dislike_percentage,
    }))
    if (rows.length === 0) return <EmptyState title="Нет данных по операторам" />
    return <CategoryChart rows={rows} visualization={widget.visualization} />
  }

  if (widget.metric === 'escalation_growth') {
    const rows = data.escalations.map((e) => ({ name: e.subtopic, value: e.growth_percent }))
    if (rows.length === 0) return <EmptyState title="Аномального роста не обнаружено" />
    return <CategoryChart rows={rows} visualization={widget.visualization} />
  }

  const rows = data.topics.topics.map((t) => ({
    name: t.subtopic,
    value: widget.metric === 'ai_resolved_percentage' ? t.ai_resolved_percentage : t.subtopic_share_percentage,
  }))
  if (rows.length === 0) return <EmptyState title="Нет данных по темам" />
  return <CategoryChart rows={rows} visualization={widget.visualization} />
}

function CategoryChart({
  rows,
  visualization,
}: {
  rows: { name: string; value: number }[]
  visualization: DashboardWidget['visualization']
}) {
  if (visualization === 'table') {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink">{row.name}</td>
                <td className="px-4 py-2.5 text-ink-muted">{row.value.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        {visualization === 'line' ? (
          <LineChart data={rows} margin={{ left: -20, right: 10 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
            <Line type="monotone" dataKey="value" stroke="#174A85" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <BarChart data={rows} margin={{ left: -20, right: 10 }}>
            <CartesianGrid stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }} />
            <Bar dataKey="value" fill="#2F6FB3" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
