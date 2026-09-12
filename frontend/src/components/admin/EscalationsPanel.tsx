import React from 'react'
import { AlertTriangle, ShieldAlert, ArrowUp, CheckCircle2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import type { EscalationResult } from '@/types'

interface EscalationsPanelProps {
  data: EscalationResult[]
}

export function EscalationsPanel({ data }: EscalationsPanelProps) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Эскалации</h2>
        <p className="text-xs text-ink-muted">Текущая неделя vs среднее за предыдущие 4 недели</p>
      </div>

      <div className="mt-3 space-y-2.5">
        {data.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="За текущую неделю аномального роста обращений не обнаружено."
          />
        ) : (
          data.map((alert) => {
            const isCrit = alert.alert_level === 'CRIT'
            return (
              <div
                key={`${alert.topic}::${alert.subtopic}`}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-lg border px-4 py-3.5',
                  isCrit ? 'border-accent/30 bg-accent/5' : 'border-warning/30 bg-warning-bg'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      isCrit ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'
                    )}
                  >
                    {isCrit ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <div>
                    <span className={cn('text-xs font-semibold uppercase tracking-wide', isCrit ? 'text-accent' : 'text-warning')}>
                      {isCrit ? 'Критический рост' : 'Рост обращений'}
                    </span>
                    <p className="text-[15px] font-medium text-ink">
                      {alert.subtopic} <span className="text-ink-muted">({alert.topic})</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {alert.current_week} обращений · в среднем {alert.avg_4_weeks.toFixed(1)}/нед. за последние 4 недели
                    </p>
                  </div>
                </div>
                <span className={cn('inline-flex shrink-0 items-center gap-1 text-lg font-semibold', isCrit ? 'text-accent' : 'text-warning')}>
                  <ArrowUp className="h-4 w-4" />
                  {alert.growth_percent.toFixed(0)}%
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
