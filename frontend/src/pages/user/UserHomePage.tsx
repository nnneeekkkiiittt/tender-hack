import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, FileText, PenTool, BarChart3 } from 'lucide-react'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { useAuthStore } from '@/store/authStore'
import { useChatUiStore } from '@/store/chatStore'
import { aiService } from '@/services/ai'
import { ticketRepository } from '@/services/tickets'
import { generateId } from '@/lib/utils'
import type { ChatMessage as ChatMessageType, TicketCategory } from '@/types'

const SUGGESTIONS: { text: string; icon: typeof ListChecks }[] = [
  { text: 'Как принять участие в закупке?', icon: ListChecks },
  { text: 'Какие документы нужны?', icon: FileText },
  { text: 'Как работает электронная подпись?', icon: PenTool },
  { text: 'Где посмотреть результаты?', icon: BarChart3 },
]

function guessCategory(text: string): TicketCategory {
  const q = text.toLowerCase()
  if (q.includes('документ')) return 'DOCUMENTS'
  if (q.includes('закупк') || q.includes('участ')) return 'PROCUREMENT'
  if (q.includes('ошибк') || q.includes('не работает') || q.includes('не удаётся') || q.includes('не удается')) return 'TECHNICAL'
  if (q.includes('контракт')) return 'CONTRACT'
  if (q.includes('кабинет') || q.includes('пароль') || q.includes('вход')) return 'ACCOUNT'
  return 'OTHER'
}

export function UserHomePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { pendingQuestion, setPendingQuestion } = useChatUiStore()

  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [thinking, setThinking] = useState(false)
  const [createdTicketId, setCreatedTicketId] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pendingQuestion === '__new__') {
      setMessages([])
      setPendingQuestion(null)
    } else if (pendingQuestion) {
      const q = pendingQuestion
      setPendingQuestion(null)
      void handleSend(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const handleSend = async (text: string) => {
    const userMessage: ChatMessageType = {
      id: generateId('cm'),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setThinking(true)
    try {
      const result = await aiService.ask(text)
      const assistantMessage: ChatMessageType = {
        id: generateId('cm'),
        role: 'assistant',
        content: result.answer,
        createdAt: new Date().toISOString(),
        sources: result.sources,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setThinking(false)
    }
  }

  const handleFeedback = (id: string, feedback: 'helpful' | 'not_helpful') => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback } : m)))
  }

  const handleCreateTicket = async (assistantMessageId: string) => {
    if (!user) return
    const idx = messages.findIndex((m) => m.id === assistantMessageId)
    const assistantMessage = messages[idx]
    const userMessage = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user')
    if (!userMessage) return

    const ticket = await ticketRepository.create({
      title: userMessage.content.length > 60 ? userMessage.content.slice(0, 60) + '…' : userMessage.content,
      description: userMessage.content,
      category: guessCategory(userMessage.content),
      userId: user.id,
      userName: user.name,
      userOrganization: user.organization ?? user.name,
      originMessages: [
        { role: 'user', content: userMessage.content },
        { role: 'assistant', content: assistantMessage.content },
      ],
    })

    setCreatedTicketId((prev) => ({ ...prev, [assistantMessageId]: ticket.id }))
  }

  const hasConversation = messages.length > 0

  if (!hasConversation) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <h1 className="text-center text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">
            Чем я могу помочь?
          </h1>
          <p className="mt-2 text-center text-[15px] text-ink-muted">
            Задайте вопрос о закупках, документах или работе на Портале поставщиков
          </p>

          <div className="mt-7">
            <ChatInput onSend={handleSend} autoFocus />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map(({ text, icon: Icon }) => (
              <button
                key={text}
                onClick={() => handleSend(text)}
                className="flex items-start gap-3 rounded-lg border border-border bg-white p-4 text-left transition-colors hover:border-primary-light/50 hover:bg-gray-50/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium leading-snug text-ink">{text}</span>
              </button>
            ))}
          </div>

          <p className="mt-8 text-center text-xs leading-relaxed text-ink-muted">
            Ответы формируются на основе официальной документации Портала поставщиков.
            <br />
            При необходимости будет создана заявка в техническую поддержку.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6">
      <div className="flex-1 space-y-6">
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            onFeedback={handleFeedback}
            onCreateTicket={handleCreateTicket}
            ticketCreated={!!createdTicketId[m.id]}
          />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-light [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-light [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-light" />
            </span>
            AI печатает ответ...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-4 mt-6">
        <ChatInput onSend={handleSend} disabled={thinking} />
      </div>

      {Object.values(createdTicketId).length > 0 && (
        <button
          onClick={() => navigate(`/tickets/${Object.values(createdTicketId)[0]}`)}
          className="mt-3 self-center text-sm font-medium text-primary hover:underline"
        >
          Открыть созданное обращение →
        </button>
      )}
    </div>
  )
}
