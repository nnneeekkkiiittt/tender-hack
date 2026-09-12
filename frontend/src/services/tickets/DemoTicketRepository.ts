import type { TicketRepository, CreateTicketPayload, SendMessagePayload } from './TicketRepository'
import type { Ticket, TicketFilters, TicketMessage, TicketPriority, TicketStatus } from '@/types'
import { INITIAL_TICKETS } from '@/mock/tickets.mock'
import { demoStorage, DEMO_STORAGE_KEYS } from '@/lib/storage'
import { generateId } from '@/lib/utils'

const DELAY = 300
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function loadAll(): Ticket[] {
  return demoStorage.get<Ticket[]>(DEMO_STORAGE_KEYS.tickets, INITIAL_TICKETS)
}

function saveAll(tickets: Ticket[]) {
  demoStorage.set(DEMO_STORAGE_KEYS.tickets, tickets)
}

function nextTicketNumber(tickets: Ticket[]): string {
  const max = tickets.reduce((acc, t) => {
    const n = parseInt(t.number.replace('#', ''), 10)
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 1248)
  return `#${max + 1}`
}

function applyFilters(tickets: Ticket[], filters?: TicketFilters): Ticket[] {
  let result = tickets
  if (filters?.status && filters.status !== 'ALL') {
    result = result.filter((t) => t.status === filters.status)
  }
  if (filters?.ownerId) {
    result = result.filter((t) => t.supportId === filters.ownerId)
  }
  if (filters?.onlyControl) {
    result = result.filter((t) => t.priority === 'HIGH' && t.status !== 'RESOLVED' && t.status !== 'CLOSED')
  }
  if (filters?.search) {
    const q = filters.search.trim().toLowerCase()
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.number.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        t.userOrganization.toLowerCase().includes(q)
    )
  }
  return [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export class DemoTicketRepository implements TicketRepository {
  async list(filters?: TicketFilters): Promise<Ticket[]> {
    await wait(DELAY)
    return applyFilters(loadAll(), filters)
  }

  async listByUser(userId: string, filters?: TicketFilters): Promise<Ticket[]> {
    await wait(DELAY)
    const mine = loadAll().filter((t) => t.userId === userId)
    return applyFilters(mine, filters)
  }

  async getById(id: string): Promise<Ticket | null> {
    await wait(200)
    return loadAll().find((t) => t.id === id) ?? null
  }

  async create(payload: CreateTicketPayload): Promise<Ticket> {
    await wait(DELAY)
    const tickets = loadAll()
    const nowIso = new Date().toISOString()
    // Explicit annotation gives the object literal below a contextual type,
    // so `authorRole` is checked against MessageAuthorRole directly instead
    // of widening to `string` (which `as const` on a ternary does not fix).
    const messages: TicketMessage[] = (payload.originMessages ?? []).map((m) => ({
      id: generateId('msg'),
      ticketId: '',
      authorId: m.role === 'user' ? payload.userId : 'ai',
      authorName: m.role === 'user' ? payload.userName : 'AI',
      authorRole: m.role === 'user' ? 'USER' : 'AI',
      content: m.content,
      createdAt: nowIso,
    }))

    const ticket: Ticket = {
      id: generateId('tkt'),
      number: nextTicketNumber(tickets),
      title: payload.title,
      description: payload.description,
      status: 'OPEN',
      priority: 'MEDIUM',
      category: payload.category,
      userId: payload.userId,
      userName: payload.userName,
      userOrganization: payload.userOrganization,
      createdAt: nowIso,
      updatedAt: nowIso,
      messages: messages.map((m) => ({ ...m, ticketId: '' })),
    }
    ticket.messages = ticket.messages.map((m) => ({ ...m, ticketId: ticket.id }))

    const updated = [ticket, ...tickets]
    saveAll(updated)
    return ticket
  }

  async sendMessage(payload: SendMessagePayload): Promise<Ticket> {
    await wait(250)
    const tickets = loadAll()
    const idx = tickets.findIndex((t) => t.id === payload.ticketId)
    if (idx === -1) throw new Error('Ticket not found')

    const message = {
      id: generateId('msg'),
      ticketId: payload.ticketId,
      authorId: payload.authorId,
      authorName: payload.authorName,
      authorRole: payload.authorRole,
      content: payload.content,
      createdAt: new Date().toISOString(),
    }

    const nowIso = new Date().toISOString()
    const updatedTicket: Ticket = {
      ...tickets[idx],
      messages: [...tickets[idx].messages, message],
      updatedAt: nowIso,
      status: payload.authorRole === 'SUPPORT' && tickets[idx].status === 'OPEN' ? 'IN_PROGRESS' : tickets[idx].status,
    }

    tickets[idx] = updatedTicket
    saveAll(tickets)
    return updatedTicket
  }

  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    await wait(200)
    const tickets = loadAll()
    const idx = tickets.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Ticket not found')
    tickets[idx] = { ...tickets[idx], status, updatedAt: new Date().toISOString() }
    saveAll(tickets)
    return tickets[idx]
  }

  async updatePriority(id: string, priority: TicketPriority): Promise<Ticket> {
    await wait(200)
    const tickets = loadAll()
    const idx = tickets.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Ticket not found')
    tickets[idx] = { ...tickets[idx], priority, updatedAt: new Date().toISOString() }
    saveAll(tickets)
    return tickets[idx]
  }

  async assign(id: string, supportId: string, supportName: string): Promise<Ticket> {
    await wait(200)
    const tickets = loadAll()
    const idx = tickets.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Ticket not found')
    tickets[idx] = { ...tickets[idx], supportId, supportName, updatedAt: new Date().toISOString() }
    saveAll(tickets)
    return tickets[idx]
  }
}
