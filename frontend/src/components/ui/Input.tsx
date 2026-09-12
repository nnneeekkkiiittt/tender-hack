import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  rightElement?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, rightElement, className, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? props.name ?? generatedId
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-11 w-full rounded-md border border-border bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-muted',
              'transition-colors focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20',
              error && 'border-accent focus:border-accent focus:ring-accent/20',
              rightElement && 'pr-10',
              className,
            )}
            aria-invalid={!!error}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-3 flex items-center">{rightElement}</div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-accent">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
