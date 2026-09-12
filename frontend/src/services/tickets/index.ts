import { isDemoMode } from '@/config/env'
import type { TicketRepository } from './TicketRepository'
import { DemoTicketRepository } from './DemoTicketRepository'
import { ApiTicketRepository } from './ApiTicketRepository'

export const ticketRepository: TicketRepository = isDemoMode
  ? new DemoTicketRepository()
  : new ApiTicketRepository()

export type { TicketRepository, CreateTicketPayload, SendMessagePayload } from './TicketRepository'

import type { TicketFilters } from '@/types'
export async function listTickets(filters: TicketFilters = {}, userId?: string) {
  if (!isDemoMode) return new ApiTicketRepository().listPage(filters)
  const items = userId
    ? await ticketRepository.listByUser(userId, filters)
    : await ticketRepository.list(filters)
  const offset = filters.offset || 0,
    limit = filters.limit || 20
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit }
}
