/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: 'demo' | 'api'
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
