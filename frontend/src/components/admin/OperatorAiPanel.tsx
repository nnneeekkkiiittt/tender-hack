import React from 'react'
import { ThumbsDown, Clock, CheckCircle2, MessageSquareWarning } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import { reasons as REASON_LABELS } from '@/api/contracts'
import { formatSeconds } from '@/lib/utils'
import type { OperatorAiAnalytics } from '@/types'

interface OperatorOption {
  id: number
  name: string
}

interface OperatorAiPanelProps {
  data: OperatorAiAnalytics
  operators: OperatorOption[]
  selectedOperatorId: number | null
  onSelectOperator: (id: number | null) => void
}

function reasonLabel(reason: string | null): string {
  if (!reason) return 'Нет данных'
  return (REASON_LABELS as Record<string, string>)[reason] ?? reason
}

function formatPercent(value: number | null | undefined, sampleCount?: number): string {
  if (value === null || value === undefined) return '—'
  // A sample count of exactly 0 means the backend's COALESCE(...,0) fallback
  // fired because there was no data — not a genuine 0%.
  if (sampleCount === 0) return '—'
  return `${value.toFixed(1)}%`
}

export function OperatorAiPanel({ data, operators, selectedOperatorId, onSelectOperator }: OperatorAiPanelProps) {
  // When AI itself is the selected operator, the service deliberately nulls
  // out `aggregate` (it's a per-HUMAN weighted average) and puts AI's real
  // numbers in `aiOperator` instead — so the top KPI cards need to read from
  // there in that one case, not from `aggregate`.
  const isSingleAiView = selectedOperatorId !== null && data.aiOperator?.operator_id === selectedOperatorId
  const kpi = isSingleAiView
    ? {
        dislikePercentage: data.aiOperator!.dislike_percentage,
        avgResponseTimeSeconds: data.aiOperator!.avg_response_time_seconds,
        resolvedSelfPercentage: data.aiOperator!.resolved_self_percentage,
        topDislikeReason: data.aiOperator!.top_dislike_reason ?? null,
      }
    : data.aggregate

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Операторы + AI</h2>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Оператор:
          <select
            value={selectedOperatorId ?? 'all'}
            onChange={(e) => onSelectOperator(e.target.value === 'all' ? null : Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-white px-2.5 text-sm text-ink focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
          >
            <option value="all">Все операторы</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Доля дизлайков" value={formatPercent(kpi.dislikePercentage)} icon={ThumbsDown} tone="accent" />
        <StatCard label="Среднее время ответа" value={formatSeconds(kpi.avgResponseTimeSeconds)} icon={Clock} tone="primary" />
        <StatCard label="Самостоятельно решённые" value={formatPercent(kpi.resolvedSelfPercentage)} icon={CheckCircle2} tone="success" />

        <div className="rounded-lg border border-border bg-white p-5 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info-bg text-info">
            <MessageSquareWarning className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold leading-snug tracking-tight text-ink">
            {reasonLabel(kpi.topDislikeReason)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">Главная причина дизлайков</p>
        </div>
      </div>

      {(data.operators.length > 0 || data.aiOperator) && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3 font-medium">Оператор</th>
                <th className="px-4 py-3 font-medium">Доля дизлайков</th>
                <th className="px-4 py-3 font-medium">Среднее время ответа</th>
                <th className="px-4 py-3 font-medium">Самостоятельно решённые</th>
                <th className="px-4 py-3 font-medium">Топ причина дизлайков</th>
              </tr>
            </thead>
            <tbody>
              {data.aiOperator && (
                <tr className="border-b border-border bg-info-bg/40">
                  <td className="px-4 py-3.5 font-medium text-ink">
                    {data.aiOperator.name}
                    <span className="ml-1.5 rounded-full bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-info">AI</span>
                  </td>
                  <td className="px-4 py-3.5 text-ink-muted">{formatPercent(data.aiOperator.dislike_percentage)}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{formatSeconds(data.aiOperator.avg_response_time_seconds)}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{formatPercent(data.aiOperator.resolved_self_percentage)}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{reasonLabel(data.aiOperator.top_dislike_reason ?? null)}</td>
                </tr>
              )}
              {data.operators.map((op) => (
                <tr key={op.operator_id} className="border-b border-border last:border-0 hover:bg-gray-50/70">
                  <td className="px-4 py-3.5 font-medium text-ink">{op.name}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{formatPercent(op.dislike_percentage, op.reactionsReceived)}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{formatSeconds(op.avg_response_time_seconds)}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{formatPercent(op.resolved_self_percentage, op.claimsHandled)}</td>
                  <td className="px-4 py-3.5 text-ink-muted">{reasonLabel(op.top_dislike_reason ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isSingleAiView && data.aiOperator && (
            <p className="border-t border-border px-4 py-2 text-xs text-ink-muted">
              Показатели «Доля дизлайков» / «Среднее время ответа» / «Самостоятельно решённые» выше — только по людям; AI считается отдельно и не входит в это среднее.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
