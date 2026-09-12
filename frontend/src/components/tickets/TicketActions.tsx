import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/contracts'
import { listAssignableEmployees } from '@/services/employees'
import { ticketRepository } from '@/services/tickets'
import { invalidateTickets } from '@/services/tickets/cache'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TICKET_CATEGORY_LABEL } from '@/lib/utils'
import type { Ticket, TicketCategory } from '@/types'

export function TicketActions({ ticket }: { ticket: Ticket }) {
  const user = useAuthStore((s) => s.user)!
  const cache = useQueryClient()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [operator, setOperator] = useState(ticket.supportId || '')
  const active = ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'
  const admin = user.role === 'ADMIN',
    owner = user.id === ticket.userId
  const tierMatches = user.role === 'SUPPORT' && user.supportLevel === ticket.handlingLevel
  const assigned = tierMatches && user.id === ticket.supportId
  const human = (ticket.handlingLevel ?? 1) > 0
  const employees = useQuery({
    queryKey: ['assignment-employees'],
    enabled: admin && active && human,
    queryFn: listAssignableEmployees,
  })
  const run = async (path: string, body: unknown) => {
    setBusy(true)
    setError('')
    try {
      if (path === '/escalate') await ticketRepository.escalate(ticket.id, ticket.handlingLevel!)
      else await api('/tickets/' + ticket.id + path, 'PATCH', body)
      await invalidateTickets(cache, ticket.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p aria-label="Уровень обработки" className="font-medium text-primary">
        {human ? `Поддержка L${ticket.handlingLevel}` : 'AI'}
        {human && active && !ticket.supportId ? ' · Ожидает сотрудника' : ''}
      </p>
      {!active && <p className="text-ink-muted">Обращение закрыто. История доступна для чтения.</p>}
      {active && owner && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          loading={busy}
          onClick={() => {
            if (confirm('Отменить обращение?')) void run('/status', { status: 'CANCELLED' })
          }}
        >
          Отменить обращение
        </Button>
      )}
      {active && tierMatches && !ticket.supportId && (
        <Button
          size="sm"
          className="w-full"
          loading={busy}
          onClick={() => void run('/assign', { operator_id: user.id })}
        >
          Взять в работу
        </Button>
      )}
      {active && human && admin && (
        <>
          <label className="block">
            Сотрудник
            <select
              aria-label="Сотрудник"
              className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            >
              <option value="">Выберите сотрудника</option>
              {employees.data
                ?.filter((e) => e.role === `supportL${ticket.handlingLevel}`)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.role.replace('support', '')}
                  </option>
                ))}
            </select>
          </label>
          <Button
            size="sm"
            className="w-full"
            disabled={
              !employees.data?.some(
                (e) => e.id === operator && e.role === `supportL${ticket.handlingLevel}`,
              )
            }
            loading={busy}
            onClick={() => void run('/assign', { operator_id: operator })}
          >
            Назначить сотрудника
          </Button>
          {employees.isError && <p role="alert">Не удалось загрузить сотрудников</p>}
        </>
      )}
      {active && human && (admin || assigned) && (
        <Classification
          key={ticket.id + ticket.category + ticket.subtopic}
          ticket={ticket}
          busy={busy}
          save={(body) => void run('/classification', body)}
        />
      )}
      {ticket.status === 'IN_PROGRESS' && (admin || assigned) && (
        <Button
          size="sm"
          className="w-full"
          loading={busy}
          onClick={() => void run('/status', { status: 'DONE' })}
        >
          Отметить решённым
        </Button>
      )}
      {active && assigned && ticket.handlingLevel! < 3 && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          loading={busy}
          onClick={() => void run('/escalate', {})}
        >
          Эскалировать
        </Button>
      )}
      {error && (
        <p role="alert" className="text-accent">
          {error}
        </p>
      )}
    </div>
  )
}

function Classification({
  ticket,
  busy,
  save,
}: {
  ticket: Ticket
  busy: boolean
  save: (body: unknown) => void
}) {
  const [topic, setTopic] = useState<TicketCategory>(ticket.category),
    [subtopic, setSubtopic] = useState(ticket.subtopic || '')
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        save({ topic, subtopic })
      }}
    >
      <label className="block">
        Категория
        <select
          aria-label="Категория"
          value={topic}
          onChange={(e) => setTopic(e.target.value as TicketCategory)}
          className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2"
        >
          {Object.entries(TICKET_CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <Input
        name="subtopic"
        label="Подкатегория"
        maxLength={255}
        value={subtopic}
        onChange={(e) => setSubtopic(e.target.value)}
      />
      <Button size="sm" variant="outline" className="w-full" type="submit" loading={busy}>
        Сохранить категорию
      </Button>
    </form>
  )
}
