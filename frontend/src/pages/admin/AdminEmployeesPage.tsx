import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCog, Plus, Pencil, UserX, UserCheck } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { employeeRepository } from '@/services/employees'
import { formatShortDate } from '@/lib/utils'
import type { EmployeeRole, SupportEmployee } from '@/types'

const ROLE_LABEL: Record<EmployeeRole, string> = {
  EMPLOYEE: 'Сотрудник',
  SENIOR_EMPLOYEE: 'Старший сотрудник',
}

export function AdminEmployeesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SupportEmployee | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'EMPLOYEE' as EmployeeRole })
  const [saving, setSaving] = useState(false)

  const { data: employees, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-employees', search],
    queryFn: () => employeeRepository.list(search),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', email: '', role: 'EMPLOYEE' })
    setModalOpen(true)
  }

  const openEdit = (employee: SupportEmployee) => {
    setEditing(employee)
    setForm({ name: employee.name, email: employee.email, role: employee.role })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return
    setSaving(true)
    try {
      if (editing) {
        await employeeRepository.update(editing.id, form)
      } else {
        await employeeRepository.create(form)
      }
      await invalidate()
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (id: string) => {
    await employeeRepository.toggleStatus(id)
    await invalidate()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Сотрудники поддержки</h1>
          <p className="mt-1 text-sm text-ink-muted">Управление аккаунтами сотрудников технической поддержки</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Добавить сотрудника
        </Button>
      </div>

      <div className="mt-6">
        <SearchInput placeholder="Поиск по сотрудникам..." value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-96" />
      </div>

      <div className="mt-5">
        {isLoading && <LoadingState label="Загрузка сотрудников..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && employees?.length === 0 && (
          <EmptyState icon={<UserCog className="h-5 w-5" />} title="Сотрудники не найдены" />
        )}
        {employees && employees.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-medium">Имя</th>
                  <th className="px-4 py-3 font-medium">Почта</th>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Последний вход</th>
                  <th className="px-4 py-3 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-gray-50/70">
                    <td className="px-4 py-3.5 font-medium text-ink">{e.name}</td>
                    <td className="px-4 py-3.5 text-ink-muted">{e.email}</td>
                    <td className="px-4 py-3.5 text-ink-muted">{ROLE_LABEL[e.role]}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone={e.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                        {e.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-ink-muted">{formatShortDate(e.lastLogin)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-md p-1.5 text-ink-muted hover:bg-gray-100 hover:text-primary"
                          aria-label={`Редактировать ${e.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(e.id)}
                          className="rounded-md p-1.5 text-ink-muted hover:bg-gray-100 hover:text-accent"
                          aria-label={e.status === 'ACTIVE' ? `Деактивировать ${e.name}` : `Активировать ${e.name}`}
                        >
                          {e.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Имя" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Иван Петров" />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="petrov@mos.ru"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Роль</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as EmployeeRole }))}
              className="h-11 w-full rounded-md border border-border bg-white px-3.5 text-[15px] focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
            >
              <option value="EMPLOYEE">Сотрудник</option>
              <option value="SENIOR_EMPLOYEE">Старший сотрудник</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
