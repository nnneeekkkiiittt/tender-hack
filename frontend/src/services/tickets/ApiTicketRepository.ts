import type { TicketRepository, CreateTicketPayload, SendMessagePayload } from './TicketRepository'
import type { Ticket, TicketFilters, TicketStatus, TicketMessage } from '@/types'
import {
  api,
  type Ticket as RawTicket,
  type Message,
  type MessagePage,
  type Page,
  type Status,
} from '@/api/contracts'
const statusMap: Record<Status, TicketStatus> = {
  NEW: 'OPEN',
  'IN WORK': 'IN_PROGRESS',
  DONE: 'RESOLVED',
  CANCELLED: 'CANCELLED',
}
export const adaptMessage = (m: Message, id: string): TicketMessage => ({
  id: m.id,
  ticketId: id,
  authorId: m.author_id || '',
  authorName: m.author_name || m.author_kind,
  authorRole: m.author_kind as TicketMessage['authorRole'],
  content: m.text,
  createdAt: m.sent_at,
  sources: m.sources,
  disliked: m.disliked,
  liked: m.liked,
  reaction: m.reaction,
  mlContext: m.ml_context,
})
const adapt = (t: RawTicket): Ticket => ({
  id: t.id,
  handlingLevel: t.handling_level,
  number: '#' + t.id,
  title: t.title,
  description: '',
  status: statusMap[t.status],
  category: t.topic,
  userId: t.author_id,
  userName: t.author_name,
  supportId: t.operator_id || undefined,
  supportName: t.operator_name || undefined,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
  subtopic: t.subtopic || undefined,
  messages: [],
})
export class ApiTicketRepository implements TicketRepository {
  async listPage(f: TicketFilters = {}): Promise<Page<Ticket>> {
    const status = Object.entries(statusMap).find(([, value]) => value === f.status)?.[0]
    const page = await api<Page<RawTicket>>('/tickets', 'GET', undefined, {
      status,
      search: f.search,
      operator_id: f.ownerId,
      unassigned: f.unassigned,
      topic: f.category,
      offset: f.offset || 0,
      limit: f.limit || 20,
    })
    return { ...page, items: page.items.map(adapt) }
  }
  async list(f?: TicketFilters) {
    return (await this.listPage(f)).items
  }
  async listByUser(_id: string, f?: TicketFilters) {
    return this.list(f)
  }
  async getById(id: string) {
    const [raw, messages] = await Promise.all([
      api<RawTicket>('/tickets/' + id),
      api<MessagePage>('/tickets/' + id + '/messages'),
    ])
    return {
      ...adapt(raw),
      messages: messages.items.map((m) => adaptMessage(m, id)),
      nextBefore: messages.next_before,
    }
  }
  async create(p: CreateTicketPayload) {
    return adapt(
      await api<RawTicket>('/tickets', 'POST', {
        text: p.text,
        request_id: p.requestId,
        topic: p.category,
      }),
    )
  }
  async reactToAi(
    id: string,
    messageId: string,
    body: { like: boolean; reasons: string[] },
  ): Promise<void> {
    await api('/tickets/' + id + '/messages/' + messageId + '/feedback', 'PUT', body)
  }
  async escalate(id: string, expectedLevel: number) {
    return adapt(
      await api<RawTicket>('/tickets/' + id + '/escalate', 'POST', {
        expected_level: expectedLevel,
      }),
    )
  }
  async sendMessage(p: SendMessagePayload) {
    return adapt(
      await api<RawTicket>('/tickets/' + p.ticketId + '/messages', 'POST', { text: p.content }),
    )
  }
  async updateStatus(id: string, status: TicketStatus) {
    if (status !== 'RESOLVED' && status !== 'CANCELLED')
      throw new Error('Недопустимый переход статуса')
    return adapt(
      await api<RawTicket>('/tickets/' + id + '/status', 'PATCH', {
        status: status === 'RESOLVED' ? 'DONE' : 'CANCELLED',
      }),
    )
  }
  async updatePriority(): Promise<Ticket> {
    throw new Error('Приоритеты недоступны')
  }
  async assign(id: string, supportId: string) {
    return adapt(
      await api<RawTicket>('/tickets/' + id + '/assign', 'PATCH', { operator_id: supportId }),
    )
  }
}
