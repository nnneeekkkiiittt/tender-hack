import { isDemoMode } from '@/config/env'
import { Pagination } from '@/components/ui/Pagination'
import { PasswordModal } from '@/components/accounts/PasswordModal'
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
import { employeeRepository, listEmployees } from '@/services/employees'
import { formatShortDate } from '@/lib/utils'
import type { EmployeeRole, SupportEmployee } from '@/types'

const ROLE_LABEL: Record<EmployeeRole, string> = {
  supportL1: 'L1',
  supportL2: 'L2',
  supportL3: 'L3',
  EMPLOYEE: 'Сотрудник',
  SENIOR_EMPLOYEE: 'Старший сотрудник',
}

export function AdminEmployeesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0),
    [resetId, setResetId] = useState<string>(),
    [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SupportEmployee | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: (isDemoMode ? 'EMPLOYEE' : 'supportL1') as EmployeeRole,
  })
  const [saving, setSaving] = useState(false)

  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-employees', search, offset],
    queryFn: () => listEmployees(search, offset),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        ['admin-employees', 'assignment-employees'].includes(String(query.queryKey[0])),
    })

  const openCreate = () => {
    setError('')
    setEditing(null)
    setForm({ name: '', email: '', password: '', role: isDemoMode ? 'EMPLOYEE' : 'supportL1' })
    setModalOpen(true)
  }

  const openEdit = (employee: SupportEmployee) => {
    setError('')
    setEditing(employee)
    setForm({ name: employee.name, email: employee.email, password: '', role: employee.role })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || (isDemoMode && !form.email) || (!isDemoMode && !editing && !form.password)) {
      setError('Заполните обязательные поля')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await employeeRepository.update(editing.id, form)
      } else {
        await employeeRepository.create(form)
      }
      await invalidate()
      setModalOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (id: string) => {
    await employeeRepository.toggleStatus(id)
    await invalidate()
  }

  const employees = page?.items

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Сотрудники поддержки</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Управление аккаунтами сотрудников технической поддержки
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Добавить сотрудника
        </Button>
      </div>

      <div className="mt-6">
        <SearchInput
          placeholder="Поиск по сотрудникам..."
          value={search}
          onChange={(e) => {
            setOffset(0)
            setSearch(e.target.value)
          }}
          className="sm:w-96"
        />
      </div>

      <div className="mt-5">
        {isLoading && <LoadingState label="Загрузка сотрудников..." />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && employees?.length === 0 && (
          <EmptyState icon={<UserCog className="h-5 w-5" />} title="Сотрудники не найдены" />
        )}
        {employees && employees.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-medium">Имя</th>
                  {isDemoMode && <th className="px-4 py-3 font-medium">Почта</th>}
                  <th className="px-4 py-3 font-medium">Роль</th>
                  {isDemoMode && <th className="px-4 py-3 font-medium">Статус</th>}
                  {isDemoMode && <th className="px-4 py-3 font-medium">Последний вход</th>}
                  <th className="px-4 py-3 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 hover:bg-gray-50/70"
                  >
                    <td className="px-4 py-3.5 font-medium text-ink">{e.name}</td>
                    {isDemoMode && <td className="px-4 py-3.5 text-ink-muted">{e.email}</td>}
                    <td className="px-4 py-3.5 text-ink-muted">{ROLE_LABEL[e.role]}</td>
                    {isDemoMode && (
                      <td className="px-4 py-3.5">
                        <Badge tone={e.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                          {e.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
                        </Badge>
                      </td>
                    )}
                    {isDemoMode && (
                      <td className="px-4 py-3.5 text-ink-muted">
                        {e.lastLogin ? formatShortDate(e.lastLogin) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-md p-1.5 text-ink-muted hover:bg-gray-100 hover:text-primary"
                          aria-label={`Редактировать ${e.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!isDemoMode && (
                          <Button variant="outline" size="sm" onClick={() => setResetId(e.id)}>
                            Сбросить пароль
                          </Button>
                        )}
                        {isDemoMode && (
                          <button
                            onClick={() => handleToggleStatus(e.id)}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-gray-100 hover:text-accent"
                            aria-label={
                              e.status === 'ACTIVE'
                                ? `Деактивировать ${e.name}`
                                : `Активировать ${e.name}`
                            }
                          >
                            {e.status === 'ACTIVE' ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {page && <Pagination offset={offset} total={page.total} onChange={setOffset} />}
      <PasswordModal open={!!resetId} userId={resetId} onClose={() => setResetId(undefined)} />
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
          {error && (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          )}
          <Input
            label={isDemoMode ? 'Имя' : 'Имя пользователя'}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Иван Петров"
          />
          {isDemoMode && (
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="petrov@mos.ru"
            />
          )}
          {!isDemoMode && !editing && (
            <Input
              label="Начальный пароль"
              type="password"
              minLength={10}
              maxLength={128}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Роль</label>
            <select
              aria-label="Уровень поддержки"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as EmployeeRole }))}
              className="h-11 w-full rounded-md border border-border bg-white px-3.5 text-[15px] focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary-light/20"
            >
              {isDemoMode ? (
                <>
                  <option value="EMPLOYEE">Сотрудник</option>
                  <option value="SENIOR_EMPLOYEE">Старший сотрудник</option>
                </>
              ) : (
                <>
                  <option value="supportL1">L1</option>
                  <option value="supportL2">L2</option>
                  <option value="supportL3">L3</option>
                </>
              )}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
