import React, { useState } from 'react'
import { AlertTriangle, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EscalationsPanel } from './EscalationsPanel'
import type { EscalationResult } from '@/types'

interface EscalationsSummaryProps {
  data: EscalationResult[]
}

export function EscalationsSummary({ data }: EscalationsSummaryProps) {
  const [expanded, setExpanded] = useState(false)

  if (data.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-4 py-3 text-sm text-ink-muted">
        <CheckCircle2 className="h-4 w-4 text-success" />
        Аномального роста обращений не обнаружено
      </div>
    )
  }

  const critCount = data.filter((a) => a.alert_level === 'CRIT').length
  const warnCount = data.length - critCount
  const isCrit = critCount > 0

  const summaryParts = [
    critCount > 0 ? `критический рост — ${critCount}` : null,
    warnCount > 0 ? `рост обращений — ${warnCount}` : null,
  ].filter(Boolean)

  return (
    <div className={cn('overflow-hidden rounded-lg border', isCrit ? 'border-accent/30 bg-accent/5' : 'border-warning/30 bg-warning-bg')}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              isCrit ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'
            )}
          >
            {isCrit ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
          <span className={cn('text-sm font-medium', isCrit ? 'text-accent' : 'text-warning')}>
            Обнаружен аномальный рост обращений: {summaryParts.join(', ')}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-ink-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border bg-white p-4">
          <p className="mb-3 text-xs text-ink-muted">Текущая неделя vs среднее за предыдущие 4 недели</p>
          <EscalationsPanel data={data} />
        </div>
      )}
    </div>
  )
}
