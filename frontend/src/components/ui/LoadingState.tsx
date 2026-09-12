import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  compact?: boolean
}

export function LoadingState({ label = 'Загрузка...', compact }: LoadingStateProps) {
  return (
    <div className={compact ? 'flex items-center gap-2 py-6 text-sm text-ink-muted' : 'flex flex-col items-center justify-center gap-2 py-14 text-sm text-ink-muted'}>
      <Loader2 className="h-5 w-5 animate-spin text-primary-light" />
      <span>{label}</span>
    </div>
  )
}
