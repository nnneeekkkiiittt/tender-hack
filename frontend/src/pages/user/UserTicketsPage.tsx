import { isDemoMode } from '@/config/env'
import { Pagination } from '@/components/ui/Pagination'
import { QueueFilters } from '@/components/tickets/QueueFilters'
import type { TicketCategory } from '@/types'
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
import { listTickets } from '@/services/tickets'
import type { TicketStatus } from '@/types'

const FILTERS: { value: TicketStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'OPEN', label: 'Открытые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'RESOLVED', label: 'Решённые' },
  { value: 'CANCELLED', label: 'Отменённые' },
]

export function UserTicketsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const setPendingQuestion = useChatUiStore((s) => s.setPendingQuestion)
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [category, setCategory] = useState<TicketCategory | ''>('')

  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['user-tickets', user?.id, status, search, offset, category],
    queryFn: () =>
      listTickets({ status, search, offset, category: category || undefined }, user?.id),
    enabled: !!user,
  })

  const handleCreate = () => {
    if (!isDemoMode) {
      navigate('/app')
      return
    }
    setPendingQuestion('__new__')
    navigate('/app')
  }

  const tickets = page?.items

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Мои заявки</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Здесь вы можете отслеживать статус своих обращений
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={handleCreate}>
          Создать заявку
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={FILTERS}
          value={status}
          onChange={(v) => {
            setOffset(0)
            setStatus(v as TicketStatus | 'ALL')
          }}
        />
        <SearchInput
          placeholder="Поиск по заявкам..."
          value={search}
          onChange={(e) => {
            setOffset(0)
            setSearch(e.target.value)
          }}
          className="sm:w-72"
        />
      </div>

      {!isDemoMode && (
        <QueueFilters
          category={category}
          setCategory={(v) => {
            setOffset(0)
            setCategory(v)
          }}
        />
      )}
      <div className="mt-5 space-y-3">
        {isLoading && <LoadingState label="Загрузка заявок..." />}
        {isError && (
          <ErrorState
            onRetry={() => refetch()}
            description="Проверьте соединение и попробуйте ещё раз."
          />
        )}
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
      {page && <Pagination offset={offset} total={page.total} onChange={setOffset} />}
    </div>
  )
}
