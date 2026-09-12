import React from 'react'
import { Sparkles, ArrowRightLeft, AlertOctagon, ThumbsUp, ThumbsDown, Repeat, HelpCircle, BookX } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'
import { Funnel } from '@/components/admin/Funnel'
import type { Analytics } from '@/types'

interface AiTabProps {
  data: Analytics
}

export function AiTab({ data }: AiTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="AI Resolution Rate" value={`${data.aiResolutionRate}%`} trend={data.trends.aiResolutionRate} icon={Sparkles} tone="success" />
        <StatCard label="Escalation Rate" value={`${data.escalationRate}%`} trend={data.trends.escalationRate} goodDirection="down" icon={ArrowRightLeft} tone="accent" />
        <StatCard label="AI Fallback Rate" value={`${data.aiFallbackRate}%`} icon={AlertOctagon} tone="info" goodDirection="down" />
        <StatCard label="Положительная оценка" value={`${data.aiPositiveFeedback}%`} icon={ThumbsUp} tone="success" />
        <StatCard label="Отрицательная оценка" value={`${data.aiNegativeFeedback}%`} icon={ThumbsDown} tone="accent" goodDirection="down" />
        <StatCard label="Повторные обращения" value={`${data.repeatContactRate}%`} trend={data.repeatContactTrend} goodDirection="down" icon={Repeat} tone="primary" />
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Воронка обработки обращений</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Куда уходят обращения на каждом шаге</p>
        <div className="mt-5">
          <Funnel stages={data.funnel} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-ink">Популярные вопросы</h2>
          </div>
          <ol className="mt-3 space-y-2">
            {data.topQuestions.map((q, i) => (
              <li key={q.question} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  <span className="mr-1.5 text-ink-muted">{i + 1}.</span>
                  {q.question}
                </span>
                <span className="shrink-0 font-medium text-ink-muted">{q.count.toLocaleString('ru-RU')}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-accent/20 bg-accent/5 p-5">
          <div className="flex items-center gap-2">
            <BookX className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Пробелы в базе знаний</h2>
          </div>
          <p className="mt-2 text-2xl font-semibold text-accent">{data.knowledgeGaps.totalUnresolved}</p>
          <p className="text-sm text-ink-muted">вопроса без релевантного ответа AI</p>
          <ul className="mt-3 space-y-1.5">
            {data.knowledgeGaps.examples.map((ex) => (
              <li key={ex} className="rounded-md bg-white px-3 py-2 text-sm text-ink shadow-sm">
                «{ex}»
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
