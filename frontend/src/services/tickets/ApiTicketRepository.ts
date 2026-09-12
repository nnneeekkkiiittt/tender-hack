import type { TicketRepository, CreateTicketPayload, SendMessagePayload } from './TicketRepository'
import type { Ticket, TicketFilters, TicketPriority, TicketStatus } from '@/types'
import { apiClient } from '@/api/client'

// Placeholder for the real backend integration.
export class ApiTicketRepository implements TicketRepository {
  async list(filters?: TicketFilters): Promise<Ticket[]> {
    return apiClient.get<Ticket[]>('/tickets', filters as Record<string, unknown>)
  }

  async listByUser(userId: string, filters?: TicketFilters): Promise<Ticket[]> {
    return apiClient.get<Ticket[]>(`/users/${userId}/tickets`, filters as Record<string, unknown>)
  }

  async getById(id: string): Promise<Ticket | null> {
    return apiClient.get<Ticket | null>(`/tickets/${id}`)
  }

  async create(payload: CreateTicketPayload): Promise<Ticket> {
    return apiClient.post<Ticket>('/tickets', payload)
  }

  async sendMessage(payload: SendMessagePayload): Promise<Ticket> {
    return apiClient.post<Ticket>(`/tickets/${payload.ticketId}/messages`, payload)
  }

  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return apiClient.patch<Ticket>(`/tickets/${id}/status`, { status })
  }

  async updatePriority(id: string, priority: TicketPriority): Promise<Ticket> {
    return apiClient.patch<Ticket>(`/tickets/${id}/priority`, { priority })
  }

  async assign(id: string, supportId: string, supportName: string): Promise<Ticket> {
    return apiClient.patch<Ticket>(`/tickets/${id}/assign`, { supportId, supportName })
  }
}
