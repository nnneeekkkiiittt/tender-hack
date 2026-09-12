import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { knowledgeService } from '@/services/knowledge'
import { TICKET_CATEGORY_LABEL } from '@/lib/utils'
import { useChatUiStore } from '@/store/chatStore'
import { useNavigate } from 'react-router-dom'

export function KnowledgeBasePage() {
  const [search, setSearch] = useState('')
  const setPendingQuestion = useChatUiStore((s) => s.setPendingQuestion)
  const navigate = useNavigate()

  const { data: articles, isLoading, isError, refetch } = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: () => knowledgeService.list(),
  })

  const filtered = (articles ?? []).filter(
    (a) => a.title.toLowerCase().includes(search.toLowerCase()) || a.excerpt.toLowerCase().includes(search.toLowerCase())
  )

  const handleOpen = (title: string) => {
    setPendingQuestion(title)
    navigate('/app')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">База знаний</h1>
      <p className="mt-1 text-sm text-ink-muted">Ответы на частые вопросы о работе на Портале поставщиков</p>

      <div className="mt-5">
        <SearchInput placeholder="Поиск по базе знаний..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="mt-5 space-y-3">
        {isLoading && <LoadingState label="Загрузка статей..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Ничего не найдено" description="Попробуйте изменить запрос" />
        )}
        {filtered.map((article) => (
          <button
            key={article.id}
            onClick={() => handleOpen(article.title)}
            className="flex w-full flex-col items-start gap-1 rounded-lg border border-border bg-white p-4 text-left transition-colors hover:border-primary-light/50 hover:bg-gray-50/60"
          >
            <span className="text-xs font-medium text-primary">{TICKET_CATEGORY_LABEL[article.category]}</span>
            <span className="text-[15px] font-medium text-ink">{article.title}</span>
            <span className="text-sm text-ink-muted">{article.excerpt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
