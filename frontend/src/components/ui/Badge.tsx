import React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  tone?: Tone
  dot?: boolean
  children: React.ReactNode
  className?: string
}

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-gray-100 text-ink-muted',
}

const dotClasses: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-ink-muted',
}

export function Badge({ tone = 'neutral', dot, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        toneClasses[tone],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotClasses[tone])} aria-hidden />}
      {children}
    </span>
  )
}
