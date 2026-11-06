import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { addProductionEnvEntry } from './production-entry.mjs'

test('production entry loads env before application, regardless of cwd', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'typewords-env-'))
  try {
    const serverDir = join(rootDir, '.output/server')
    await mkdir(serverDir, { recursive: true })
    await writeFile(join(rootDir, '.env.production'), 'TYPEWORDS_ENTRY_CHECK=from-file\n')
    await writeFile(join(serverDir, 'index.mjs'), 'console.log(process.env.TYPEWORDS_ENTRY_CHECK)\n')
    await addProductionEnvEntry({ options: { preset: 'node-server', rootDir, output: { serverDir } } })
    const env = { ...process.env }
    delete env.TYPEWORDS_ENTRY_CHECK
    const run = () => spawnSync(process.execPath, [join(serverDir, 'index.mjs')], {
      cwd: tmpdir(), env, encoding: 'utf8',
    })
    let result = run()
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), 'from-file')
    env.TYPEWORDS_ENTRY_CHECK = 'from-system'
    result = run()
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), 'from-system')
    await rm(join(rootDir, '.env.production'))
    result = run()
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})
