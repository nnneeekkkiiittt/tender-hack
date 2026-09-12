import { useId, useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { reasons, type ReactionInput } from '@/api/contracts'
import { Button } from '@/components/ui/Button'
export function ReactionForm({
  initial,
  onSave,
  disabled = false,
}: {
  initial?: ReactionInput | null
  onSave: (body: ReactionInput) => Promise<void>
  disabled?: boolean
}) {
  const [like, setLike] = useState(initial?.like ?? true),
    [selected, setSelected] = useState(initial?.reasons || [])
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const radioName = useId()
  return (
    <form
      className="mt-3 space-y-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await onSave({ like, reasons: like ? [] : selected })
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="flex gap-3" role="radiogroup" aria-label="Оценка">
        {[
          { value: true, Icon: ThumbsUp, label: 'Хорошо' },
          { value: false, Icon: ThumbsDown, label: 'Плохо' },
        ].map((option) => (
          <label key={option.label} title={option.label} className="relative cursor-pointer">
            <input
              type="radio"
              name={radioName}
              aria-label={option.label}
              className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              checked={like === option.value}
              disabled={busy || disabled}
              onChange={() => setLike(option.value)}
            />
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-ink-muted transition-colors hover:bg-gray-50 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary-light peer-disabled:opacity-50"
            >
              <option.Icon className="h-5 w-5" strokeWidth={2} />
            </span>
          </label>
        ))}
      </div>
      {!like && (
        <p className="text-xs text-ink-muted">Что не понравилось? Выберите хотя бы одну причину.</p>
      )}
      {!like &&
        Object.entries(reasons).map(([code, label]) => (
          <label key={code} className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={busy || disabled}
              checked={selected.includes(code)}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? [...selected, code] : selected.filter((x) => x !== code),
                )
              }
            />
            {label}
          </label>
        ))}
      <Button
        type="submit"
        size="sm"
        loading={busy}
        disabled={disabled || (!like && selected.length === 0)}
      >
        Отправить оценку
      </Button>
      {initial && <p className="text-success">Оценка сохранена</p>}
      {error && (
        <p role="alert" className="text-accent">
          {error}
        </p>
      )}
    </form>
  )
}
