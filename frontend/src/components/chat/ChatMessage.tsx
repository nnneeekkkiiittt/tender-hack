import React, { useState } from 'react'
import { Copy, ThumbsUp, ThumbsDown, Check, Sparkles, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
  onFeedback?: (id: string, feedback: 'helpful' | 'not_helpful') => void
  onCreateTicket?: (id: string) => void
  ticketCreated?: boolean
}

export function ChatMessage({
  message,
  onFeedback,
  onCreateTicket,
  ticketCreated,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore in demo */
    }
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-white sm:max-w-[70%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] sm:max-w-[80%]">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          AI-ассистент
        </div>
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {message.content}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.sources.map((src) => (
              <span
                key={src}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-gray-50 px-2.5 py-1 text-xs text-ink-muted"
              >
                <BookOpen className="h-3 w-3" />
                {src}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-1">
            <Tooltip label="Скопировать сообщение">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-gray-100 hover:text-ink"
                aria-label="Скопировать сообщение"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </Tooltip>
            {onFeedback && (
              <>
                <Tooltip label="Хороший ответ">
                  <button
                    onClick={() => onFeedback?.(message.id, 'helpful')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-gray-100',
                      message.feedback === 'helpful'
                        ? 'text-success'
                        : 'text-ink-muted hover:text-ink',
                    )}
                    aria-label="Хороший ответ"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
                <Tooltip label="Плохой ответ">
                  <button
                    onClick={() => onFeedback?.(message.id, 'not_helpful')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-gray-100',
                      message.feedback === 'not_helpful'
                        ? 'text-accent'
                        : 'text-ink-muted hover:text-ink',
                    )}
                    aria-label="Плохой ответ"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </>
            )}{' '}
          </div>

          {onFeedback && !message.feedback && (
            <p className="text-sm text-ink-muted">Ответ помог решить проблему?</p>
          )}
        </div>

        {message.feedback === 'not_helpful' && (
          <div className="mt-2.5 rounded-md border border-accent/20 bg-accent/5 px-3.5 py-3">
            {ticketCreated ? (
              <p className="text-sm font-medium text-ink">
                Обращение создано и передано в поддержку. Отслеживайте статус в разделе «Мои
                заявки».
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">Не удалось решить проблему?</p>
                <Button size="sm" className="mt-2.5" onClick={() => onCreateTicket?.(message.id)}>
                  Создать обращение в поддержку
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
