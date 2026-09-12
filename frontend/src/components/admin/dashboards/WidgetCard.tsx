import React from 'react'
import { isDemoMode } from '@/config/env'
import { DemoWidgetChart } from './DemoWidgetChart'
import { ApiWidgetEmbed } from './ApiWidgetEmbed'
import type { DashboardWidget } from '@/types'

interface WidgetCardProps {
  dashboardId: string
  widget: DashboardWidget
}

export function WidgetCard({ dashboardId, widget }: WidgetCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="text-sm font-semibold text-ink">{widget.title}</h3>
      <div className="mt-3">
        {isDemoMode ? <DemoWidgetChart widget={widget} /> : <ApiWidgetEmbed dashboardId={dashboardId} widget={widget} />}
      </div>
    </div>
  )
}
