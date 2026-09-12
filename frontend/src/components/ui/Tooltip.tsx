import React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  label: string
  children: React.ReactNode
  className?: string
}

/** Simple hover-only tooltip for icon buttons. Named group so it doesn't
 * clash with any `group` classes already used on ancestor elements. */
export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap',
          'rounded-md bg-ink px-2 py-1 text-xs font-medium text-white shadow-popover',
          'opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100'
        )}
      >
        {label}
      </span>
    </span>
  )
}
