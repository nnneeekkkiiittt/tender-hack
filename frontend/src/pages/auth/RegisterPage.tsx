import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'

interface FormState {
  name: string
  organization: string
  inn: string
  email: string
  password: string
  confirmPassword: string
}

const initialState: FormState = {
  name: '',
  organization: '',
  inn: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  const [form, setForm] = useState<FormState>(initialState)
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name || !form.organization || !form.inn || !form.email || !form.password) {
      setError('Заполните все обязательные поля')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    if (!agree) {
      setError('Необходимо принять пользовательское соглашение')
      return
    }

    setLoading(true)
    try {
      await register(form)
      navigate('/app')
    } catch {
      setError('Не удалось зарегистрироваться. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <Logo />
      <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-ink">Регистрация</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        Создайте аккаунт поставщика, чтобы участвовать в закупках
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        <Input label="Имя" name="name" placeholder="Иван Иванов" value={form.name} onChange={setField('name')} />
        <Input
          label="Название организации"
          name="organization"
          placeholder="ООО «Компания»"
          value={form.organization}
          onChange={setField('organization')}
        />
        <Input label="ИНН" name="inn" placeholder="7701234567" value={form.inn} onChange={setField('inn')} />
        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="example@company.ru"
          value={form.email}
          onChange={setField('email')}
          autoComplete="email"
        />
        <Input
          label="Пароль"
          type="password"
          name="password"
          placeholder="Не менее 8 символов"
          value={form.password}
          onChange={setField('password')}
          autoComplete="new-password"
        />
        <Input
          label="Подтверждение пароля"
          type="password"
          name="confirmPassword"
          placeholder="Повторите пароль"
          value={form.confirmPassword}
          onChange={setField('confirmPassword')}
          autoComplete="new-password"
        />

        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary-light"
          />
          Я принимаю пользовательское соглашение
        </label>

        {error && <p className="text-sm text-accent">{error}</p>}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Зарегистрироваться
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Войти
        </Link>
      </p>
    </div>
  )
}
