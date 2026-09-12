import React from 'react'
import { cn } from '@/lib/utils'
import type { FunnelStage } from '@/types'

interface FunnelProps {
  stages: FunnelStage[]
}

// Lightweight funnel visualization: horizontal bars scaled to the first
// stage's value, with the drop-off percentage between consecutive stages.
// The last stage (reopened tickets) is called out in accent red since it's
// a quality signal rather than a step of throughput.
export function Funnel({ stages }: FunnelProps) {
  const max = stages[0]?.value || 1

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const widthPercent = Math.max(6, Math.round((stage.value / max) * 100))
        const prev = stages[i - 1]
        const dropPercent = prev && prev.value > 0 ? Math.round(((prev.value - stage.value) / prev.value) * 100) : null
        const isLast = i === stages.length - 1

        return (
          <div key={stage.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{stage.label}</span>
              <span className="shrink-0 text-ink-muted">
                {stage.value.toLocaleString('ru-RU')}
                {dropPercent !== null && dropPercent !== 0 && (
                  <span className="ml-2 text-xs text-ink-muted">(-{dropPercent}%)</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn('h-full rounded-full transition-all', isLast ? 'bg-accent' : 'bg-primary')}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
