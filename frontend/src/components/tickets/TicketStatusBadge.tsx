import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { TICKET_STATUS_LABEL } from '@/lib/utils'
import type { TicketStatus } from '@/types'

const TONE: Record<TicketStatus, 'info' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'info',
  WAITING_REPLY: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge tone={TONE[status]} dot>
      {TICKET_STATUS_LABEL[status]}
    </Badge>
  )
}
