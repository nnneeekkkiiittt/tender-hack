import { useInfiniteQuery } from '@tanstack/react-query'
import { api, type MessagePage } from '@/api/contracts'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import type { Ticket } from '@/types'
export function OlderMessages({ ticket }: { ticket: Ticket }) {
  const query = useInfiniteQuery({
    queryKey: ['older-messages', ticket.id],
    initialPageParam: ticket.nextBefore,
    enabled: false,
    queryFn: ({ pageParam }) =>
      api<MessagePage>('/tickets/' + ticket.id + '/messages', 'GET', undefined, {
        before_id: pageParam,
      }),
    getNextPageParam: (page) => page.next_before || undefined,
  })
  const older = (query.data?.pages.flatMap((p) => p.items) || [])
    .filter((m) => !ticket.messages.some((current) => current.id === m.id))
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
  return (
    <>
      {(query.data ? query.hasNextPage : ticket.nextBefore) && (
        <Button
          variant="outline"
          size="sm"
          loading={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          Загрузить предыдущие сообщения
        </Button>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-accent">
          Не удалось загрузить историю
        </p>
      )}
      {older.map((m) => (
        <div key={m.id} className="flex gap-3">
          <Avatar name={m.author_name || m.author_kind} size="sm" />
          <div className="min-w-0 max-w-[80%]">
            <p className="mb-1 text-xs text-ink-muted">
              {m.author_name || m.author_kind} · {formatDate(m.sent_at)}
            </p>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-100 px-3.5 py-2.5 text-[15px]">
              {m.text}
            </p>
          </div>
        </div>
      ))}
    </>
  )
}
