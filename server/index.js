import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp } from './app.js'

for (const envPath of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
  if (existsSync(envPath)) process.loadEnvFile(envPath)
}

const env = process.env
const port = Number(env.API_PORT) || 4001
const host = env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const app = createApp({
  config: {
    providers: {
      tiktok: { clientId: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET, redirectUri: env.TIKTOK_REDIRECT_URI },
      meta: { clientId: env.META_APP_ID, clientSecret: env.META_APP_SECRET, redirectUri: env.META_REDIRECT_URI, graphVersion: env.META_GRAPH_VERSION },
      youtube: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: env.GOOGLE_REDIRECT_URI },
      linkedin: { clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET, redirectUri: env.LINKEDIN_REDIRECT_URI, apiVersion: env.LINKEDIN_API_VERSION },
      x: { clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET, redirectUri: env.X_REDIRECT_URI },
    },
    publicUrl: env.PUBLIC_URL,
    dataDir: resolve(process.cwd(), env.DATA_DIR || '.data'),
    maxUploadBytes: Number(env.MAX_UPLOAD_MB) > 0 ? Number(env.MAX_UPLOAD_MB) * 1024 * 1024 : undefined,
    secureCookies: env.NODE_ENV === 'production',
    allowConfigWrite: env.NODE_ENV !== 'production',
    keepAliveOnStart: true,
  },
})

app.listen(port, host, () => {
  console.log(`Platform Manager API listening on http://${host}:${port}`)
})
