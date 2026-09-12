import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Inbox } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Tabs } from '@/components/ui/Tabs'
import { TicketCard } from '@/components/tickets/TicketCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuthStore } from '@/store/authStore'
import { useChatUiStore } from '@/store/chatStore'
import { ticketRepository } from '@/services/tickets'
import type { TicketStatus } from '@/types'

const FILTERS: { value: TicketStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'OPEN', label: 'Открытые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'RESOLVED', label: 'Решённые' },
]

export function UserTicketsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const setPendingQuestion = useChatUiStore((s) => s.setPendingQuestion)
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const { data: tickets, isLoading, isError, refetch } = useQuery({
    queryKey: ['user-tickets', user?.id, status, search],
    queryFn: () => ticketRepository.listByUser(user!.id, { status, search }),
    enabled: !!user,
  })

  const handleCreate = () => {
    setPendingQuestion('__new__')
    navigate('/app')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Мои заявки</h1>
          <p className="mt-1 text-sm text-ink-muted">Здесь вы можете отслеживать статус своих обращений</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={handleCreate}>
          Создать заявку
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={FILTERS} value={status} onChange={(v) => setStatus(v as TicketStatus | 'ALL')} />
        <SearchInput
          placeholder="Поиск по заявкам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:w-72"
        />
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && <LoadingState label="Загрузка заявок..." />}
        {isError && <ErrorState onRetry={() => refetch()} description="Проверьте соединение и попробуйте ещё раз." />}
        {!isLoading && !isError && tickets?.length === 0 && (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Заявок пока нет"
            description="Задайте вопрос ассистенту на главной странице — если он не поможет, вы сможете создать обращение."
            action={
              <Button size="sm" onClick={handleCreate}>
                Задать вопрос
              </Button>
            }
          />
        )}
        {tickets?.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} to={`/tickets/${ticket.id}`} />
        ))}
      </div>
    </div>
  )
}
