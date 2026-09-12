import React, { useState, useRef } from 'react'
import { Plus, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function ChatInput({ onSend, disabled, placeholder = 'Спросите что угодно...', autoFocus }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-border bg-white px-3 py-2.5 shadow-card focus-within:border-primary-light focus-within:ring-2 focus-within:ring-primary-light/20">
      <button
        type="button"
        className="mb-0.5 shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-gray-100"
        aria-label="Добавить вложение"
      >
        <Plus className="h-5 w-5" />
      </button>
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className="max-h-40 flex-1 resize-none bg-transparent py-1 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim() || disabled}
        className={cn(
          'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          value.trim() && !disabled ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-gray-100 text-ink-muted'
        )}
        aria-label="Отправить"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  )
}
