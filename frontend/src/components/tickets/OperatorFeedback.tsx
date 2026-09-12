import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Rating } from '@/api/contracts'
import { ReactionForm } from './ReactionForm'
import { ErrorState } from '@/components/ui/ErrorState'
import type { Ticket } from '@/types'
export function OperatorFeedback({ ticket }: { ticket: Ticket }) {
  const cache = useQueryClient()
  const query = useQuery({
    queryKey: ['feedback', ticket.id],
    queryFn: () => api<Rating | null>('/tickets/' + ticket.id + '/feedback'),
  })
  return (
    <section
      aria-label="Оценка работы сотрудника"
      className="rounded-lg border border-border bg-white p-5"
    >
      <h2 className="text-sm font-semibold text-ink">Оценка работы сотрудника</h2>
      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <p>Загрузка…</p>
      ) : (
        <ReactionForm
          key={JSON.stringify(query.data)}
          initial={query.data}
          onSave={async (body) => {
            await api('/tickets/' + ticket.id + '/feedback', 'PUT', body)
            await cache.invalidateQueries({ queryKey: ['feedback', ticket.id] })
          }}
        />
      )}
    </section>
  )
}
