import { defineConfig } from 'eslint/config'
import tsEslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import { rules, rulesTest } from './eslint.rules.js'

export default defineConfig([
  {
    ignores: [
      '.*/**',
      'node_modules/**',
      'dist/**'
    ]
  },
  {
    name: 'js-base-error',
    files: [
      'src/**/*.ts'
    ],

    ignores: [
      'src/**/*.{test,bench}.ts',
      'src/**/_*'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsEslint.parser,
      parserOptions: {
        projectService: true
      }
    },
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      '@stylistic': stylistic
    },
    rules
  },
  {
    name: 'js-base-error-tests',
    files: [
      'src/**/_*.ts',
      'src/**/*.{test,bench}.ts',
      'scripts/**/*.{ts,js}',
      'eslint.rules.js',
      'eslint.config.js',
      'vitest.config.ts'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsEslint.parser,
      parserOptions: {
        projectService: true
      }
    },
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      '@stylistic': stylistic
    },
    rules: rulesTest
  }
])
