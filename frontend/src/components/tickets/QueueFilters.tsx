import { TICKET_CATEGORY_LABEL } from '@/lib/utils'
import type { TicketCategory } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { listAssignableEmployees } from '@/services/employees'
export function QueueFilters({
  category,
  setCategory,
  unassigned,
  setUnassigned,
  operatorId,
  setOperatorId,
}: {
  category: TicketCategory | ''
  setCategory: (v: TicketCategory | '') => void
  unassigned?: boolean
  setUnassigned?: (v: boolean) => void
  operatorId?: string
  setOperatorId?: (v: string) => void
}) {
  const employees = useQuery({
    queryKey: ['assignment-employees'],
    queryFn: listAssignableEmployees,
    enabled: !!setOperatorId,
  })
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
      <select
        aria-label="Категория"
        className="h-9 rounded-md border border-border bg-white px-3"
        value={category}
        onChange={(e) => setCategory(e.target.value as TicketCategory | '')}
      >
        <option value="">Все категории</option>
        {Object.entries(TICKET_CATEGORY_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {setOperatorId && (
        <select
          aria-label="Фильтр по сотруднику"
          className="h-9 max-w-full rounded-md border border-border bg-white px-3"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          <option value="">Все сотрудники</option>
          {employees.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      )}
      {setOperatorId && employees.isError && (
        <span role="alert" className="text-accent">
          Не удалось загрузить сотрудников
        </span>
      )}
      {setUnassigned && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={unassigned}
            onChange={(e) => setUnassigned(e.target.checked)}
          />
          Без сотрудника
        </label>
      )}
    </div>
  )
}
