import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Landmark } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { isDemoMode } from '@/config/env'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const loginWithGosuslugi = useAuthStore((s) => s.loginWithGosuslugi)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError('Заполните email и пароль')
      return
    }
    setLoading(true)
    try {
      const user = await login(email, password, remember)
      navigate(user.role === 'SUPPORT' ? '/support' : user.role === 'ADMIN' ? '/admin' : '/app')
    } catch {
      setError('Не удалось войти. Проверьте данные и попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  const handleGosuslugi = async () => {
    setLoading(true)
    try {
      const user = await loginWithGosuslugi()
      navigate(user.role === 'SUPPORT' ? '/support' : user.role === 'ADMIN' ? '/admin' : '/app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <Logo />
      {isDemoMode && (
        <span className="mt-4 inline-flex items-center rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
          DEMO MODE
        </span>
      )}

      <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-ink">Вход в систему</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        Единая платформа для работы
        <br />с закупками города Москвы
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
        <Input
          label="Электронная почта"
          type="email"
          name="email"
          placeholder="example@company.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          label="Пароль"
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-ink-muted hover:text-ink"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          }
        />

        {error && <p className="text-sm text-accent">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary-light"
            />
            Запомнить меня
          </label>
          <Link to="#" className="text-sm font-medium text-primary hover:underline">
            Забыли пароль?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Войти
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-ink-muted">ИЛИ</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size="lg" className="w-full" leftIcon={<Landmark className="h-4 w-4" />} onClick={handleGosuslugi} disabled={loading}>
        Войти через Госуслуги
      </Button>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  )
}
