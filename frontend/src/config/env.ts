export type AppMode = 'demo' | 'api'

export const APP_MODE: AppMode = (import.meta.env.VITE_APP_MODE as AppMode) || 'demo'

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const isDemoMode = APP_MODE === 'demo'
export const isApiMode = APP_MODE === 'api'
