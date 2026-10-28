import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'
import { captionFor, normalizePost, xLength } from './caption.js'
import { tiktokChunks } from './providers/tiktok.js'

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

async function connect(baseUrl, provider, cookie) {
  const start = await fetch(`${baseUrl}/api/${provider}/oauth/start`, { method: 'POST', headers: cookie ? { cookie } : {} })
  assert.equal(start.status, 200)
  const sessionCookie = cookie || start.headers.get('set-cookie').split(';')[0]
  const { authorizationUrl } = await start.json()
  const state = new URL(authorizationUrl).searchParams.get('state')
  const callback = await fetch(`${baseUrl}/api/${provider}/oauth/callback?code=authorization-code&state=${state}`, {
    headers: { cookie: sessionCookie },
    redirect: 'manual',
  })
  return { cookie: sessionCookie, callback, authorizationUrl }
}

async function waitForJob(baseUrl, cookie, jobId) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { job } = await fetch(`${baseUrl}/api/publish/${jobId}`, { headers: { cookie } }).then(response => response.json())
    if (job.status !== 'running') return job
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('job did not finish')
}

const tiktokApi = calls => async (url, options = {}) => {
  url = String(url)
  calls.push({ url, options })
  if (url.endsWith('/v2/oauth/token/')) {
    return Response.json({ access_token: 'server-only-access-token', refresh_token: 'refresh', expires_in: 3600, open_id: 'open-id', scope: 'user.info.basic,video.publish' })
  }
  if (url.endsWith('/v2/post/publish/creator_info/query/')) {
    return Response.json({ data: { creator_username: 'awais.butt.official', creator_nickname: 'Awais', privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'] }, error: { code: 'ok' } })
  }
  if (url.endsWith('/v2/post/publish/video/init/')) {
    return Response.json({ data: { publish_id: 'real-publish-id', upload_url: 'https://open-upload.tiktokapis.com/video/upload' }, error: { code: 'ok' } })
  }
  if (url.startsWith('https://open-upload.tiktokapis.com/')) return new Response(null, { status: 200 })
  if (url.endsWith('/v2/post/publish/status/fetch/')) {
    return Response.json({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['123456789'] }, error: { code: 'ok' } })
  }
  return null
}

const youtubeApi = calls => async (url, options = {}) => {
  url = String(url)
  calls.push({ url, options })
  if (url === 'https://oauth2.googleapis.com/token') {
    return Response.json({ access_token: 'yt-access', refresh_token: 'yt-refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/youtube.upload' })
  }
  if (url.startsWith('https://www.googleapis.com/youtube/v3/channels')) {
    return Response.json({ items: [{ id: 'channel-1', snippet: { title: 'Awais Channel', customUrl: '@awais' } }] })
  }
  if (url.startsWith('https://www.googleapis.com/upload/youtube/v3/videos')) {
    return new Response(null, { status: 200, headers: { location: 'https://upload.youtube.test/session-1' } })
  }
  if (url === 'https://upload.youtube.test/session-1') {
    // First chunk is only partly stored, like a real resumable upload can be.
    if (new Set(calls.filter(call => call.url === url).map(call => call.options)).size === 1) return new Response(null, { status: 308, headers: { range: 'bytes=0-3' } })
    return Response.json({ id: 'yt-video-1' })
  }
  return null
}

const combine = (...handlers) => async (url, options) => {
  for (const handler of handlers) {
    const response = await handler(url, options)
    if (response) return response
  }
  throw new Error(`Unexpected endpoint: ${url}`)
}

test('health and OAuth expose missing setup instead of faking a connection', async () => {
  const { server, baseUrl } = await startServer(createApp({ config: {} }))
  try {
    assert.deepEqual(await fetch(`${baseUrl}/api/health`).then(response => response.json()), { ok: true, tiktokConfigured: false, uploadMode: 'direct' })

    for (const provider of ['tiktok', 'meta', 'youtube', 'linkedin', 'x']) {
      const response = await fetch(`${baseUrl}/api/${provider}/oauth/start`, { method: 'POST' })
      assert.equal(response.status, 503)
      assert.equal((await response.json()).error.code, `${provider.toUpperCase()}_NOT_CONFIGURED`)
    }

    const configResponse = await fetch(`${baseUrl}/api/tiktok/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientKey: 'client123', clientSecret: 'secret-value' }),
    })
    assert.equal(configResponse.status, 403)
    assert.equal((await configResponse.json()).error.code, 'CONFIG_WRITE_DISABLED')

    const platforms = await fetch(`${baseUrl}/api/platforms`).then(response => response.json())
    assert.deepEqual(Object.keys(platforms.platforms), ['tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'x'])
    assert.equal(Object.values(platforms.platforms).some(platform => platform.connected), false)
    assert.equal(platforms.providers.find(provider => provider.id === 'meta').redirectUri, `${baseUrl}/api/meta/oauth/callback`)
  } finally {
    await stopServer(server)
  }
})

test('credential form merges secrets into the env file without returning them', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'platform-manager-config-'))
  const configFile = join(directory, '.env.local')
  await writeFile(configFile, 'API_PORT=4001\nTIKTOK_CLIENT_KEY="old"\n')
  const { server, baseUrl } = await startServer(createApp({ config: { allowConfigWrite: true }, configFile }))
  const save = (provider, body) => fetch(`${baseUrl}/api/${provider}/config`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  try {
    const response = await save('tiktok', { clientKey: 'client123', clientSecret: 'secret-value', redirectUri: 'http://localhost:3001/api/tiktok/oauth/callback' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { configured: true })
    assert.equal((await save('youtube', { clientId: 'google-client.apps', clientSecret: 'google-secret' })).status, 200)

    const env = await readFile(configFile, 'utf8')
    assert.match(env, /API_PORT=4001/)
    assert.match(env, /TIKTOK_CLIENT_KEY="client123"/)
    assert.doesNotMatch(env, /"old"/)
    assert.match(env, /GOOGLE_CLIENT_SECRET="google-secret"/)
    assert.equal((await fetch(`${baseUrl}/api/health`).then(result => result.json())).tiktokConfigured, true)

    const invalid = await save('tiktok', { clientKey: 'client123', clientSecret: 'secret-value', redirectUri: 'http://localhost:3001/incorrect-callback' })
    assert.equal(invalid.status, 400)
    assert.equal((await invalid.json()).error.code, 'INVALID_REDIRECT_URI')
  } finally {
    await stopServer(server)
    await rm(directory, { recursive: true, force: true })
  }
})

test('OAuth callback stores tokens on the server and status reads real account info', async () => {
  const calls = []
  const { server, baseUrl } = await startServer(createApp({
    config: { clientKey: 'test-client-key', clientSecret: 'test-client-secret', redirectUri: 'http://127.0.0.1:3000/api/tiktok/oauth/callback' },
    fetchImpl: combine(tiktokApi(calls)),
  }))

  try {
    const { cookie, callback, authorizationUrl } = await connect(baseUrl, 'tiktok')
    assert.equal(callback.status, 302)
    assert.equal(callback.headers.get('location'), '/?oauth=connected&provider=tiktok')

    const challenge = new URL(authorizationUrl).searchParams
    assert.equal(challenge.get('code_challenge_method'), 'S256')
    const verifier = new URLSearchParams(calls.find(call => call.url.endsWith('/v2/oauth/token/')).options.body).get('code_verifier')
    assert.equal(challenge.get('code_challenge'), createHash('sha256').update(verifier).digest('hex'))

    const { platforms } = await fetch(`${baseUrl}/api/platforms`, { headers: { cookie } }).then(response => response.json())
    assert.equal(platforms.tiktok.connected, true)
    assert.equal(platforms.tiktok.username, 'awais.butt.official')
    assert.deepEqual(platforms.tiktok.options.privacyLevels, ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'])
    assert.equal(calls[0].options.headers.Authorization, undefined)
    assert.equal(calls[1].options.headers.Authorization, 'Bearer server-only-access-token')
    assert.equal(JSON.stringify(platforms).includes('server-only-access-token'), false)

    const forged = await fetch(`${baseUrl}/api/tiktok/oauth/callback?code=x&state=forged`, { headers: { cookie }, redirect: 'manual' })
    assert.match(forged.headers.get('location'), /oauth=error/)
  } finally {
    await stopServer(server)
  }
})

test('one upload publishes to every selected platform with the same caption, tags and location', async () => {
  const calls = []
  const { server, baseUrl } = await startServer(createApp({
    config: {
      providers: {
        tiktok: { clientId: 'tiktok-key', clientSecret: 'tiktok-secret' },
        youtube: { clientId: 'google-id', clientSecret: 'google-secret' },
      },
      pollIntervalMs: 0,
    },
    fetchImpl: combine(tiktokApi(calls), youtubeApi(calls)),
  }))

  try {
    const { cookie } = await connect(baseUrl, 'tiktok')
    await connect(baseUrl, 'youtube', cookie)

    const missingSession = await fetch(`${baseUrl}/api/uploads`, { method: 'POST', headers: { 'content-type': 'video/mp4' }, body: 'x' })
    assert.equal(missingSession.status, 401)

    const video = Buffer.from('mock-mp4-video')
    const upload = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'video/mp4', 'x-file-name': encodeURIComponent('clip.mp4') },
      body: video,
    })
    assert.equal(upload.status, 201)
    const { uploadId, size } = await upload.json()
    assert.equal(size, video.length)

    const post = {
      uploadId,
      title: 'Lahore vlog',
      description: 'Food street tour',
      tags: ['#food', 'lahore', 'food'],
      location: { name: 'Lahore, Pakistan' },
      platforms: ['tiktok', 'youtube'],
      options: { tiktok: { privacyLevel: 'SELF_ONLY' }, youtube: { privacyStatus: 'unlisted' } },
    }
    const noConsent = await fetch(`${baseUrl}/api/publish`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(post) })
    assert.equal(noConsent.status, 400)
    assert.equal((await noConsent.json()).error.code, 'POST_CONSENT_REQUIRED')

    const notConnected = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...post, consent: true, platforms: ['instagram'] }),
    })
    assert.equal((await notConnected.json()).error.code, 'PLATFORM_NOT_CONNECTED')

    const started = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...post, consent: true }),
    })
    assert.equal(started.status, 202)
    const job = await waitForJob(baseUrl, cookie, (await started.json()).job.id)

    assert.equal(job.status, 'done')
    assert.equal(job.platforms.tiktok.url, 'https://www.tiktok.com/@awais.butt.official/video/123456789')
    assert.equal(job.platforms.youtube.url, 'https://www.youtube.com/watch?v=yt-video-1')

    const tiktokInit = JSON.parse(calls.find(call => call.url.endsWith('/v2/post/publish/video/init/')).options.body)
    assert.equal(tiktokInit.post_info.title, 'Lahore vlog\n\nFood street tour\n\n#food #lahore\n\n📍 Lahore, Pakistan')
    assert.equal(tiktokInit.source_info.video_size, video.length)
    const tiktokChunk = calls.find(call => call.url.startsWith('https://open-upload.tiktokapis.com/'))
    assert.equal(Buffer.from(tiktokChunk.options.body).toString(), video.toString())

    const youtubeMeta = JSON.parse(calls.find(call => call.url.startsWith('https://www.googleapis.com/upload/youtube/v3/videos')).options.body)
    assert.equal(youtubeMeta.snippet.title, 'Lahore vlog')
    assert.deepEqual(youtubeMeta.snippet.tags, ['food', 'lahore'])
    assert.match(youtubeMeta.snippet.description, /#food #lahore\n\n📍 Lahore, Pakistan$/)
    assert.equal(youtubeMeta.status.privacyStatus, 'unlisted')
    const youtubeChunks = new Set(calls.filter(call => call.url === 'https://upload.youtube.test/session-1').map(call => call.options))
    assert.deepEqual([...youtubeChunks].map(options => options.headers['Content-Range']), [
      `bytes 0-${video.length - 1}/${video.length}`,
      `bytes 4-${video.length - 1}/${video.length}`,
    ])

    const reused = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ ...post, consent: true }),
    })
    assert.equal((await reused.json()).error.code, 'UPLOAD_NOT_FOUND')
  } finally {
    await stopServer(server)
  }
})

test('a failing platform does not stop the others', async () => {
  const calls = []
  const failingYoutube = async (url, options) => {
    if (String(url).startsWith('https://www.googleapis.com/upload/youtube/v3/videos')) {
      return Response.json({ error: { message: 'quotaExceeded' } }, { status: 403 })
    }
    return youtubeApi(calls)(url, options)
  }
  const { server, baseUrl } = await startServer(createApp({
    config: {
      providers: { tiktok: { clientId: 'tiktok-key', clientSecret: 'tiktok-secret' }, youtube: { clientId: 'google-id', clientSecret: 'google-secret' } },
      pollIntervalMs: 0,
    },
    fetchImpl: combine(tiktokApi(calls), failingYoutube),
  }))
  try {
    const { cookie } = await connect(baseUrl, 'tiktok')
    await connect(baseUrl, 'youtube', cookie)
    const { uploadId } = await fetch(`${baseUrl}/api/uploads`, { method: 'POST', headers: { cookie, 'content-type': 'video/mp4' }, body: 'video' }).then(response => response.json())
    const started = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ uploadId, title: 'Hi', consent: true, platforms: ['tiktok', 'youtube'], options: { tiktok: { privacyLevel: 'SELF_ONLY' } } }),
    }).then(response => response.json())
    const job = await waitForJob(baseUrl, cookie, started.job.id)
    assert.equal(job.status, 'partial')
    assert.equal(job.platforms.tiktok.status, 'done')
    assert.equal(job.platforms.youtube.status, 'failed')
    assert.match(job.platforms.youtube.error, /quotaExceeded/)
  } finally {
    await stopServer(server)
  }
})

test('captions respect each platform format and limits', () => {
  const post = normalizePost({ title: 'Title', description: 'Body (with) #hash', tags: '#One, two two', location: { name: 'Karachi', placeId: '106' } })
  assert.deepEqual(post.tags, ['One', 'two'])
  assert.equal(captionFor('instagram', post).locationId, '106')
  assert.doesNotMatch(captionFor('instagram', post).text, /📍/)
  assert.match(captionFor('tiktok', post).text, /📍 Karachi$/)
  assert.equal(captionFor('linkedin', post).text, 'Title\n\nBody \\(with\\) \\#hash\n\n{hashtag|\\#|One} {hashtag|\\#|two}\n\n📍 Karachi')

  const long = normalizePost({ description: 'a'.repeat(400), tags: ['keep'], location: { name: 'Multan' } })
  const tweet = captionFor('x', long).text
  assert.ok(xLength(tweet) <= 280)
  assert.match(tweet, /…\n\n#keep\n\n📍 Multan$/)
  assert.equal(captionFor('youtube', normalizePost({ title: '<b>x</b>' })).title, 'bx/b')
})

test('TikTok chunk plan follows the API rules', () => {
  assert.deepEqual(tiktokChunks(1000), { chunkSize: 1000, ranges: [[0, 1000]] })
  const mb = 1024 * 1024
  const plan = tiktokChunks(25 * mb)
  assert.equal(plan.chunkSize, 10 * mb)
  assert.deepEqual(plan.ranges, [[0, 10 * mb], [10 * mb, 25 * mb]])
})

test('Meta, LinkedIn and X publish flows run end to end against mocked APIs', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    url = String(url)
    calls.push({ url, options })
    const path = new URL(url).pathname
    if (url.startsWith('https://graph.facebook.com/')) {
      if (path.endsWith('/oauth/access_token')) return Response.json({ access_token: 'meta-user-token', expires_in: 5184000 })
      if (path.endsWith('/me')) return Response.json({ id: 'u1', name: 'Awais' })
      if (path.endsWith('/me/accounts')) {
        return Response.json({ data: [{ id: 'page-1', name: 'Awais Page', access_token: 'page-token', instagram_business_account: { id: 'ig-1', username: 'awais.ig' } }] })
      }
      if (path.endsWith('/ig-1/media')) return Response.json({ id: 'container-1', uri: 'https://rupload.facebook.com/ig-api-upload/v24.0/container-1' })
      if (path.endsWith('/container-1')) return Response.json({ status_code: 'FINISHED' })
      if (path.endsWith('/ig-1/media_publish')) return Response.json({ id: 'ig-media-1' })
      if (path.endsWith('/ig-media-1')) return Response.json({ permalink: 'https://www.instagram.com/reel/abc/' })
    }
    if (url.startsWith('https://rupload.facebook.com/')) return Response.json({ success: true })
    if (url.startsWith('https://graph-video.facebook.com/')) return Response.json({ id: 'fb-video-1' })
    if (url === 'https://www.linkedin.com/oauth/v2/accessToken') return Response.json({ access_token: 'li-token', expires_in: 5184000 })
    if (url === 'https://api.linkedin.com/v2/userinfo') return Response.json({ sub: 'abc123', name: 'Awais Butt' })
    if (url.includes('/rest/videos?action=initializeUpload')) {
      return Response.json({ value: { video: 'urn:li:video:v1', uploadToken: '', uploadInstructions: [{ uploadUrl: 'https://upload.linkedin.test/p1', firstByte: 0, lastByte: 4 }] } })
    }
    if (url === 'https://upload.linkedin.test/p1') return new Response(null, { status: 200, headers: { etag: 'etag-1' } })
    if (url.includes('/rest/videos?action=finalizeUpload')) return new Response(null, { status: 200 })
    if (url.startsWith('https://api.linkedin.com/rest/videos/')) return Response.json({ status: 'AVAILABLE' })
    if (url === 'https://api.linkedin.com/rest/posts') return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:9' } })
    if (url === 'https://api.x.com/2/oauth2/token') return Response.json({ access_token: 'x-token', refresh_token: 'x-refresh', expires_in: 7200 })
    if (url === 'https://api.x.com/2/users/me') return Response.json({ data: { username: 'awais_x' } })
    if (url === 'https://api.x.com/2/media/upload/initialize') return Response.json({ data: { id: 'm1' } })
    if (url === 'https://api.x.com/2/media/upload/m1/append') return new Response(null, { status: 204 })
    if (url === 'https://api.x.com/2/media/upload/m1/finalize') return Response.json({ data: { id: 'm1', processing_info: { state: 'pending', check_after_secs: 0 } } })
    if (url.startsWith('https://api.x.com/2/media/upload?command=STATUS')) return Response.json({ data: { processing_info: { state: 'succeeded' } } })
    if (url === 'https://api.x.com/2/tweets') return Response.json({ data: { id: 't1' } })
    throw new Error(`Unexpected endpoint: ${url}`)
  }
  const credentials = { clientId: 'client-id', clientSecret: 'client-secret' }
  const { server, baseUrl } = await startServer(createApp({
    config: { providers: { meta: credentials, linkedin: credentials, x: credentials }, pollIntervalMs: 0 },
    fetchImpl,
  }))
  try {
    const { cookie, authorizationUrl } = await connect(baseUrl, 'x')
    assert.equal(new URL(authorizationUrl).searchParams.get('code_challenge_method'), 'S256')
    await connect(baseUrl, 'meta', cookie)
    await connect(baseUrl, 'linkedin', cookie)

    const { platforms } = await fetch(`${baseUrl}/api/platforms`, { headers: { cookie } }).then(response => response.json())
    assert.equal(platforms.instagram.username, 'awais.ig')
    assert.equal(platforms.facebook.username, 'Awais Page')
    assert.equal(platforms.linkedin.username, 'Awais Butt')
    assert.equal(platforms.x.username, 'awais_x')

    const { uploadId } = await fetch(`${baseUrl}/api/uploads`, { method: 'POST', headers: { cookie, 'content-type': 'video/mp4' }, body: 'video' }).then(response => response.json())
    const started = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        title: 'Launch',
        description: 'New video',
        tags: ['news'],
        location: { name: 'Lahore', placeId: '108105505876145' },
        consent: true,
        platforms: ['instagram', 'facebook', 'linkedin', 'x'],
      }),
    }).then(response => response.json())
    const job = await waitForJob(baseUrl, cookie, started.job.id)
    assert.deepEqual(Object.fromEntries(Object.entries(job.platforms).map(([id, entry]) => [id, entry.error || entry.url])), {
      instagram: 'https://www.instagram.com/reel/abc/',
      facebook: 'https://www.facebook.com/page-1/videos/fb-video-1',
      linkedin: 'https://www.linkedin.com/feed/update/urn:li:share:9/',
      x: 'https://x.com/awais_x/status/t1',
    })

    const igContainer = calls.find(call => call.url.endsWith('/ig-1/media'))
    const igParams = new URLSearchParams(igContainer.options.body)
    assert.equal(igParams.get('location_id'), '108105505876145')
    assert.equal(igParams.get('caption'), 'Launch\n\nNew video\n\n#news')
    const fbForm = calls.find(call => call.url.startsWith('https://graph-video.facebook.com/')).options.body
    assert.equal(fbForm.get('place'), '108105505876145')
    const tweet = JSON.parse(calls.find(call => call.url === 'https://api.x.com/2/tweets').options.body)
    assert.deepEqual(tweet, { text: 'Launch\n\nNew video\n\n#news\n\n📍 Lahore', media: { media_ids: ['m1'] } })
    const linkedinPost = JSON.parse(calls.find(call => call.url === 'https://api.linkedin.com/rest/posts').options.body)
    assert.equal(linkedinPost.author, 'urn:li:person:abc123')
    assert.equal(linkedinPost.content.media.id, 'urn:li:video:v1')
  } finally {
    await stopServer(server)
  }
})

test('a linked TikTok account stays connected until the user disconnects it', async () => {
  let mode = 'ok'
  const base = tiktokApi([])
  const dataDir = await mkdtemp(join(tmpdir(), 'platform-manager-keep-'))
  // Tokens come back already expired, so every status check goes through a refresh.
  const fetchImpl = combine(async (url, options) => {
    if (!String(url).endsWith('/v2/oauth/token/')) return base(url, options)
    if (new URLSearchParams(options.body).get('grant_type') === 'authorization_code') {
      return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 0, open_id: 'open-id', scope: 'user.info.basic,video.publish' })
    }
    if (mode === 'down') throw new TypeError('fetch failed')
    if (mode === 'revoked') return Response.json({ error: 'invalid_grant', error_description: 'Refresh token is invalid or expired.' }, { status: 400 })
    return Response.json({ access_token: 'fresh-access', refresh_token: 'rotated-refresh', expires_in: 0, scope: 'user.info.basic,video.publish' })
  })
  const { server, baseUrl } = await startServer(createApp({
    config: { providers: { tiktok: { clientId: 'tiktok-key', clientSecret: 'tiktok-secret' } }, dataDir },
    fetchImpl,
  }))

  try {
    const start = await fetch(`${baseUrl}/api/tiktok/oauth/start`, { method: 'POST' })
    assert.match(start.headers.get('set-cookie'), /Max-Age=34560000/)
    const { cookie } = await connect(baseUrl, 'tiktok')
    const status = () => fetch(`${baseUrl}/api/platforms`, { headers: { cookie } }).then(response => response.json())
    assert.equal((await status()).platforms.tiktok.connected, true)

    mode = 'down'
    const offline = (await status()).platforms.tiktok
    assert.equal(offline.connected, true, 'network failure must not look like a disconnect')
    assert.equal(offline.username, 'awais.butt.official')
    assert.match(offline.error.message, /connected hai/)

    mode = 'revoked'
    const revoked = await status()
    assert.equal(revoked.platforms.tiktok.connected, false)
    assert.equal(revoked.platforms.tiktok.error.code, 'TIKTOK_RECONNECT_REQUIRED')
    assert.equal(revoked.providers.find(provider => provider.id === 'tiktok').accountLinked, true, 'the app never unlinks on its own')

    mode = 'ok'
    assert.equal((await status()).platforms.tiktok.connected, true)
    const disconnected = await fetch(`${baseUrl}/api/tiktok/disconnect`, { method: 'POST', headers: { cookie } }).then(response => response.json())
    assert.equal(disconnected.connected, false)
    const after = await status()
    assert.equal(after.platforms.tiktok.connected, false)
    assert.equal(after.providers.find(provider => provider.id === 'tiktok').accountLinked, false)
  } finally {
    await stopServer(server)
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('token refresh runs once for parallel callers and only invalid_grant asks to reconnect', async () => {
  const { tiktok } = await import('./providers/tiktok.js')
  let refreshes = 0
  let reply = { access_token: 'fresh-access', refresh_token: 'rotated-refresh', expires_in: 86400, refresh_expires_in: 31536000 }
  const ctx = {
    config: { clientId: 'key', clientSecret: 'secret' },
    fetch: async () => {
      refreshes++
      await new Promise(resolve => setTimeout(resolve, 10))
      return Response.json(reply, { status: reply.error ? 400 : 200 })
    },
  }
  const account = { accessToken: 'old', refreshToken: 'first-refresh', expiresAt: Date.now() - 1 }
  await Promise.all([tiktok.ensureToken(ctx, account), tiktok.ensureToken(ctx, account), tiktok.ensureToken(ctx, account)])
  assert.equal(refreshes, 1)
  assert.equal(account.refreshToken, 'rotated-refresh')
  assert.ok(account.refreshExpiresAt > Date.now() + 300 * 24 * 60 * 60_000)

  account.expiresAt = 0
  reply = { error: 'server_error', error_description: 'try later' }
  await assert.rejects(tiktok.ensureToken(ctx, account), error => error.status === 502)
  reply = { error: 'invalid_grant', error_description: 'Refresh token is invalid or expired.' }
  await assert.rejects(tiktok.ensureToken(ctx, account), error => error.status === 401 && error.code === 'TIKTOK_RECONNECT_REQUIRED')
})
