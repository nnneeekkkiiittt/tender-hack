import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { api } from '@/api/contracts'
import { useAuthStore } from '@/store/authStore'
export function PasswordModal({
  open,
  onClose,
  userId,
}: {
  open: boolean
  onClose: () => void
  userId?: string
}) {
  return (
    <Modal open={open} onClose={onClose} title={userId ? 'Сбросить пароль' : 'Изменить пароль'}>
      {open && <PasswordForm userId={userId} onClose={onClose} />}
    </Modal>
  )
}
function PasswordForm({ userId, onClose }: { userId?: string; onClose: () => void }) {
  const [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await api(
            userId ? '/users/' + userId + '/password' : '/auth/password',
            'POST',
            userId
              ? { new_password: password }
              : { current_password: current, new_password: password },
          )
          if (!userId) useAuthStore.setState({ user: null })
          onClose()
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      {!userId && (
        <Input
          label="Текущий пароль"
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      <Input
        label="Новый пароль"
        type="password"
        required
        minLength={10}
        maxLength={128}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="text-xs text-ink-muted">Все текущие сессии будут завершены.</p>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        {userId ? 'Сбросить пароль' : 'Изменить пароль'}
      </Button>
    </form>
  )
}
