/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { readTsConfigBase } from './scripts/readTsConfigBase.js'

const jsonTsConfig = readTsConfigBase()

// Конфигурация для тестирования в Chromium
export default defineConfig({
  esbuild: {
    // Загрузчик vite не может разобрать файл tsconfig.project.json с {"extends": "./tsconfig.base.json"} завершаясь
    // ошибкой: `The "path" argument must be of type string. Received null`.
    // Передаем ему сырой текст.
    tsconfigRaw: jsonTsConfig
  },
  test: {
    include: [
      './src/**/*.test.ts'
    ],
    browser: {
      // enabled: false,
      // headless: true,
      enabled: true,
      headless: false,
      provider: 'playwright',
      // viewport: { height: 100, width: 100 },
      instances: [{
        browser: 'chromium'
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
        // 'scripts/likeVsNative.bench.js',
        'scripts/*.bench.ts',
        'scripts/*.bench.js'
      ]
    }
  }
})
