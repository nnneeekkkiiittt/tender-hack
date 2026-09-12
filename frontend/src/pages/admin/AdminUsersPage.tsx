import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users as UsersIcon } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { userRepository } from '@/services/users'
import { formatShortDate } from '@/lib/utils'

export function AdminUsersPage() {
  const [search, setSearch] = useState('')

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => userRepository.list(search),
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Пользователи</h1>
      <p className="mt-1 text-sm text-ink-muted">Поставщики, зарегистрированные на Портале</p>

      <div className="mt-6">
        <SearchInput placeholder="Поиск по имени, организации или email..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-96" />
      </div>

      <div className="mt-5">
        {isLoading && <LoadingState label="Загрузка пользователей..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && users?.length === 0 && (
          <EmptyState icon={<UsersIcon className="h-5 w-5" />} title="Пользователи не найдены" />
        )}
        {users && users.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-medium">Имя</th>
                  <th className="px-4 py-3 font-medium">Организация</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Заявок</th>
                  <th className="px-4 py-3 font-medium">Последняя активность</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-gray-50/70">
                    <td className="px-4 py-3.5 font-medium text-ink">{u.name}</td>
                    <td className="px-4 py-3.5 text-ink-muted">{u.organization}</td>
                    <td className="px-4 py-3.5 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-3.5 text-ink-muted">{u.ticketsCount}</td>
                    <td className="px-4 py-3.5 text-ink-muted">{formatShortDate(u.lastActivity)}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone={u.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                        {u.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
