import React from 'react'
import { TICKET_PRIORITY_LABEL } from '@/lib/utils'
import type { TicketPriority } from '@/types'
import { cn } from '@/lib/utils'

const DOT_COLOR: Record<TicketPriority, string> = {
  LOW: 'bg-success',
  MEDIUM: 'bg-warning',
  HIGH: 'bg-danger',
}

const TEXT_COLOR: Record<TicketPriority, string> = {
  LOW: 'text-success',
  MEDIUM: 'text-warning',
  HIGH: 'text-danger',
}

export function PriorityBadge({ priority, withLabelPrefix }: { priority: TicketPriority; withLabelPrefix?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', TEXT_COLOR[priority])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLOR[priority])} aria-hidden />
      {withLabelPrefix ? `${TICKET_PRIORITY_LABEL[priority]} приоритет` : TICKET_PRIORITY_LABEL[priority]}
    </span>
  )
}
