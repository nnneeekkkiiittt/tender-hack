import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { WidgetCard } from '@/components/admin/dashboards/WidgetCard'
import { dashboardRepository } from '@/services/dashboards'

export function DashboardViewPage() {
  const { id } = useParams<{ id: string }>()

  // Re-fetched every time the page mounts — we only ever persisted the
  // widget CONFIGURATION, never a data snapshot, so opening a dashboard a
  // week later always re-runs the underlying query.
  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => dashboardRepository.get(id!),
    enabled: Boolean(id),
  })

  if (isLoading) return <LoadingState label="Загрузка дашборда..." />
  if (isError || !dashboard) return <ErrorState title="Дашборд не найден" onRetry={() => refetch()} />

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/admin/analytics/dashboards" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />К моим дашбордам
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{dashboard.name}</h1>
      {dashboard.description && <p className="mt-1 text-sm text-ink-muted">{dashboard.description}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {dashboard.widgets.map((widget) => (
          <WidgetCard key={widget.id} dashboardId={dashboard.id} widget={widget} />
        ))}
      </div>
    </div>
  )
}
