import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard } from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Button } from '@/components/ui/Button'
import { OperatorAiPanel } from '@/components/admin/OperatorAiPanel'
import { TopicsPanel } from '@/components/admin/TopicsPanel'
import { EscalationsSummary } from '@/components/admin/EscalationsSummary'
import { claimsAnalyticsService } from '@/services/analytics'
import { checkAnalyticsHealth } from '@/services/analytics/healthCheck'
import { isApiMode } from '@/config/env'

export function AdminAnalyticsPage() {
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null)

  // Checked once per visit (long staleTime), not on every render — and only
  // in API mode, since demo mode has no external service to be unavailable.
  const health = useQuery({
    queryKey: ['analytics-health'],
    queryFn: checkAnalyticsHealth,
    enabled: isApiMode,
    staleTime: 60_000,
    retry: false,
  })

  const allQuery = useQuery({
    queryKey: ['claims-analytics', 'all'],
    queryFn: () => claimsAnalyticsService.getClaimsAnalytics(),
    enabled: !isApiMode || health.data === true,
  })

  // Topics/escalations are re-requested when switching operator even though
  // they don't depend on operator_id — the backend has no endpoint that
  // returns operator metrics alone, and splitting getClaimsAnalytics into
  // three independent calls added more complexity than this small refetch
  // costs in practice.
  const singleQuery = useQuery({
    queryKey: ['claims-analytics', selectedOperatorId],
    queryFn: () => claimsAnalyticsService.getClaimsAnalytics(selectedOperatorId ?? undefined),
    enabled: selectedOperatorId !== null && (!isApiMode || health.data === true),
  })

  if (isApiMode && health.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Аналитика</h1>
        <LoadingState label="Проверка сервиса аналитики..." />
      </div>
    )
  }

  if (isApiMode && health.data === false) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Аналитика</h1>
        <ErrorState title="Сервис аналитики недоступен" onRetry={() => health.refetch()} />
      </div>
    )
  }

  const activeQuery = selectedOperatorId !== null ? singleQuery : allQuery
  const data = activeQuery.data
  const operatorOptions = (allQuery.data?.operatorAi.operators ?? []).map((o) => ({ id: o.operator_id, name: o.name }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Аналитика</h1>
          <p className="mt-1 text-sm text-ink-muted">Как работают AI и поддержка, какие темы важнее всего и где аномальный рост</p>
        </div>
        <Link to="/admin/analytics/dashboards">
          <Button variant="outline" leftIcon={<LayoutDashboard className="h-4 w-4" />}>
            Мои дашборды
          </Button>
        </Link>
      </div>

      {activeQuery.isLoading && <LoadingState label="Загрузка аналитики..." />}
      {activeQuery.isError && <ErrorState onRetry={() => activeQuery.refetch()} />}

      {data && (
        <div className="mt-6 space-y-8">
          <EscalationsSummary data={data.escalations} />
          <OperatorAiPanel
            data={data.operatorAi}
            operators={operatorOptions}
            selectedOperatorId={selectedOperatorId}
            onSelectOperator={setSelectedOperatorId}
          />
          <TopicsPanel data={data.topics} />
        </div>
      )}
    </div>
  )
}
