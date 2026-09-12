import React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({ className, ...props }, ref) => {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input
        ref={ref}
        type="search"
        className={cn(
          'h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted',
          'transition-colors focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20'
        )}
        {...props}
      />
    </div>
  )
})
SearchInput.displayName = 'SearchInput'
