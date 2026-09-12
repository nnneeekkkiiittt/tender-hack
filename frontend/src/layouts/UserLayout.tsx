import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Ticket as TicketIcon, Plus, Clock, Settings } from 'lucide-react'
import { Sidebar, NavItemLink } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { useChatUiStore } from '@/store/chatStore'

const RECENT_QUESTIONS = [
  'Как подать заявку',
  'Вопрос по документам',
  'Требования к поставщику',
  'Срок рассмотрения',
  'Техническая ошибка',
]

export function UserLayout() {
  const navigate = useNavigate()
  const setPendingQuestion = useChatUiStore((s) => s.setPendingQuestion)

  const handleRecentClick = (question: string) => {
    setPendingQuestion(question)
    navigate('/app')
  }

  const handleNewQuestion = () => {
    setPendingQuestion('__new__')
    navigate('/app')
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        groups={[
          {
            items: [{ to: '/tickets', label: 'Мои заявки', icon: TicketIcon }],
          },
        ]}
        topSlot={
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleNewQuestion}
          >
            Новый вопрос
          </Button>
        }
        footer={<NavItemLink item={{ to: '/app/settings', label: 'Настройки', icon: Settings }} />}
      >
        <div className="mt-5">
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Примеры вопросов
          </p>
          <div className="space-y-0.5">
            {RECENT_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleRecentClick(q)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-gray-50 hover:text-ink"
              >
                <Clock className="h-[15px] w-[15px] shrink-0" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>
        </div>
      </Sidebar>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
