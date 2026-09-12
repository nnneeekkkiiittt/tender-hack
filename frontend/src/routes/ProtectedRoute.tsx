import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'
import { LoadingState } from '@/components/ui/LoadingState'

const HOME_BY_ROLE: Record<UserRole, string> = {
  USER: '/app',
  SUPPORT: '/support',
  ADMIN: '/admin',
}

interface ProtectedRouteProps {
  allow: UserRole[]
}

export function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { user, status } = useAuthStore()
  const location = useLocation()

  if (status !== 'ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <LoadingState label="Проверка доступа..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  }

  return <Outlet />
}
