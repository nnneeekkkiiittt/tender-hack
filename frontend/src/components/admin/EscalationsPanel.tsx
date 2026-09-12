import React from 'react'
import { AlertTriangle, ShieldAlert, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EscalationResult } from '@/types'

interface EscalationsPanelProps {
  data: EscalationResult[]
}

// Renders just the list of alerts — used inside EscalationsSummary's
// expanded state. The heading/empty-state/caption live there instead, since
// this is now nested inside a collapsible banner rather than its own
// always-visible section.
export function EscalationsPanel({ data }: EscalationsPanelProps) {
  return (
    <div className="space-y-2.5">
      {data.map((alert) => {
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
              </div>
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1 text-lg font-semibold', isCrit ? 'text-accent' : 'text-warning')}>
              <ArrowUp className="h-4 w-4" />
              {alert.growth_percent.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
