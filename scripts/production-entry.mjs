import { rename, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

export async function addProductionEnvEntry(nitro) {
  if (nitro.options.preset !== 'node-server') return

  const serverDir = nitro.options.output.serverDir
  const envPath = relative(serverDir, join(nitro.options.rootDir, '.env.production'))
  await rename(join(serverDir, 'index.mjs'), join(serverDir, 'application.mjs'))
  await writeFile(join(serverDir, 'index.mjs'), [
    "import { loadEnvFile } from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    `loadEnvFile(fileURLToPath(new URL(${JSON.stringify(envPath)}, import.meta.url)))`,
    "await import('./application.mjs')",
    '',
  ].join('\n'))
}
