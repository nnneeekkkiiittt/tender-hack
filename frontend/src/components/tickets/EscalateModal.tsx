import React, { useState } from 'react'
import { ArrowUpRight, Info } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface EscalateModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (comment?: string) => Promise<void>
  currentLevel: number
  targetLevel: number
  ticketNumber?: string
  busy: boolean
}

export function EscalateModal({
  open,
  onClose,
  onConfirm,
  currentLevel,
  targetLevel,
  ticketNumber,
  busy,
}: EscalateModalProps) {
  const [comment, setComment] = useState('')

  const handleClose = () => {
    if (busy) return
    setComment('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onConfirm(comment)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Передать обращение на L${targetLevel}`}
      description={
        ticketNumber
          ? `Обращение ${ticketNumber} будет передано в очередь поддержки L${targetLevel}.`
          : `Обращение будет передано в очередь поддержки L${targetLevel}.`
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-ink-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-medium text-ink">Что произойдет после передачи:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Уровень обработки изменится с L{currentLevel} на L{targetLevel}.</li>
              <li>Заявка поступит в статус «Новое» для операторов L{targetLevel}.</li>
              <li>Текущее назначение оператора будет снято.</li>
              <li>Вся история диалога и переписки сохраняется в полном объеме.</li>
            </ul>
          </div>
        </div>

        <Textarea
          label="Комментарий для коллег (необязательно)"
          placeholder="Укажите причину эскалации, контекст или предварительные выводы..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          disabled={busy}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={busy}
            className="gap-1.5"
          >
            <ArrowUpRight className="h-4 w-4" />
            Передать на L{targetLevel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
