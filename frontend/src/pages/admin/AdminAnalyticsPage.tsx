import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs } from '@/components/ui/Tabs'
import { DateRangeSelector } from '@/components/admin/DateRangeSelector'
import { CategoryDetailModal } from '@/components/admin/CategoryDetailModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { analyticsService } from '@/services/analytics'
import { useAnalyticsUiStore } from '@/store/analyticsStore'
import { GeneralTab } from './analytics/GeneralTab'
import { AiTab } from './analytics/AiTab'
import { SupportTab } from './analytics/SupportTab'
import { UsersTab } from './analytics/UsersTab'
import type { AnalyticsCategoryBreakdown } from '@/types'

type TabKey = 'general' | 'ai' | 'support' | 'users'

const TABS: { value: TabKey; label: string }[] = [
  { value: 'general', label: 'Общая' },
  { value: 'ai', label: 'AI' },
  { value: 'support', label: 'Поддержка' },
  { value: 'users', label: 'Пользователи' },
]

export function AdminAnalyticsPage() {
  const range = useAnalyticsUiStore((s) => s.range)
  const [tab, setTab] = useState<TabKey>('general')
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategoryBreakdown | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-analytics-detailed', range],
    queryFn: () => analyticsService.getOverview(range),
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Аналитика</h1>
          <p className="mt-1 text-sm text-ink-muted">Полный жизненный цикл обращения: от вопроса до решения и обратной связи</p>
        </div>
        <DateRangeSelector />
      </div>

      <div className="mt-5">
        <Tabs items={TABS} value={tab} onChange={(v) => setTab(v as TabKey)} />
      </div>

      {isLoading && <LoadingState label="Загрузка аналитики..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <div className="mt-6">
          {tab === 'general' && <GeneralTab data={data} onSelectCategory={setActiveCategory} />}
          {tab === 'ai' && <AiTab data={data} />}
          {tab === 'support' && <SupportTab data={data} />}
          {tab === 'users' && <UsersTab data={data} />}
        </div>
      )}

      <CategoryDetailModal category={activeCategory} onClose={() => setActiveCategory(null)} />
    </div>
  )
}
