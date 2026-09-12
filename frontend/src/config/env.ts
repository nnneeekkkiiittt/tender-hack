export type AppMode = 'demo' | 'api'

export const APP_MODE: AppMode = import.meta.env.VITE_APP_MODE === 'demo' ? 'demo' : 'api'

export const API_URL: string = import.meta.env.VITE_API_URL || '/api'

export const isDemoMode = APP_MODE === 'demo'
export const isApiMode = APP_MODE === 'api'
