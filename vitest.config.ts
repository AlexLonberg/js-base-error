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
      // для чего это - описано в файле тестов
      FIX_CAPTURE_STACK_TRACE: true
    },
    browser: {
      // enabled: false,
      // headless: true,
      enabled: true,
      headless: false,
      provider: 'playwright',
      // viewport: { height: 100, width: 100 },
      instances: [{
        browser: 'chromium',
        env: { FIX_CAPTURE_STACK_TRACE: true }
      }]
    },
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reportsDirectory: '.temp/coverage'
    },
    // Config https://vitest.dev/config/#benchmark
    benchmark: {
      include: [
        'scripts/**/*.bench.js'
      ]
    }
  }
})
