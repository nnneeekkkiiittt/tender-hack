import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppRoutes } from '@/routes/AppRoutes'
import { useAuthStore } from '@/store/authStore'
import { DemoRoleSwitcher } from '@/components/demo/DemoRoleSwitcher'
import { isDemoMode } from '@/config/env'
import { ErrorState } from '@/components/ui/ErrorState'
export default function App() {
  const init = useAuthStore((s) => s.init),
    userId = useAuthStore((s) => s.user?.id)
  const cache = useQueryClient()
  const [error, setError] = useState(false)
  useEffect(() => {
    void init().catch(() => setError(true))
  }, [init])
  useEffect(() => {
    void cache.resetQueries()
  }, [cache, userId])
  useEffect(() => {
    const expired = () => useAuthStore.setState({ user: null, status: 'ready' })
    window.addEventListener('session-expired', expired)
    return () => window.removeEventListener('session-expired', expired)
  }, [])
  if (error)
    return (
      <ErrorState
        title="Не удалось проверить сессию"
        onRetry={() => {
          setError(false)
          void init().catch(() => setError(true))
        }}
      />
    )
  return (
    <>
      {isDemoMode && (
        <div className="bg-warning-bg px-4 py-2 text-center text-sm text-warning">
          Демонстрационный режим — данные и AI-ответы не настоящие
        </div>
      )}
      <AppRoutes />
      {isDemoMode && <DemoRoleSwitcher />}
    </>
  )
}
