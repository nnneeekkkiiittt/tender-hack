import React, { useEffect } from 'react'
import { AppRoutes } from '@/routes/AppRoutes'
import { useAuthStore } from '@/store/authStore'
import { DemoRoleSwitcher } from '@/components/demo/DemoRoleSwitcher'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <>
      <AppRoutes />
      {/* Rendered at app root (not inside protected layouts) so you can jump
          into any role — including from /login — without a session yet. */}
      <DemoRoleSwitcher />
    </>
  )
}
