import { defineConfig } from 'vitest/config'
import { readTsConfigBase } from './readTsConfigBase.js'

const jsonTsConfig = readTsConfigBase()

export default defineConfig({
  esbuild: {
    tsconfigRaw: jsonTsConfig
  }
})
