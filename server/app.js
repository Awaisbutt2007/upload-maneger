import express from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { open, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { apiError } from './http.js'
import { captionFor, normalizePost } from './caption.js'
import { createSessionStore } from './store.js'
import { PLATFORMS, PROVIDERS, providerForPlatform } from './providers/index.js'
import { pkcePair } from './providers/x.js'

const SESSION_COOKIE = 'platform_manager_session'
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const UPLOAD_TTL_MS = 6 * 60 * 60_000

function readCookie(req, name) {
  const entry = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  if (!entry) return ''
  try { return decodeURIComponent(entry.slice(name.length + 1)) } catch { return '' }
}

function setSessionCookie(res, sessionId, secure) {
  const flags = [`${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=2592000']
  if (secure) flags.push('Secure')
  res.setHeader('Set-Cookie', flags.join('; '))
}

// Rewrites only the given keys of a .env file, keeping everything else.
async function mergeEnvFile(path, values) {
  const existing = existsSync(path) ? await readFile(path, 'utf8') : ''
  const pending = new Map(Object.entries(values))
  const lines = existing.split(/\r?\n/).filter((line, index, all) => line || index < all.length - 1).map(line => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1]
    if (!key || !pending.has(key)) return line
    const value = pending.get(key)
    pending.delete(key)
    return `${key}=${JSON.stringify(value)}`
  })
  for (const [key, value] of pending) lines.push(`${key}=${JSON.stringify(value)}`)
  await writeFile(path, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 })
}

function fileMedia(upload) {
  return {
    size: upload.size,
    contentType: upload.contentType,
    name: upload.name,
    readAll: () => readFile(upload.path),
    async readRange(start, end) {
      const handle = await open(upload.path, 'r')
      try {
        const buffer = Buffer.alloc(end - start)
        await handle.read(buffer, 0, buffer.length, start)
        return buffer
      } finally {
        await handle.close()
      }
    },
  }
}

export function createApp({ config = {}, fetchImpl = fetch, configFile = resolve(process.cwd(), '.env.local') } = {}) {
  const app = express()
  const store = createSessionStore(config.dataDir)
  const uploadDir = config.dataDir ? join(config.dataDir, 'uploads') : join(tmpdir(), 'platform-manager-uploads')
  const maxUploadBytes = config.maxUploadBytes || 512 * 1024 * 1024
  const oauthStates = new Map()
  const providerConfigs = config.providers || {}
  // Older setups configure TikTok with flat clientKey/clientSecret/redirectUri fields.
  if (config.clientKey || config.clientSecret || config.redirectUri) {
    providerConfigs.tiktok = { clientId: config.clientKey, clientSecret: config.clientSecret, redirectUri: config.redirectUri, ...providerConfigs.tiktok }
  }
  for (const id of Object.keys(PROVIDERS)) providerConfigs[id] ||= {}

  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, value] of oauthStates) if (now > value.expiresAt) oauthStates.delete(key)
  }, 5 * 60_000)
  sweep.unref()

  const isConfigured = id => Boolean(providerConfigs[id].clientId && providerConfigs[id].clientSecret)
  const canConfigure = req => Boolean(config.allowConfigWrite && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
  const redirectUriFor = (id, req) => providerConfigs[id].redirectUri
    || `${config.publicUrl || `${req.protocol}://${req.get('host')}`}/api/${id}/oauth/callback`
  const contextFor = (id, overrides = {}) => ({
    fetch: fetchImpl,
    config: { ...providerConfigs[id], ...overrides },
    pollIntervalMs: config.pollIntervalMs ?? 5000,
    pollTimeoutMs: config.pollTimeoutMs ?? 15 * 60_000,
  })

  const getSession = (req, create = false) => {
    let id = readCookie(req, SESSION_COOKIE)
    let session = id ? store.get(id) : null
    if (!session && create) {
      id = id || randomUUID()
      session = store.create(id)
    }
    if (session) {
      session.accounts ||= {}
      session.jobs ||= {}
      session.uploads ||= {}
    }
    return session ? { id, session } : null
  }
  const requireSession = req => {
    const current = getSession(req)
    if (!current) throw apiError(401, 'NOT_CONNECTED', 'Pehle Settings → Accounts se koi platform connect karein.')
    return current
  }
  const providerFromParams = req => {
    const provider = PROVIDERS[req.params.provider]
    if (!provider) throw apiError(404, 'UNKNOWN_PROVIDER', 'Yeh platform supported nahi hai.')
    return provider
  }

  // Asks every connected provider for live account status.
  const describeAll = async (session) => {
    const platforms = Object.fromEntries(PLATFORMS.map(id => [id, { connected: false, provider: providerForPlatform(id).id }]))
    await Promise.all(Object.values(PROVIDERS).map(async provider => {
      const account = session?.accounts[provider.id]
      if (!account) return
      try {
        const described = await provider.describe(contextFor(provider.id), account)
        for (const [platform, info] of Object.entries(described)) platforms[platform] = { ...platforms[platform], ...info }
      } catch (error) {
        for (const platform of provider.platforms) {
          platforms[platform] = { ...platforms[platform], connected: false, error: { code: error.code || 'STATUS_ERROR', message: error.message } }
        }
      }
    }))
    store.persist()
    return platforms
  }

  app.disable('x-powered-by')
  app.use(express.json({ limit: '64kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, tiktokConfigured: isConfigured('tiktok') })
  })

  app.get('/api/platforms', async (req, res, next) => {
    try {
      const current = getSession(req)
      const platforms = await describeAll(current?.session)
      res.json({
        canConfigure: canConfigure(req),
        providers: Object.values(PROVIDERS).map(provider => ({
          id: provider.id,
          label: provider.label,
          platforms: provider.platforms,
          configured: isConfigured(provider.id),
          accountLinked: Boolean(current?.session.accounts[provider.id]),
          redirectUri: redirectUriFor(provider.id, req),
          developerUrl: provider.developerUrl,
          scopes: provider.scopes,
        })),
        platforms,
      })
    } catch (error) { next(error) }
  })

  app.post('/api/:provider/config', async (req, res, next) => {
    try {
      const provider = providerFromParams(req)
      if (!canConfigure(req)) throw apiError(403, 'CONFIG_WRITE_DISABLED', 'Credentials sirf local development server se save ho sakti hain; production mein environment variables use karein.')
      const field = name => typeof req.body?.[name] === 'string' ? req.body[name].trim() : ''
      const clientId = field('clientId') || field('clientKey')
      const clientSecret = field('clientSecret')
      const redirectUri = field('redirectUri')

      if (!/^[A-Za-z0-9._~-]{4,200}$/.test(clientId)) throw apiError(400, 'INVALID_CLIENT_KEY', `${provider.label} Client ID / Key format check karein.`)
      if (clientSecret.length < 8 || clientSecret.length > 256 || /[\r\n]/.test(clientSecret)) {
        throw apiError(400, 'INVALID_CLIENT_SECRET', 'Client Secret enter karein; value 8-256 characters honi chahiye.')
      }
      if (redirectUri) {
        let parsed
        try { parsed = new URL(redirectUri) } catch {}
        if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== `/api/${provider.id}/oauth/callback`) {
          throw apiError(400, 'INVALID_REDIRECT_URI', `Redirect URI ka path /api/${provider.id}/oauth/callback hona chahiye aur developer app ke URI se exact match kare.`)
        }
      }

      const values = { [provider.envKeys.clientId]: clientId, [provider.envKeys.clientSecret]: clientSecret }
      if (redirectUri) values[provider.envKeys.redirectUri] = redirectUri
      await mergeEnvFile(configFile, values)
      Object.assign(providerConfigs[provider.id], { clientId, clientSecret }, redirectUri ? { redirectUri } : {})
      res.json({ configured: true })
    } catch (error) { next(error) }
  })

  app.post('/api/:provider/oauth/start', (req, res, next) => {
    try {
      const provider = providerFromParams(req)
      if (!isConfigured(provider.id)) {
        throw apiError(503, `${provider.id.toUpperCase()}_NOT_CONFIGURED`, `Pehle Settings mein ${provider.label} Developer credentials save karein.`)
      }
      const current = getSession(req, true)
      const state = randomBytes(24).toString('hex')
      const redirectUri = redirectUriFor(provider.id, req)
      const pkce = provider.usesPkce ? (provider.pkcePair?.() || pkcePair()) : null
      oauthStates.set(state, {
        provider: provider.id,
        sessionId: current.id,
        redirectUri,
        codeVerifier: pkce?.verifier,
        expiresAt: Date.now() + 10 * 60_000,
      })
      setSessionCookie(res, current.id, Boolean(config.secureCookies))
      const authorizationUrl = provider.authorizationUrl({
        config: { ...providerConfigs[provider.id], redirectUri },
        state,
        codeChallenge: pkce?.challenge,
      })
      res.json({ authorizationUrl })
    } catch (error) { next(error) }
  })

  app.get('/api/:provider/oauth/callback', async (req, res) => {
    const provider = PROVIDERS[req.params.provider]
    const fail = message => res.redirect(`/?oauth=error&provider=${encodeURIComponent(req.params.provider)}&message=${encodeURIComponent(message)}`)
    if (!provider) return fail('Unknown platform.')
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const pending = oauthStates.get(state)
    oauthStates.delete(state)
    const current = getSession(req)
    if (!pending || pending.provider !== provider.id || pending.expiresAt < Date.now() || !current || current.id !== pending.sessionId) {
      return fail('OAuth state invalid ya expire ho gaya. Dobara connect karein.')
    }
    if (req.query.error) {
      return fail(typeof req.query.error_description === 'string' ? req.query.error_description : `${provider.label} authorization cancel ya fail ho gayi.`)
    }
    if (typeof req.query.code !== 'string' || !isConfigured(provider.id)) {
      return fail('Authorization code ya server configuration missing hai.')
    }
    try {
      const account = await provider.exchangeCode(contextFor(provider.id, { redirectUri: pending.redirectUri }), {
        code: req.query.code,
        codeVerifier: pending.codeVerifier,
      })
      current.session.accounts[provider.id] = { ...account, connectedAt: Date.now() }
      store.persist()
      res.redirect(`/?oauth=connected&provider=${provider.id}`)
    } catch (error) {
      fail(error.message)
    }
  })

  app.post('/api/:provider/disconnect', (req, res, next) => {
    try {
      const provider = providerFromParams(req)
      const current = getSession(req)
      if (current) {
        delete current.session.accounts[provider.id]
        store.persist()
      }
      res.json({ connected: false })
    } catch (error) { next(error) }
  })

  app.post('/api/meta/page', (req, res, next) => {
    try {
      const account = requireSession(req).session.accounts.meta
      if (!account) throw apiError(401, 'META_NOT_CONNECTED', 'Pehle Facebook/Instagram connect karein.')
      PROVIDERS.meta.selectPage(account, String(req.body?.pageId || ''))
      store.persist()
      res.json({ selectedPageId: account.selectedPageId })
    } catch (error) { next(error) }
  })

  app.get('/api/meta/places', async (req, res, next) => {
    try {
      const account = requireSession(req).session.accounts.meta
      if (!account) throw apiError(401, 'META_NOT_CONNECTED', 'Location search ke liye Facebook/Instagram connect karein.')
      const query = String(req.query.q || '').trim()
      if (query.length < 2) return res.json({ places: [] })
      res.json({ places: await PROVIDERS.meta.searchPlaces(contextFor('meta'), account, query.slice(0, 80)) })
    } catch (error) { next(error) }
  })

  // Exact text each platform will receive, for the preview in the upload form.
  app.post('/api/preview', (req, res) => {
    const post = normalizePost(req.body)
    const platforms = (Array.isArray(req.body?.platforms) ? req.body.platforms : PLATFORMS).filter(id => PLATFORMS.includes(id))
    res.json({ tags: post.tags, previews: Object.fromEntries(platforms.map(id => [id, captionFor(id, post)])) })
  })

  // Step 1: the browser streams the video once; it is kept on disk until every platform is done.
  app.post('/api/uploads', async (req, res, next) => {
    let path = ''
    try {
      const current = requireSession(req)
      const contentType = (req.get('content-type') || '').split(';')[0].trim()
      if (!VIDEO_TYPES.includes(contentType)) throw apiError(415, 'UNSUPPORTED_VIDEO_TYPE', 'MP4, MOV ya WebM video select karein.')
      const declared = Number(req.get('content-length') || 0)
      if (declared > maxUploadBytes) throw apiError(413, 'VIDEO_TOO_LARGE', `Video ${Math.round(maxUploadBytes / 1024 / 1024)} MB se chhoti honi chahiye.`)

      mkdirSync(uploadDir, { recursive: true })
      const id = randomUUID()
      path = join(uploadDir, id)
      let size = 0
      await new Promise((resolvePromise, reject) => {
        const output = createWriteStream(path, { mode: 0o600 })
        req.on('data', chunk => {
          size += chunk.length
          if (size > maxUploadBytes) {
            req.unpipe(output)
            req.resume()
            output.destroy()
            reject(apiError(413, 'VIDEO_TOO_LARGE', `Video ${Math.round(maxUploadBytes / 1024 / 1024)} MB se chhoti honi chahiye.`))
          }
        })
        req.on('error', reject)
        output.on('error', reject)
        output.on('finish', resolvePromise)
        req.pipe(output)
      })
      if (size === 0) throw apiError(400, 'VIDEO_REQUIRED', 'Video file empty hai ya upload nahi hui.')

      let name = 'video'
      try { name = decodeURIComponent(req.get('x-file-name') || 'video').slice(0, 200) } catch {}
      current.session.uploads[id] = { id, path, size, contentType, name, createdAt: Date.now() }
      for (const [oldId, upload] of Object.entries(current.session.uploads)) {
        if (Date.now() - upload.createdAt > UPLOAD_TTL_MS && !upload.inUse) {
          delete current.session.uploads[oldId]
          rm(upload.path, { force: true }).catch(() => {})
        }
      }
      res.status(201).json({ uploadId: id, size, contentType })
    } catch (error) {
      if (path) rm(path, { force: true }).catch(() => {})
      next(error)
    }
  })

  // Step 2: one post goes out to every selected platform in parallel.
  app.post('/api/publish', async (req, res, next) => {
    try {
      const current = requireSession(req)
      const { session } = current
      const upload = session.uploads[req.body?.uploadId]
      if (!upload || upload.inUse) throw apiError(404, 'UPLOAD_NOT_FOUND', 'Video upload nahi mili — dobara select karein.')
      if (req.body?.consent !== true) throw apiError(400, 'POST_CONSENT_REQUIRED', 'Post karne ki confirmation required hai.')

      const post = normalizePost(req.body)
      if (!post.title && !post.description) throw apiError(400, 'CAPTION_REQUIRED', 'Title ya description enter karein.')
      const requested = [...new Set(Array.isArray(req.body?.platforms) ? req.body.platforms : [])].filter(id => PLATFORMS.includes(id))
      if (!requested.length) throw apiError(400, 'PLATFORMS_REQUIRED', 'Kam az kam ek platform select karein.')
      const missing = requested.filter(id => !session.accounts[providerForPlatform(id).id])
      if (missing.length) throw apiError(400, 'PLATFORM_NOT_CONNECTED', `Yeh platforms connected nahi hain: ${missing.join(', ')}`)
      const options = req.body?.options && typeof req.body.options === 'object' ? req.body.options : {}
      if (requested.includes('tiktok') && !options.tiktok?.privacyLevel) {
        throw apiError(400, 'INVALID_PRIVACY_LEVEL', 'TikTok ke liye privacy setting select karein.')
      }

      const job = {
        id: randomUUID(),
        createdAt: Date.now(),
        status: 'running',
        fileName: upload.name,
        size: upload.size,
        post,
        platforms: Object.fromEntries(requested.map(id => [id, { status: 'queued', url: null, postId: null, error: '', warning: '' }])),
      }
      session.jobs[job.id] = job
      upload.inUse = true
      store.persist()
      res.status(202).json({ job })

      const media = fileMedia(upload)
      await Promise.all(requested.map(async platform => {
        const entry = job.platforms[platform]
        const provider = providerForPlatform(platform)
        try {
          const account = session.accounts[provider.id]
          if (!account) throw apiError(401, 'NOT_CONNECTED', 'Account disconnect ho gaya.')
          const result = await provider.publish(contextFor(provider.id), account, platform, {
            post,
            media,
            options: options[platform] || {},
            onStage: stage => { entry.status = stage; store.persist() },
          })
          Object.assign(entry, { status: 'done', url: result.url || null, postId: result.postId || null, warning: result.warning || '' })
        } catch (error) {
          Object.assign(entry, { status: 'failed', error: error.message || 'Publish fail ho gaya.' })
        }
        store.persist()
      }))

      const results = Object.values(job.platforms)
      job.status = results.every(entry => entry.status === 'done') ? 'done' : results.some(entry => entry.status === 'done') ? 'partial' : 'failed'
      job.finishedAt = Date.now()
      delete session.uploads[upload.id]
      await rm(upload.path, { force: true }).catch(() => {})
      const jobIds = Object.keys(session.jobs)
      for (const id of jobIds.slice(0, Math.max(0, jobIds.length - 100))) delete session.jobs[id]
      store.persist()
    } catch (error) {
      if (!res.headersSent) next(error)
    }
  })

  app.get('/api/publish/:jobId', (req, res, next) => {
    try {
      const job = requireSession(req).session.jobs[req.params.jobId]
      if (!job) throw apiError(404, 'JOB_NOT_FOUND', 'Yeh upload job nahi mili (shayad purani ho chuki hai).')
      res.json({ job })
    } catch (error) { next(error) }
  })

  const distDirectory = resolve(process.cwd(), 'dist')
  app.use(express.static(distDirectory))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route nahi mili.' } })
    }
    const indexFile = resolve(distDirectory, 'index.html')
    if (req.method === 'GET' && existsSync(indexFile)) return res.sendFile(indexFile)
    next()
  })

  app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.too.large' ? 413 : 500)
    const code = error.code || (status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR')
    const message = error.status ? error.message : status === 413 ? 'Request bohat bari hai.' : 'Backend request fail ho gayi.'
    if (status >= 500 && !error.status) console.error(error)
    res.status(status).json({ error: { code, message } })
  })

  return app
}
