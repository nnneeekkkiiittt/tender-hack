import React from 'react'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Ticket as TicketIcon, Plus, Clock, Settings } from 'lucide-react'
import { Sidebar, NavItemLink } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { useChatUiStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { listTickets } from '@/services/tickets'

const RECENT_TICKETS_LIMIT = 5

export function UserLayout() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const setPendingQuestion = useChatUiStore((s) => s.setPendingQuestion)

  const { data: recentTickets } = useQuery({
    queryKey: ['recent-tickets', user?.id],
    queryFn: async () => {
      const page = await listTickets({ limit: RECENT_TICKETS_LIMIT }, user!.id)
      return [...page.items]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, RECENT_TICKETS_LIMIT)
    },
    enabled: !!user,
  })

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
        {recentTickets && recentTickets.length > 0 && (
          <div className="mt-5">
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Недавние чаты
            </p>
            <div className="space-y-0.5">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-gray-50 hover:text-ink"
                >
                  <Clock className="h-[15px] w-[15px] shrink-0" />
                  <span className="truncate">{ticket.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
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
