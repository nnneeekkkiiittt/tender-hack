import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrendValue } from '@/types'

interface StatCardProps {
  label: string
  value: string
  /** Legacy signed delta (positive = up arrow). Prefer `trend` for new code. */
  delta?: number
  /** Explicit trend value + direction — use this when direction and "is this
   * good" are independent (e.g. backlog going down is the good outcome). */
  trend?: TrendValue
  deltaLabel?: string
  /** Which direction counts as a good outcome for this metric. Default 'up'
   * matches most KPIs (more resolved, higher SLA); set 'down' for metrics
   * like backlog, escalation rate, or repeat contacts where lower is better. */
  goodDirection?: 'up' | 'down'
  icon: LucideIcon
  tone?: 'primary' | 'accent' | 'success' | 'info'
}

const toneClasses = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success-bg text-success',
  info: 'bg-info-bg text-info',
}

export function StatCard({ label, value, delta, trend, deltaLabel, goodDirection = 'up', icon: Icon, tone = 'primary' }: StatCardProps) {
  const direction: 'up' | 'down' | undefined = trend ? trend.direction : typeof delta === 'number' ? (delta >= 0 ? 'up' : 'down') : undefined
  const magnitude = trend ? trend.value : typeof delta === 'number' ? Math.abs(delta) : undefined
  const isGood = direction ? (goodDirection === 'up' ? direction === 'up' : direction === 'down') : undefined

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-md', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {direction && typeof magnitude === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              isGood ? 'text-success' : 'text-danger'
            )}
          >
            {direction === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {magnitude}
            {deltaLabel ?? '%'}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  )
}
