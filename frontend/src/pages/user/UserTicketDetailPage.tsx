import { ReactionForm } from '@/components/tickets/ReactionForm'
import { invalidateTickets } from '@/services/tickets/cache'
import { OperatorFeedback } from '@/components/tickets/OperatorFeedback'
import { isDemoMode } from '@/config/env'
import { TicketActions } from '@/components/tickets/TicketActions'
import { OlderMessages } from '@/components/tickets/OlderMessages'
import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles, Paperclip } from 'lucide-react'
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge'
import { PriorityBadge } from '@/components/tickets/PriorityBadge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Avatar } from '@/components/ui/Avatar'
import { ChatInput } from '@/components/chat/ChatInput'
import { ticketRepository } from '@/services/tickets'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatShortDate, TICKET_CATEGORY_LABEL } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function UserTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketRepository.getById(id!),
    enabled: !!id,
    refetchInterval: 5000,
  })

  const handleSend = async (text: string) => {
    if (!ticket || !user) return false
    setSending(true)
    setError('')
    try {
      await ticketRepository.sendMessage({
        ticketId: ticket.id,
        authorId: user.id,
        authorName: user.name,
        authorRole: 'USER',
        content: text,
      })
      await invalidateTickets(queryClient, ticket.id)
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setSending(false)
    }
  }

  if (isLoading) return <LoadingState label="Загрузка заявки..." />
  if (isError || !ticket) return <ErrorState title="Заявка не найдена" onRetry={() => refetch()} />

  return (
    <div className="mx-auto max-w-6xl animate-fade-in-up px-4 py-6 sm:px-6">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />К списку заявок
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-ink">
          <span className="text-primary">{ticket.number}</span> {ticket.title}
        </h1>
        <TicketStatusBadge status={ticket.status} />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-lg border border-border bg-white">
          <div className="flex flex-col gap-5 p-5">
            {ticket.messages.length === 0 && (
              <p className="text-sm text-ink-muted">Сообщений пока нет.</p>
            )}
            {!isDemoMode && <OlderMessages ticket={ticket} />}
            {ticket.messages.map((message) => {
              const isUser = message.authorRole === 'USER'
              const isAi = message.authorRole === 'AI'
              if (message.authorRole === 'SYSTEM')
                return (
                  <p key={message.id} className="text-center text-xs text-ink-muted">
                    {message.content}
                  </p>
                )
              return (
                <div key={message.id} className={cn('flex animate-fade-in-up gap-3', isUser && 'flex-row-reverse')}>
                  {!isAi && (
                    <Avatar
                      name={message.authorName}
                      size="sm"
                      tone={isUser ? 'primary' : 'accent'}
                    />
                  )}
                  {isAi && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  )}
                  <div className={cn('max-w-[80%]', isUser && 'text-right')}>
                    <div
                      className={cn(
                        'mb-1 flex items-center gap-2 text-xs text-ink-muted',
                        isUser && 'justify-end',
                      )}
                    >
                      <span className="font-medium text-ink">
                        {isAi ? 'AI-ассистент' : message.authorName}
                      </span>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    <div
                      className={cn(
                        'inline-block whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed',
                        isUser
                          ? 'bg-primary text-white'
                          : isAi
                            ? 'bg-primary/5 text-ink'
                            : 'bg-gray-100 text-ink',
                      )}
                    >
                      {message.content}
                    </div>
                    {isAi &&
                      message.sources?.map((source, index) => (
                        <p key={index} className="mt-2 break-words text-xs text-ink-muted">
                          [{index + 1}] {source}
                        </p>
                      ))}
                    {isAi && (
                      <section aria-label="Оценка ответа AI">
                        <ReactionForm
                          key={message.id + JSON.stringify(message.reaction)}
                          initial={message.reaction}
                          disabled={ticket.status !== 'OPEN' && ticket.status !== 'IN_PROGRESS'}
                          onSave={async (body) => {
                            await ticketRepository.reactToAi(ticket.id, message.id, body)
                            await invalidateTickets(queryClient, ticket.id)
                          }}
                        />
                      </section>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((att) => (
                          <span
                            key={att.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-gray-50 px-2.5 py-1.5 text-xs text-ink-muted"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.name} · {att.sizeKb} КБ
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {(ticket.status === 'OPEN' ||
            ticket.status === 'IN_PROGRESS' ||
            (isDemoMode && ticket.status === 'WAITING_REPLY')) && (
            <div className="border-t border-border p-4">
              {ticket.handlingLevel === 0 && (
                <p className="mb-3 text-xs text-ink-muted">
                  Любое следующее сообщение передаст этот чат поддержке L1.
                </p>
              )}
              <ChatInput
                onSend={handleSend}
                disabled={sending}
                placeholder="Написать сообщение..."
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Информация о заявке</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Статус">
                <TicketStatusBadge status={ticket.status} />
              </Row>
              {ticket.priority && (
                <Row label="Приоритет">
                  <PriorityBadge priority={ticket.priority} />
                </Row>
              )}
              <Row label="Категория" value={TICKET_CATEGORY_LABEL[ticket.category]} />
              <Row label="Дата создания" value={formatShortDate(ticket.createdAt)} />
              <Row label="Дата обновления" value={formatShortDate(ticket.updatedAt)} />
              <Row label="Сотрудник поддержки" value={ticket.supportName ?? '—'} />
              {ticket.subtopic && <Row label="Подкатегория" value={ticket.subtopic} />}
            </dl>
            {!isDemoMode && <TicketActions ticket={ticket} />}
          </div>
          {!isDemoMode && ticket.status === 'RESOLVED' && <OperatorFeedback ticket={ticket} />}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{children ?? value}</dd>
    </div>
  )
}
