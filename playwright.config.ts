import { defineConfig, devices } from '@playwright/test';

// e2e-тесты гоняются против dev:mock (моковый Firebase, см. dev/firebase-mock.ts) —
// предсказуемые сид-данные без реального Firebase-проекта и сетевых зависимостей.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // мок-БД общая на процесс vite — параллельные тесты будут гоняться по одним данным
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev:mock',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
