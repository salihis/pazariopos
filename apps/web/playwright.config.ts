import { defineConfig, devices } from '@playwright/test'

/**
 * These e2e specs mock the backend entirely via page.route() — they
 * verify the POS UI's client-side flow (login -> quick-add -> checkout)
 * against the real Vite dev build, WITHOUT needing a live server or
 * database. This keeps them fast and runnable in CI without Postgres.
 *
 * A separate, real-stack e2e suite (against a running server + seeded
 * DB) is a natural Phase 2 once CI infrastructure exists — see
 * CHECKLIST.md "Production deployment" / "CI/CD" items.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
