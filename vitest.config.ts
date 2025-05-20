/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// Конфигурация для тестирования в Chromium
export default defineConfig({
  test: {
    include: [
      './src/**/*.test.ts'
    ],
    setupFiles: './scripts/vitest.setup.ts',
    env: {
      FIX_CAPTURE_STACK_TRACE: true,
    },
    browser: {
      // enabled: false,
      enabled: true,
      provider: 'playwright',
      // viewport: { height: 100, width: 100 },
      // headless: true,
      instances: [{
        browser: 'chromium',
        env: { FIX_CAPTURE_STACK_TRACE: true },
      }],
    },
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reportsDirectory: '.temp/coverage'
    }
  }
})
