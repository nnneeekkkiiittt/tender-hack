import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { DemoWidgetChart } from '@/components/admin/dashboards/DemoWidgetChart'
import { dashboardRepository } from '@/services/dashboards'
import {
  DASHBOARD_DIMENSION_LABEL,
  DASHBOARD_METRIC_LABEL,
  type DashboardDimension,
  type DashboardMetric,
  type DashboardVisualization,
  type DashboardWidget,
} from '@/types'

type DraftWidget = Omit<DashboardWidget, 'id' | 'metabaseQuestionId' | 'metabaseCardId'>

const METRIC_OPTIONS = Object.entries(DASHBOARD_METRIC_LABEL) as [DashboardMetric, string][]
const DIMENSION_OPTIONS = Object.entries(DASHBOARD_DIMENSION_LABEL) as [DashboardDimension, string][]
const VISUALIZATION_OPTIONS: { value: DashboardVisualization; label: string }[] = [
  { value: 'bar', label: 'Столбчатая диаграмма' },
  { value: 'line', label: 'Линейный график' },
  { value: 'table', label: 'Таблица' },
]

function emptyDraft(): DraftWidget {
  return { title: '', metric: 'claims_count', dimension: 'subtopic', visualization: 'bar' }
}

export function DashboardBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: existing, isLoading } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => dashboardRepository.get(id!),
    enabled: isEditing,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [widgets, setWidgets] = useState<DraftWidget[]>([])
  const [draft, setDraft] = useState<DraftWidget>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description)
      setWidgets(existing.widgets.map(({ title, metric, dimension, visualization }) => ({ title, metric, dimension, visualization })))
    }
  }, [existing])

  const handleAddWidget = () => {
    if (!draft.title.trim()) {
      setError('Укажите название визуализации')
      return
    }
    setError(null)
    setWidgets((prev) => [...prev, draft])
    setDraft(emptyDraft())
  }

  const handleRemoveWidget = (index: number) => {
    setWidgets((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Укажите название дашборда')
      return
    }
    if (widgets.length === 0) {
      setError('Добавьте хотя бы одну визуализацию')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload = { name, description, widgets }
      const saved = isEditing ? await dashboardRepository.update(id!, payload) : await dashboardRepository.create(payload)
      queryClient.setQueryData(['dashboard', saved.id], saved)
      queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      navigate(`/admin/analytics/dashboards/${saved.id}`)
    } catch {
      setError('Не удалось сохранить дашборд')
    } finally {
      setSaving(false)
    }
  }

  if (isEditing && isLoading) return <LoadingState label="Загрузка дашборда..." />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/admin/analytics/dashboards" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />К моим дашбордам
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{isEditing ? 'Редактировать дашборд' : 'Создать дашборд'}</h1>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Основная информация</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, «Эффективность AI»" />
          <Textarea label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Добавить визуализацию</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input label="Название" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Например, «Обращения по подтемам»" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Метрика">
              <select
                value={draft.metric}
                onChange={(e) => setDraft((d) => ({ ...d, metric: e.target.value as DashboardMetric }))}
                className="h-10 w-full rounded-md border border-border bg-white px-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
              >
                {METRIC_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dimension">
              <select
                value={draft.dimension}
                onChange={(e) => setDraft((d) => ({ ...d, dimension: e.target.value as DashboardDimension }))}
                className="h-10 w-full rounded-md border border-border bg-white px-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
              >
                {DIMENSION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Визуализация">
              <select
                value={draft.visualization}
                onChange={(e) => setDraft((d) => ({ ...d, visualization: e.target.value as DashboardVisualization }))}
                className="h-10 w-full rounded-md border border-border bg-white px-2.5 text-sm focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
              >
                {VISUALIZATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
              <Eye className="h-3.5 w-3.5" />
              Предпросмотр
            </p>
            <DemoWidgetChart widget={{ id: 'preview', ...draft }} />
          </div>

          <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={handleAddWidget}>
            Добавить виджет в дашборд
          </Button>
        </CardBody>
      </Card>

      {widgets.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Виджеты дашборда ({widgets.length})</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {widgets.map((widget, index) => (
              <div key={index} className="flex items-center justify-between rounded-md border border-border px-3.5 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">{widget.title}</p>
                  <p className="text-xs text-ink-muted">
                    {DASHBOARD_METRIC_LABEL[widget.metric]} × {DASHBOARD_DIMENSION_LABEL[widget.dimension]} ·{' '}
                    {VISUALIZATION_OPTIONS.find((o) => o.value === widget.visualization)?.label}
                  </p>
                </div>
                <button onClick={() => handleRemoveWidget(index)} className="rounded-md p-1.5 text-ink-muted hover:bg-gray-100 hover:text-accent" aria-label="Удалить виджет">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {error && <p className="mt-4 text-sm text-accent">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} loading={saving}>
          Сохранить дашборд
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  )
}
