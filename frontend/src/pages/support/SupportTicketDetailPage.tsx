import { isDemoMode } from '@/config/env'
import { TicketActions } from '@/components/tickets/TicketActions'
import { OlderMessages } from '@/components/tickets/OlderMessages'
import { invalidateTickets } from '@/services/tickets/cache'
import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
// (single react-query import; second call below reuses the same hook)
import { ArrowLeft, Sparkles, Paperclip, Lightbulb } from 'lucide-react'
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge'
import { PriorityBadge } from '@/components/tickets/PriorityBadge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ChatInput } from '@/components/chat/ChatInput'
import { ticketRepository } from '@/services/tickets'
import { userRepository } from '@/services/users'
import { useAuthStore } from '@/store/authStore'
import {
  formatDate,
  formatShortDate,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_PRIORITY_LABEL,
  cn,
} from '@/lib/utils'
import type { TicketPriority, TicketStatus } from '@/types'

const STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_REPLY',
  'RESOLVED',
  'CLOSED',
]
const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH']

function aiSummaryFor(description: string): string {
  return `Проблема может быть связана с превышением допустимого размера файла или временной недоступностью сервиса. Рекомендуется уточнить у пользователя формат и размер вложения, а также проверить журнал ошибок загрузки за последний час.\n\nИсходный запрос: «${description}»`
}

