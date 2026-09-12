import React from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const areaId = id ?? props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            'w-full resize-none rounded-md border border-border bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted',
            'transition-colors focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20',
            error && 'border-accent focus:border-accent focus:ring-accent/20',
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-accent">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
