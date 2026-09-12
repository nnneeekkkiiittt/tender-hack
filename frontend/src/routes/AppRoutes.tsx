import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuthStore } from '@/store/authStore'

import { AuthLayout } from '@/layouts/AuthLayout'
import { UserLayout } from '@/layouts/UserLayout'
import { SupportLayout } from '@/layouts/SupportLayout'
import { AdminLayout } from '@/layouts/AdminLayout'

import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'

import { UserHomePage } from '@/pages/user/UserHomePage'
import { UserTicketsPage } from '@/pages/user/UserTicketsPage'
import { UserTicketDetailPage } from '@/pages/user/UserTicketDetailPage'

import { SupportDashboardPage } from '@/pages/support/SupportDashboardPage'
import { SupportTicketDetailPage } from '@/pages/support/SupportTicketDetailPage'
import { SupportStatsPage } from '@/pages/support/SupportStatsPage'

import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminTicketsPage } from '@/pages/admin/AdminTicketsPage'
import { AdminTicketDetailPage } from '@/pages/admin/AdminTicketDetailPage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminEmployeesPage } from '@/pages/admin/AdminEmployeesPage'
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'

import { NotFoundPage } from '@/pages/NotFoundPage'

function RootRedirect() {
  const { user, status } = useAuthStore()
  if (status !== 'ready') return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'SUPPORT') return <Navigate to="/support" replace />
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />
  return <Navigate to="/app" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* USER */}
      <Route element={<ProtectedRoute allow={['USER']} />}>
        <Route element={<UserLayout />}>
          <Route path="/app" element={<UserHomePage />} />
          <Route path="/tickets" element={<UserTicketsPage />} />
          <Route path="/tickets/:id" element={<UserTicketDetailPage />} />
        </Route>
      </Route>

      {/* SUPPORT */}
      <Route element={<ProtectedRoute allow={['SUPPORT']} />}>
        <Route element={<SupportLayout />}>
          <Route path="/support" element={<SupportDashboardPage mode="all" />} />
          <Route path="/support/tickets" element={<SupportDashboardPage mode="all" />} />
          <Route path="/support/mine" element={<SupportDashboardPage mode="mine" />} />
          <Route path="/support/control" element={<SupportDashboardPage mode="control" />} />
          <Route path="/support/stats" element={<SupportStatsPage />} />
          <Route path="/support/tickets/:id" element={<SupportTicketDetailPage />} />
        </Route>
      </Route>

      {/* ADMIN */}
      <Route element={<ProtectedRoute allow={['ADMIN']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/tickets" element={<AdminTicketsPage />} />
          <Route path="/admin/tickets/:id" element={<AdminTicketDetailPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/employees" element={<AdminEmployeesPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
