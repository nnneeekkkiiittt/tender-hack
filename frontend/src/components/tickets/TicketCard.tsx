import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Ticket } from '@/types'
import { TicketStatusBadge } from './TicketStatusBadge'
import { formatDate } from '@/lib/utils'

interface TicketCardProps {
  ticket: Ticket
  to: string
}

export function TicketCard({ ticket, to }: TicketCardProps) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-white px-4 py-3.5 transition-colors hover:border-primary-light/50 hover:bg-gray-50/60 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 text-sm font-semibold text-primary">{ticket.number}</span>
          <span className="truncate text-[15px] font-medium text-ink">{ticket.title}</span>
        </div>
        <p className="mt-1 truncate text-sm text-ink-muted">{ticket.description}</p>
        <p className="mt-1.5 text-xs text-ink-muted">{formatDate(ticket.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <TicketStatusBadge status={ticket.status} />
        <ChevronRight className="h-4 w-4 text-ink-muted" />
      </div>
    </Link>
  )
}
