import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, LayoutDashboard, Trash2, Pencil, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { dashboardRepository } from '@/services/dashboards'
import { formatShortDate } from '@/lib/utils'

export function DashboardListPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboards'],
    queryFn: () => dashboardRepository.list(),
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить дашборд?')) return
    await dashboardRepository.remove(id)
    queryClient.invalidateQueries({ queryKey: ['dashboards'] })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link to="/admin/analytics" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />К аналитике
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Мои дашборды</h1>
          <p className="mt-1 text-sm text-ink-muted">Сохранённые конфигурации визуализаций — данные всегда актуальны при открытии</p>
        </div>
        <Link to="/admin/analytics/dashboards/new">
          <Button leftIcon={<Plus className="h-4 w-4" />}>Создать дашборд</Button>
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <LoadingState label="Загрузка дашбордов..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && data?.length === 0 && (
          <EmptyState
            icon={<LayoutDashboard className="h-5 w-5" />}
            title="Дашбордов пока нет"
            description="Создайте первый дашборд, чтобы собрать нужные метрики на одном экране."
            action={
              <Link to="/admin/analytics/dashboards/new">
                <Button size="sm">Создать дашборд</Button>
              </Link>
            }
          />
        )}
        {data?.map((dashboard) => (
          <div key={dashboard.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ink">{dashboard.name}</p>
              {dashboard.description && <p className="mt-0.5 truncate text-sm text-ink-muted">{dashboard.description}</p>}
              <p className="mt-1 text-xs text-ink-muted">Последнее обновление: {formatShortDate(dashboard.updatedAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link to={`/admin/analytics/dashboards/${dashboard.id}/edit`} className="rounded-md p-2 text-ink-muted hover:bg-gray-100 hover:text-primary" aria-label="Редактировать">
                <Pencil className="h-4 w-4" />
              </Link>
              <button onClick={() => handleDelete(dashboard.id)} className="rounded-md p-2 text-ink-muted hover:bg-gray-100 hover:text-accent" aria-label="Удалить">
                <Trash2 className="h-4 w-4" />
              </button>
              <Link to={`/admin/analytics/dashboards/${dashboard.id}`}>
                <Button size="sm" variant="outline">
                  Открыть
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
