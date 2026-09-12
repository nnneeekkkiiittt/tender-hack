import type { Ticket, TicketFilters, TicketMessage, TicketPriority, TicketStatus } from '@/types'

export interface CreateTicketPayload {
  text: string
  requestId?: string
  category: Ticket['category']
  userId: string
  userName: string
  userOrganization: string
}

export interface SendMessagePayload {
  ticketId: string
  authorId: string
  authorName: string
  authorRole: TicketMessage['authorRole']
  content: string
}

// Contract shared by demo (localStorage) and future API-backed implementations.
export interface TicketRepository {
  list(filters?: TicketFilters): Promise<Ticket[]>
  listByUser(userId: string, filters?: TicketFilters): Promise<Ticket[]>
  getById(id: string): Promise<Ticket | null>
  create(payload: CreateTicketPayload): Promise<Ticket>
  reactToAi(id: string, messageId: string, body: { like: boolean; reasons: string[] }): Promise<void>
  escalate(id: string, expectedLevel: number): Promise<Ticket>
  sendMessage(payload: SendMessagePayload): Promise<Ticket>
  updateStatus(id: string, status: TicketStatus): Promise<Ticket>
  updatePriority(id: string, priority: TicketPriority): Promise<Ticket>
  assign(id: string, supportId: string, supportName: string): Promise<Ticket>
}
