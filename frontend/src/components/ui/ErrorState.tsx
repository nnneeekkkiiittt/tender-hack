import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Не удалось загрузить данные', description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Повторить попытку
        </Button>
      )}
    </div>
  )
}
