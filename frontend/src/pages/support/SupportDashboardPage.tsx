import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import { Tabs } from '@/components/ui/Tabs'
import { TicketTable } from '@/components/tickets/TicketTable'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ticketRepository } from '@/services/tickets'
import { useAuthStore } from '@/store/authStore'
import type { TicketStatus } from '@/types'

const FILTERS: { value: TicketStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'OPEN', label: 'Открытые' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'WAITING_REPLY', label: 'Ожидают ответа' },
  { value: 'RESOLVED', label: 'Решённые' },
]

interface SupportDashboardPageProps {
  mode?: 'all' | 'mine' | 'control'
}

const TITLES: Record<NonNullable<SupportDashboardPageProps['mode']>, { title: string; description: string }> = {
  all: { title: 'Заявки', description: 'Обрабатывайте обращения пользователей' },
  mine: { title: 'Мои заявки', description: 'Заявки, назначенные на вас' },
  control: { title: 'На контроле', description: 'Заявки с высоким приоритетом, требующие внимания' },
}

export function SupportDashboardPage({ mode = 'all' }: SupportDashboardPageProps) {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const { data: tickets, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-tickets', mode, status, search, user?.id],
    queryFn: () =>
      ticketRepository.list({
        status,
        search,
        ownerId: mode === 'mine' ? user?.id : undefined,
        onlyControl: mode === 'control',
      }),
  })

  const { title, description } = TITLES[mode]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Поиск по заявкам..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-80" />
        <Tabs items={FILTERS} value={status} onChange={(v) => setStatus(v as TicketStatus | 'ALL')} />
      </div>

      <div className="mt-5">
        {isLoading && <LoadingState label="Загрузка заявок..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && tickets?.length === 0 && (
          <EmptyState icon={<Inbox className="h-5 w-5" />} title="Заявок пока нет" description="По заданным фильтрам обращений не найдено" />
        )}
        {tickets && tickets.length > 0 && <TicketTable tickets={tickets} basePath="/support/tickets" />}
      </div>
    </div>
  )
}