export function SupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

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

  const { data: supplier } = useQuery({
    queryKey: ['supplier', ticket?.userId],
    queryFn: () => userRepository.getById(ticket!.userId),
    enabled: isDemoMode && !!ticket?.userId,
  })

  const invalidate = () => invalidateTickets(queryClient, id)

  const handleSend = async (text: string) => {
    if (!ticket || !user) return
    setSending(true)
    setError('')
    try {
      await ticketRepository.sendMessage({
        ticketId: ticket.id,
        authorId: user.id,
        authorName: user.name,
        authorRole: 'SUPPORT',
        content: text,
      })
      if (isDemoMode && !ticket.supportId) {
        await ticketRepository.assign(ticket.id, user.id, user.name)
      }
      await invalidate()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: TicketStatus) => {
    if (!ticket) return
    await ticketRepository.updateStatus(ticket.id, status)
    await invalidate()
  }

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!ticket) return
    await ticketRepository.updatePriority(ticket.id, priority)
    await invalidate()
  }

  const handleClose = async () => {
    if (!ticket) return
    await ticketRepository.updateStatus(ticket.id, 'CLOSED')
    await invalidate()
  }

  if (isLoading) return <LoadingState label="Загрузка заявки..." />
  if (isError || !ticket) return <ErrorState title="Заявка не найдена" onRetry={() => refetch()} />

  const hasAiMessage = ticket.messages.some((m) => m.isAiAnalysis)
  const mlContext = ticket.messages.find((m) => m.mlContext)?.mlContext

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        to="/support"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />К списку заявок
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-ink">
          <span className="text-primary">{ticket.number}</span> {ticket.title}
        </h1>
        {ticket.priority && <PriorityBadge priority={ticket.priority} withLabelPrefix />}
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
            {!isDemoMode && <OlderMessages ticket={ticket} />}
            {ticket.messages.map((message) => {
              const isAi = message.authorRole === 'AI'
              const isSupport = message.authorRole === 'SUPPORT'

              if (message.isAiAnalysis || isAi) {
                return (
                  <div
                    key={message.id}
                    className="rounded-lg border border-primary/20 bg-primary/5 p-4"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Lightbulb className="h-4 w-4" />
                      {isDemoMode ? 'Краткий анализ' : 'Ответ AI'}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {message.content}
                    </p>
                  </div>
                )
              }

              return (
                <div key={message.id} className={cn('flex gap-3', isSupport && 'flex-row-reverse')}>
                  <Avatar
                    name={message.authorName}
                    size="sm"
                    tone={isSupport ? 'accent' : 'primary'}
                  />
                  <div className={cn('max-w-[80%]', isSupport && 'text-right')}>
                    <div
                      className={cn(
                        'mb-1 flex items-center gap-2 text-xs text-ink-muted',
                        isSupport && 'justify-end',
                      )}
                    >
                      <span className="font-medium text-ink">{message.authorName}</span>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    <div
                      className={cn(
                        'inline-block whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed',
                        isSupport ? 'bg-primary text-white' : 'bg-gray-100 text-ink',
                      )}
                    >
                      {message.content}
                    </div>
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

            {isDemoMode && !hasAiMessage && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  Краткий анализ
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {aiSummaryFor(ticket.description)}
                </p>
              </div>
            )}
          </div>

          {(isDemoMode
            ? ticket.status !== 'CLOSED'
            : (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') &&
              (!ticket.supportId || ticket.supportId === user?.id) &&
              (isDemoMode || user?.supportLevel === ticket.handlingLevel)) && (
            <div className="border-t border-border p-4">
              <ChatInput
                onSend={handleSend}
                disabled={sending}
                placeholder="Написать ответ пользователю..."
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {mlContext && (
            <section aria-label="Контекст AI" className="rounded-lg border border-primary/20 bg-primary/5 p-5">
              <h2 className="text-sm font-semibold text-primary">Контекст AI</h2>
              <p className="mt-2 text-sm">{mlContext.topic}{mlContext.subtopic ? ` · ${mlContext.subtopic}` : ''}</p>
              <p className="mt-1 text-xs text-ink-muted">Первичная классификация: {mlContext.classified_line}</p>
              {mlContext.escalation_reason && <p className="mt-2 text-sm">{mlContext.escalation_reason}</p>}
              {mlContext.sources_found.map((source, index) => (
                <p key={index} className="mt-2 text-xs text-ink-muted">
                  [{index + 1}] {source.doc_name}{source.breadcrumb ? ` → ${source.breadcrumb}` : ''}
                  {source.page != null ? ` · стр. ${source.page}${source.page_end && source.page_end !== source.page ? `–${source.page_end}` : ''}` : ''}
                </p>
              ))}
            </section>
          )}
          <div className="rounded-lg border border-border bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Информация о заявке</h2>
            <div className="mt-3 space-y-3 text-sm">
              {isDemoMode && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Статус</label>
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                      className="h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {TICKET_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">Приоритет</label>
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                      className="h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>
                          {TICKET_PRIORITY_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <Row label="Сотрудник" value={ticket.supportName || '—'} />
              {ticket.subtopic && <Row label="Подкатегория" value={ticket.subtopic} />}
              <Row label="Категория" value={TICKET_CATEGORY_LABEL[ticket.category]} />
              <Row label="Создана" value={formatShortDate(ticket.createdAt)} />
              <Row label="Обновлена" value={formatShortDate(ticket.updatedAt)} />
            </div>
            {!isDemoMode && <TicketActions ticket={ticket} />}
            {isDemoMode && ticket.status !== 'CLOSED' && (
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={handleClose}>
                Закрыть заявку
              </Button>
            )}
          </div>

          {!isDemoMode && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Пользователь</h2>
              <p className="mt-2 text-sm">{ticket.userName}</p>
            </div>
          )}
          {isDemoMode && (
            <div className="rounded-lg border border-border bg-white p-5">
              <h2 className="text-sm font-semibold text-ink">Пользователь</h2>
              <p className="mt-2 text-[15px] font-medium text-ink">{ticket.userOrganization}</p>
              <div className="mt-2 space-y-1.5 text-sm">
                <Row label="ИНН" value={supplier?.inn ?? '—'} />
                <Row label="Email" value={supplier?.email ?? '—'} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setProfileOpen(true)}
              >
                Открыть профиль
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={ticket.userOrganization || ticket.userName}
        size="sm"
      >
        {supplier ? (
          <div className="space-y-2.5 text-sm">
            <Row label="Контакт" value={supplier.name} />
            <Row label="ИНН" value={supplier.inn || '—'} />
            <Row label="Email" value={supplier.email || '—'} />
            <Row label="Телефон" value={supplier.phone ?? '—'} />
            <Row label="Заявок всего" value={String(supplier.ticketsCount)} />
          </div>
        ) : (
          <LoadingState compact label="Загрузка профиля..." />
        )}
      </Modal>
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
