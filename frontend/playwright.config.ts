import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  use: {
    actionTimeout: 10000,
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
})
