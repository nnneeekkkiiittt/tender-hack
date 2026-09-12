import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/layout/Logo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <Logo />
      <p className="mt-8 text-6xl font-semibold text-primary">404</p>
      <h1 className="mt-2 text-xl font-semibold text-ink">Страница не найдена</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        Похоже, такой страницы не существует или она была перемещена.
      </p>
      <Link to="/">
        <Button className="mt-6">На главную</Button>
      </Link>
    </div>
  )
}
