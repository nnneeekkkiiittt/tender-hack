import React from 'react'
import { Modal } from '@/components/ui/Modal'
import type { AnalyticsCategoryBreakdown } from '@/types'

interface CategoryDetailModalProps {
  category: AnalyticsCategoryBreakdown | null
  onClose: () => void
}

// Shared drill-down used by both the Overview donut chart and the Analytics
// category chart — clicking a category answers "where does AI struggle and
// where is resolution slow" for that specific slice.
export function CategoryDetailModal({ category, onClose }: CategoryDetailModalProps) {
  return (
    <Modal open={!!category} onClose={onClose} title={category?.label ?? ''} size="sm">
      {category && (
        <div className="space-y-3 text-sm">
          <Row label="Обращений" value={`${category.value.toLocaleString('ru-RU')} (${category.percent}%)`} />
          <Row label="AI resolution" value={`${category.aiResolutionRate}%`} />
          <Row label="Escalation rate" value={`${category.escalationRate}%`} />
          <Row label="Среднее время решения" value={`${category.avgResolutionMinutes} мин`} />
          <Row label="CSAT" value={`${category.csat.toFixed(1)} / 5`} />
        </div>
      )}
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  )
}
