import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)))

function readTsConfigBase () {
  return readFileSync(join(projectDir, 'tsconfig.base.json'), { encoding: 'utf8' })
}

export {
  readTsConfigBase
}
