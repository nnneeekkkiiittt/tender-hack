import { create } from 'zustand'
import type { AuthUser, UserRole } from '@/types'
import { authService } from '@/services/auth'

interface AuthState {
  user: AuthUser | null
  status: 'idle' | 'loading' | 'ready'
  init: () => Promise<void>
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>
  loginWithGosuslugi: () => Promise<AuthUser>
  register: (payload: { name: string; organization: string; inn: string; email: string; password: string }) => Promise<AuthUser>
  logout: () => Promise<void>
  switchDemoRole: (role: UserRole) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',

  init: async () => {
    set({ status: 'loading' })
    const user = await authService.getCurrentUser()
    set({ user, status: 'ready' })
  },

  login: async (email, password, remember) => {
    const user = await authService.login({ email, password, remember })
    set({ user })
    return user
  },

  loginWithGosuslugi: async () => {
    const user = await authService.loginWithGosuslugi()
    set({ user })
    return user
  },

  register: async (payload) => {
    const user = await authService.register(payload)
    set({ user })
    return user
  },

  logout: async () => {
    await authService.logout()
    set({ user: null })
  },

  switchDemoRole: async (role) => {
    if (!authService.switchDemoRole) return
    const user = await authService.switchDemoRole(role)
    set({ user })
  },
}))
