import React, { useState } from 'react'
import { Save } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { isDemoMode } from '@/config/env'
import { useAuthStore } from '@/store/authStore'

export function UserSettingsPage() {
  const { user } = useAuthStore()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    notifyByEmail: true,
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    // UI placeholder — not yet wired to a real "update profile" endpoint.
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Настройки</h1>
      <p className="mt-1 text-sm text-ink-muted">Профиль и уведомления</p>

      {!isDemoMode && (
        <p className="mt-4 text-sm text-ink-muted">Настройки пока недоступны. Изменения не сохраняются.</p>
      )}

      <form onSubmit={handleSave} className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Профиль</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input label="Имя" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.notifyByEmail}
                onChange={(e) => setForm((f) => ({ ...f, notifyByEmail: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary-light"
              />
              Уведомлять по email об ответах на мои заявки
            </label>
          </CardBody>
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" leftIcon={<Save className="h-4 w-4" />}>
            Сохранить изменения
          </Button>
          {saved && <span className="text-sm text-success">Сохранено</span>}
        </div>
      </form>
    </div>
  )
}
