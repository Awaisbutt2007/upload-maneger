import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp } from './app.js'
import { maxUploadBytesFromEnv, providersFromEnv } from './config.js'

for (const envPath of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
  if (existsSync(envPath)) process.loadEnvFile(envPath)
}

const env = process.env
const port = Number(env.API_PORT) || 4001
const host = env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const app = createApp({
  config: {
    providers: providersFromEnv(env),
    publicUrl: env.PUBLIC_URL,
    dataDir: resolve(process.cwd(), env.DATA_DIR || '.data'),
    maxUploadBytes: maxUploadBytesFromEnv(env),
    secureCookies: env.NODE_ENV === 'production',
    allowConfigWrite: env.NODE_ENV !== 'production',
    keepAliveOnStart: true,
  },
})

app.listen(port, host, () => {
  console.log(`Platform Manager API listening on http://${host}:${port}`)
})
