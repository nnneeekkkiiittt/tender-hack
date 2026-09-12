import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { BacklogSnapshot, TrendValue } from '@/types'
import { cn } from '@/lib/utils'

interface BacklogCardProps {
  backlog: BacklogSnapshot
  trend?: TrendValue
}

export function BacklogCard({ backlog, trend }: BacklogCardProps) {
  const items: { label: string; value: number; danger?: boolean }[] = [
    { label: 'Всего активных', value: backlog.active },
    { label: 'Новые', value: backlog.new },
    { label: 'В работе', value: backlog.inProgress },
    { label: 'Ожидают ответа', value: backlog.waitingReply },
    { label: 'Просрочены', value: backlog.overdue, danger: true },
  ]

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Текущий backlog</h2>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'down' ? 'text-success' : 'text-danger'
            )}
          >
            {trend.direction === 'down' ? '↓' : '↑'} {trend.value}%
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label}>
            <p className={cn('flex items-center gap-1 text-xl font-semibold tracking-tight', item.danger ? 'text-accent' : 'text-ink')}>
              {item.danger && <AlertTriangle className="h-4 w-4" />}
              {item.value.toLocaleString('ru-RU')}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
