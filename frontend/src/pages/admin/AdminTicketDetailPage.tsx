import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge'
import { PriorityBadge } from '@/components/tickets/PriorityBadge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Avatar } from '@/components/ui/Avatar'
import { ticketRepository } from '@/services/tickets'
import { formatDate, formatShortDate, TICKET_CATEGORY_LABEL, cn } from '@/lib/utils'

export function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketRepository.getById(id!),
    enabled: !!id,
  })

  if (isLoading) return <LoadingState label="Загрузка заявки..." />
  if (isError || !ticket) return <ErrorState title="Заявка не найдена" onRetry={() => refetch()} />

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link to="/admin/tickets" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />К списку заявок
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-ink">
          <span className="text-primary">{ticket.number}</span> {ticket.title}
        </h1>
        <PriorityBadge priority={ticket.priority} withLabelPrefix />
        <TicketStatusBadge status={ticket.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5 rounded-lg border border-border bg-white p-5">
          {ticket.messages.map((message) => {
            const isAi = message.authorRole === 'AI'
            return (
              <div key={message.id} className="flex gap-3">
                {isAi ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </span>
                ) : (
                  <Avatar name={message.authorName} size="sm" tone={message.authorRole === 'SUPPORT' ? 'accent' : 'primary'} />
                )}
                <div className="max-w-[85%]">
                  <div className="mb-1 flex items-center gap-2 text-xs text-ink-muted">
                    <span className="font-medium text-ink">{isAi ? 'AI-ассистент' : message.authorName}</span>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                  <div className={cn('inline-block whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed', isAi ? 'bg-primary/5 text-ink' : 'bg-gray-100 text-ink')}>
                    {message.content}
                  </div>
                </div>
              </div>
            )
          })}
          {ticket.messages.length === 0 && <p className="text-sm text-ink-muted">Сообщений пока нет.</p>}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-5 text-sm">
            <h2 className="text-sm font-semibold text-ink">Информация о заявке</h2>
            <div className="mt-3 space-y-2.5">
              <Row label="Категория" value={TICKET_CATEGORY_LABEL[ticket.category]} />
              <Row label="Создана" value={formatShortDate(ticket.createdAt)} />
              <Row label="Обновлена" value={formatShortDate(ticket.updatedAt)} />
              <Row label="Сотрудник" value={ticket.supportName ?? '—'} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-white p-5 text-sm">
            <h2 className="text-sm font-semibold text-ink">Пользователь</h2>
            <p className="mt-2 font-medium text-ink">{ticket.userOrganization}</p>
            <p className="text-ink-muted">{ticket.userName}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}
