/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// DOC vitest browser https://vitest.dev/guide/browser/
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts'
    ],
    browser: {
      enabled: true,
      headless: false,
      // enabled: false,
      // headless: true,
      provider: playwright(),
      // viewport: { height: 100, width: 100 },
      instances: [{ browser: 'chromium' }]
    },
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reportsDirectory: '.temp/.coverage'
    },
    // Config https://vitest.dev/config/#benchmark
    benchmark: {
      include: [
        'scripts/**/*.bench.ts',
        'scripts/**/*.bench.js'
      ]
    }
  }
})
