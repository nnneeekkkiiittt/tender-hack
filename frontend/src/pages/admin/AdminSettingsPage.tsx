import React, { useState } from 'react'
import { Save } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { isDemoMode } from '@/config/env'

export function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    orgName: 'Портал поставщиков города Москвы',
    supportEmail: 'support@mos.ru',
    slaResponseMinutes: '15',
    notifyOnHighPriority: true,
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    // DEMO MODE: settings are not persisted anywhere yet — this is a UI
    // placeholder ready to be wired to a real settings endpoint.
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Настройки</h1>
      <p className="mt-1 text-sm text-ink-muted">Общие параметры платформы поддержки</p>

      <form onSubmit={handleSave} className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Общие параметры</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Название организации"
              value={form.orgName}
              onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
            />
            <Input
              label="Email поддержки"
              type="email"
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            />
            <Input
              label="Целевое время ответа (SLA), мин"
              type="number"
              value={form.slaResponseMinutes}
              onChange={(e) => setForm((f) => ({ ...f, slaResponseMinutes: e.target.value }))}
            />
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.notifyOnHighPriority}
                onChange={(e) => setForm((f) => ({ ...f, notifyOnHighPriority: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary-light"
              />
              Уведомлять о заявках с высоким приоритетом
            </label>
          </CardBody>
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" leftIcon={<Save className="h-4 w-4" />}>
            Сохранить изменения
          </Button>
          {saved && <span className="text-sm text-success">Сохранено</span>}
        </div>

        {isDemoMode && (
          <p className="mt-4 text-xs text-ink-muted">
            DEMO MODE: изменения не отправляются на backend — этот экран подготовлен для подключения реального API настроек.
          </p>
        )}
      </form>
    </div>
  )
}
