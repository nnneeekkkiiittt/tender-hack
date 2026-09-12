import React from 'react'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'primary' | 'accent' | 'neutral'
  className?: string
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

const toneClasses = {
  primary: 'bg-primary text-white',
  accent: 'bg-accent text-white',
  neutral: 'bg-primary-light text-white',
}

export function Avatar({ name, size = 'md', tone = 'primary', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeClasses[size],
        toneClasses[tone],
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}
