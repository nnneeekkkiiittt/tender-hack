import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ListChecks, FileText, PenTool, BarChart3, ThumbsDown } from 'lucide-react'
import { ChatInput } from '@/components/chat/ChatInput'
import { ThinkingDots } from '@/components/chat/ThinkingDots'
import { useAuthStore } from '@/store/authStore'
import { useChatUiStore } from '@/store/chatStore'
import { ticketRepository } from '@/services/tickets'
import { invalidateTickets } from '@/services/tickets/cache'

const SUGGESTIONS: { text: string; icon: typeof ListChecks }[] = [
  { text: 'Как принять участие в закупке?', icon: ListChecks },
  { text: 'Какие документы нужны?', icon: FileText },
  { text: 'Как работает электронная подпись?', icon: PenTool },
  { text: 'Где посмотреть результаты?', icon: BarChart3 },
]

// getRandomValues is also available on HTTP IP-based prototype deployments.
function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function UserHomePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate(),
    cache = useQueryClient()
  const { pendingQuestion, setPendingQuestion } = useChatUiStore()
  const [question, setQuestion] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const attempt = useRef<{ text: string; id: string } | null>(null),
    inFlight = useRef(false)
  const handleSend = async (text: string) => {
    if (!user || inFlight.current) return false
    inFlight.current = true
    setQuestion(text)
    setBusy(true)
    setError('')
    try {
      if (attempt.current?.text !== text) attempt.current = { text, id: requestId() }
      const ticket = await ticketRepository.create({
        text,
        requestId: attempt.current.id,
        category: 'OTHER',
        userId: user.id,
        userName: user.name,
        userOrganization: user.organization || '',
      })
      await invalidateTickets(cache, ticket.id)
      navigate('/tickets/' + ticket.id, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setQuestion('')
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  useEffect(() => {
    if (!pendingQuestion) return
    setPendingQuestion(null)
    if (pendingQuestion !== '__new__') void handleSend(pendingQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion])
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-[28px] font-semibold tracking-tight text-ink sm:text-[32px]">
          Чем я могу помочь?
        </h1>
        {question && (
          <div className="mt-7 animate-fade-in-up whitespace-pre-wrap break-words rounded-lg bg-primary p-4 text-white">
            {question}
          </div>
        )}
        {busy && (
          <p role="status" className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-ink-muted">
            <span>AI ищет ответ в инструкциях… Подождите немного</span>
            <ThinkingDots className="text-primary-light" />
          </p>
        )}
        {error && (
          <div role="alert" className="mt-4 text-center text-sm text-accent">
            {error}
          </div>
        )}
          <div className={question ? 'hidden' : 'mt-7'}>
            <ChatInput
              onSend={handleSend}
              disabled={busy}
              placeholder="Задайте вопрос о закупках, документах или работе на Портале поставщиков"
              ariaLabel="Ваш вопрос"
              autoFocus
            />
          </div>
        {!question && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map(({ text, icon: Icon }) => (
              <button
                key={text}
                onClick={() => void handleSend(text)}
                className="flex items-start gap-3 rounded-lg border border-border bg-white p-4 text-left transition-colors hover:border-primary-light/50 hover:bg-gray-50/60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium leading-snug text-ink">{text}</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-xs leading-relaxed text-ink-muted">
          Сначала ответит AI. Если ответ не помог, нажмите{' '}
          <ThumbsDown className="inline h-3.5 w-3.5 align-text-bottom" aria-label="дизлайк" /> чтобы Вас перевели на
          оператора.
        </p>
      </div>
    </div>
  )
}
