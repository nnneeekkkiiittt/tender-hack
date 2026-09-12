import { isDemoMode } from '@/config/env'
import { Pagination } from '@/components/ui/Pagination'
import { QueueFilters } from '@/components/tickets/QueueFilters'
import type { TicketCategory } from '@/types'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import { Tabs } from '@/components/ui/Tabs'
import { TicketTable } from '@/components/tickets/TicketTable'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { listTickets } from '@/services/tickets'
import type { TicketStatus } from '@/types'

const FILTERS: { value: TicketStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'OPEN', label: 'Открытые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'RESOLVED', label: 'Решённые' },
  { value: 'CANCELLED', label: 'Отменённые' },
]

export function AdminTicketsPage() {
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [unassigned, setUnassigned] = useState(false)
  const [operatorId, setOperatorId] = useState('')

  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-tickets', status, search, offset, category, unassigned, operatorId],
    queryFn: () =>
      listTickets({
        status,
        search,
        offset,
        category: category || undefined,
        unassigned,
        ownerId: operatorId || undefined,
      }),
  })

  const tickets = page?.items

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Заявки</h1>
      <p className="mt-1 text-sm text-ink-muted">Все обращения пользователей на платформе</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Поиск по заявкам..."
          value={search}
          onChange={(e) => {
            setOffset(0)
            setSearch(e.target.value)
          }}
          className="sm:w-80"
        />
        <Tabs
          items={FILTERS}
          value={status}
          onChange={(v) => {
            setOffset(0)
            setStatus(v as TicketStatus | 'ALL')
          }}
        />
      </div>

      {!isDemoMode && (
        <QueueFilters
          operatorId={operatorId}
          setOperatorId={(v) => {
            setOffset(0)
            setOperatorId(v)
            setUnassigned(false)
          }}
          category={category}
          setCategory={(v) => {
            setOffset(0)
            setCategory(v)
          }}
          unassigned={unassigned}
          setUnassigned={(v) => {
            setOffset(0)
            setUnassigned(v)
            if (v) setOperatorId('')
          }}
        />
      )}
      <div className="mt-5">
        {isLoading && <LoadingState label="Загрузка заявок..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && tickets?.length === 0 && (
          <EmptyState icon={<Inbox className="h-5 w-5" />} title="Заявок пока нет" />
        )}
        {tickets && tickets.length > 0 && (
          <TicketTable tickets={tickets} basePath="/admin/tickets" />
        )}
      </div>
      {page && <Pagination offset={offset} total={page.total} onChange={setOffset} />}
    </div>
  )
}
