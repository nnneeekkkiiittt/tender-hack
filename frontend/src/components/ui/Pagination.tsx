import { Button } from './Button'
export function Pagination({
  offset,
  total,
  onChange,
  limit = 20,
}: {
  offset: number
  total: number
  onChange: (n: number) => void
  limit?: number
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
      <span>Всего: {total}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Назад
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Далее
        </Button>
      </div>
    </div>
  )
}
