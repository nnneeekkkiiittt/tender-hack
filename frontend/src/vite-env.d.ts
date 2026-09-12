/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: 'demo' | 'api'
  readonly VITE_API_URL: string
  readonly VITE_ANALYTICS_API_URL: string
  readonly VITE_METABASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
