import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { dashboardRepository } from '@/services/dashboards'
import { METABASE_URL } from '@/config/env'
import type { DashboardWidget } from '@/types'

interface ApiWidgetEmbedProps {
  dashboardId: string
  widget: DashboardWidget
}

// API-mode widget rendering: a REAL embedded Metabase visualization, loaded
// from a short-lived signed URL issued by our own backend
// (analytics/internal/metabase — the signing secret never reaches the
// frontend). Deliberately never falls back to a fake Recharts chart here —
// if Metabase isn't configured, that's shown explicitly instead.
export function ApiWidgetEmbed({ dashboardId, widget }: ApiWidgetEmbedProps) {
  const { data: embedUrl, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-embed-url', dashboardId, widget.id],
    queryFn: () => dashboardRepository.getEmbedUrl(dashboardId, widget.id),
    enabled: Boolean(METABASE_URL),
  })

  if (!METABASE_URL) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-gray-50/60 px-6 py-10 text-center text-sm text-ink-muted">
        <AlertTriangle className="h-5 w-5" />
        <p className="font-medium text-ink">Metabase не настроен</p>
        <p>
          Виджет «{widget.title}» ({widget.metric} × {widget.dimension}) сохранён, но для отображения графика нужно
          задать VITE_METABASE_URL и настроить backend-интеграцию с Metabase.
        </p>
      </div>
    )
  }

  if (isLoading) return <LoadingState compact label="Загрузка визуализации..." />
  if (isError || !embedUrl) return <ErrorState title="Не удалось загрузить визуализацию" onRetry={() => refetch()} />

  return (
    <iframe
      src={embedUrl}
      title={widget.title}
      className="h-64 w-full rounded-lg border border-border"
      frameBorder={0}
    />
  )
}
