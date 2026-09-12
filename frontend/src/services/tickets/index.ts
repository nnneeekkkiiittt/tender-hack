import { isDemoMode } from '@/config/env'
import type { TicketRepository } from './TicketRepository'
import { DemoTicketRepository } from './DemoTicketRepository'
import { ApiTicketRepository } from './ApiTicketRepository'

export const ticketRepository: TicketRepository = isDemoMode
  ? new DemoTicketRepository()
  : new ApiTicketRepository()

export type { TicketRepository, CreateTicketPayload, SendMessagePayload } from './TicketRepository'
