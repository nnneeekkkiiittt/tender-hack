import type { QueryClient } from '@tanstack/react-query'

export function invalidateTickets(cache: QueryClient, id?: string) {
  return cache.invalidateQueries({
    predicate: (query) =>
      ['user-tickets', 'support-tickets', 'admin-tickets'].includes(String(query.queryKey[0])) ||
      (query.queryKey[0] === 'ticket' && (!id || query.queryKey[1] === id)),
  })
}
