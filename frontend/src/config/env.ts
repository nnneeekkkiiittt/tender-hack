export type AppMode = 'demo' | 'api'

export const APP_MODE: AppMode = import.meta.env.VITE_APP_MODE === 'demo' ? 'demo' : 'api'

export const API_URL: string = import.meta.env.VITE_API_URL || '/api'

// The analytics service is a SEPARATE Go microservice (its own Postgres
// connection, its own origin/port) — deliberately not reusing VITE_API_URL,
// which points at the main backend. Base URL only (no path); each analytics
// endpoint call appends /api/v1/... itself (see api/analyticsClient.ts).
export const ANALYTICS_API_URL: string =
  import.meta.env.VITE_ANALYTICS_API_URL || ''

// Metabase base URL for embedded dashboards. No API key / embedding secret
// ever lives here — those stay backend-side (see analytics/internal/metabase).
export const METABASE_URL: string = import.meta.env.VITE_METABASE_URL || ''

export const isDemoMode = APP_MODE === 'demo'
export const isApiMode = APP_MODE === 'api'
