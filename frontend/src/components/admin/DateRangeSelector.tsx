import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAnalyticsUiStore } from '@/store/analyticsStore'
import type { DateRangeKey } from '@/types'

const OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
]

export function DateRangeSelector() {
  const { range, setRange } = useAnalyticsUiStore()
  const [customOpen, setCustomOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border bg-white p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              range === opt.value ? 'bg-primary text-white' : 'text-ink-muted hover:bg-gray-50 hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen(true)}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-gray-50 hover:text-ink"
        >
          <Calendar className="h-3.5 w-3.5" />
          Свой период
        </button>
      </div>

      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Пользовательский период"
        description="Демо-режим: выбор произвольного периода подключится вместе с backend-фильтрацией."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => setCustomOpen(false)}>Применить</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="С" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="По" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Modal>
    </>
  )
}
