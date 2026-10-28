// Vercel Function: the same Express backend, with sessions in Postgres and videos in Vercel Blob.
// vercel.json rewrites every /api/* request here.
import { waitUntil } from '@vercel/functions'
import { createApp } from '../server/app.js'
import { maxUploadBytesFromEnv, providersFromEnv } from '../server/config.js'

const env = process.env

export default createApp({
  config: {
    providers: providersFromEnv(env),
    publicUrl: env.PUBLIC_URL,
    databaseUrl: env.DATABASE_URL,
    blobUploads: true,
    maxUploadBytes: maxUploadBytesFromEnv(env),
    secureCookies: true,
    trustProxy: true,
    serverless: true,
    waitUntil,
    cronSecret: env.CRON_SECRET,
    // Stay inside the function's 300 s limit; TikTok keeps processing on its side after that.
    pollTimeoutMs: 200_000,
    jobTimeoutMs: 6 * 60_000,
  },
})
