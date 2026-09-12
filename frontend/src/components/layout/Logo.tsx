import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  /** Slightly smaller variant for tight spaces (e.g. compact headers). */
  compact?: boolean
}

export function Logo({ className, compact }: LogoProps) {
  return (
    <img
      src="/images/logo.png"
      alt="Портал поставщиков"
      className={cn(compact ? 'h-6 w-auto' : 'h-8 w-auto', 'select-none object-contain', className)}
    />
  )
}
