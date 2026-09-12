import React from 'react'
import { cn } from '@/lib/utils'

interface TabItem {
  value: string
  label: string
  count?: number
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-md bg-gray-100 p-1', className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-light',
              active ? 'bg-white text-primary shadow-sm' : 'text-ink-muted hover:text-ink'
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className={cn('text-xs', active ? 'text-primary-light' : 'text-ink-muted')}>{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
