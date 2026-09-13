import React from 'react'
import { formatHours } from '@/lib/utils'
import type { TopicAnalytics } from '@/types'

interface TopicsPanelProps {
  data: TopicAnalytics
}

export function TopicsPanel({ data }: TopicsPanelProps) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Темы</h2>
        {data.truncated && (
          <p className="text-xs text-ink-muted">
            Показаны {data.topics.length} из {data.totalTopicsFound} самых частых подтем
          </p>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3 font-medium">Подтема</th>
              <th className="px-4 py-3 font-medium">Доля обращений</th>
              <th className="px-4 py-3 font-medium">Среднее время решения</th>
              <th className="px-4 py-3 font-medium">Решено AI</th>
            </tr>
          </thead>
          <tbody>
            {data.topics.map((row) => (
              <tr key={`${row.topic}::${row.subtopic}`} className="border-b border-border last:border-0 hover:bg-gray-50/70">
                <td className="px-4 py-3.5">
                  <span className="font-medium text-ink">{row.subtopic}</span>
                </td>
                <td className="px-4 py-3.5 text-ink-muted">{row.subtopic_share_percentage.toFixed(1)}%</td>
                <td className="px-4 py-3.5 text-ink-muted">{formatHours(row.avg_resolution_time_hours)}</td>
                <td className="px-4 py-3.5 text-ink-muted">{row.ai_resolved_percentage.toFixed(0)}%</td>
              </tr>
            ))}
            {data.topics.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  Темы не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
