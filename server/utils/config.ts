import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const configFile = resolve(process.cwd(), '.env')
if (existsSync(configFile)) process.loadEnvFile(configFile)
