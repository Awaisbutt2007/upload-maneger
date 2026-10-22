import { createHash, randomBytes } from 'node:crypto'
import { apiError, requestJson, sleep } from '../http.js'
import { captionFor } from '../caption.js'

const API = 'https://api.x.com/2'
const SCOPES = 'tweet.read tweet.write users.read media.write offline.access'
const CHUNK = 4 * 1024 * 1024

export function pkcePair() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function basicAuth(config) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
}

async function tokenRequest(ctx, body) {
  const { payload } = await requestJson(ctx.fetch, `${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuth(ctx.config) },
    body: new URLSearchParams({ ...body, client_id: ctx.config.clientId }),
  }, { code: 'X_OAUTH_FAILED', label: 'X' })
  if (!payload.access_token) throw apiError(502, 'X_OAUTH_FAILED', 'X ne access token return nahi kiya.')
  return payload
}

const bearer = account => ({ Authorization: `Bearer ${account.accessToken}` })

export const x = {
  id: 'x',
  label: 'X (Twitter)',
  platforms: ['x'],
  scopes: SCOPES,
  usesPkce: true,
  envKeys: { clientId: 'X_CLIENT_ID', clientSecret: 'X_CLIENT_SECRET', redirectUri: 'X_REDIRECT_URI' },
  developerUrl: 'https://developer.x.com/en/portal/dashboard',

  authorizationUrl({ config, state, codeChallenge }) {
    const url = new URL('https://x.com/i/oauth2/authorize')
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString()
    return url.toString()
  },

  async exchangeCode(ctx, { code, codeVerifier }) {
    const tokens = await tokenRequest(ctx, {
      code,
      grant_type: 'authorization_code',
      redirect_uri: ctx.config.redirectUri,
      code_verifier: codeVerifier,
    })
    const account = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: Date.now() + (Number(tokens.expires_in) || 0) * 1000,
    }
    const { payload } = await requestJson(ctx.fetch, `${API}/users/me`, { headers: bearer(account) }, { code: 'X_API_ERROR', label: 'X' })
    account.username = payload.data?.username || ''
    return account
  },

  async ensureToken(ctx, account) {
    if (account.expiresAt > Date.now() + 60_000) return account
    if (!account.refreshToken) throw apiError(401, 'X_RECONNECT_REQUIRED', 'X session expire ho gayi. Dobara connect karein.')
    const tokens = await tokenRequest(ctx, { grant_type: 'refresh_token', refresh_token: account.refreshToken })
    account.accessToken = tokens.access_token
    account.refreshToken = tokens.refresh_token || account.refreshToken
    account.expiresAt = Date.now() + (Number(tokens.expires_in) || 0) * 1000
    return account
  },

  async describe(ctx, account) {
    await this.ensureToken(ctx, account)
    return { x: { connected: true, username: account.username } }
  },

  async publish(ctx, account, _platform, { post, media, onStage }) {
    await this.ensureToken(ctx, account)
    if (!['video/mp4', 'video/quicktime'].includes(media.contentType)) {
      throw apiError(415, 'UNSUPPORTED_VIDEO_TYPE', 'X ke liye MP4 ya MOV video chahiye.')
    }
    const caption = captionFor('x', post)
    onStage('uploading')
    const json = { ...bearer(account), 'Content-Type': 'application/json' }

    const { payload: init } = await requestJson(ctx.fetch, `${API}/media/upload/initialize`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ media_type: media.contentType, total_bytes: media.size, media_category: 'tweet_video' }),
    }, { code: 'X_UPLOAD_FAILED', label: 'X' })
    const mediaId = init.data?.id
    if (!mediaId) throw apiError(502, 'X_UPLOAD_FAILED', 'X ne media id return nahi ki.')

    for (let start = 0, index = 0; start < media.size; start += CHUNK, index++) {
      const form = new FormData()
      form.set('segment_index', String(index))
      form.set('media', new Blob([await media.readRange(start, Math.min(start + CHUNK, media.size))]), 'chunk')
      await requestJson(ctx.fetch, `${API}/media/upload/${mediaId}/append`, {
        method: 'POST',
        headers: bearer(account),
        body: form,
      }, { code: 'X_UPLOAD_FAILED', label: 'X' })
    }

    const { payload: finalized } = await requestJson(ctx.fetch, `${API}/media/upload/${mediaId}/finalize`, {
      method: 'POST',
      headers: bearer(account),
    }, { code: 'X_UPLOAD_FAILED', label: 'X' })

    onStage('processing')
    let processing = finalized.data?.processing_info
    const deadline = Date.now() + ctx.pollTimeoutMs
    while (processing && processing.state !== 'succeeded' && Date.now() < deadline) {
      if (processing.state === 'failed') throw apiError(502, 'X_PROCESSING_FAILED', `X video process nahi kar saka: ${processing.error?.message || 'unknown'}`)
      await sleep(ctx.pollIntervalMs && Math.max(ctx.pollIntervalMs, (processing.check_after_secs || 0) * 1000))
      const { payload } = await requestJson(ctx.fetch, `${API}/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, {
        headers: bearer(account),
      }, { code: 'X_API_ERROR', label: 'X' })
      processing = payload.data?.processing_info
    }
    if (processing?.state === 'failed') throw apiError(502, 'X_PROCESSING_FAILED', `X video process nahi kar saka: ${processing.error?.message || 'unknown'}`)
    if (processing && processing.state !== 'succeeded') throw apiError(504, 'X_PROCESSING_TIMEOUT', 'X processing mein zyada waqt lag gaya. Dobara try karein.')

    const { payload: tweet } = await requestJson(ctx.fetch, `${API}/tweets`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ text: caption.text, media: { media_ids: [mediaId] } }),
    }, { code: 'X_POST_FAILED', label: 'X' })
    const tweetId = tweet.data?.id
    if (!tweetId) throw apiError(502, 'X_POST_FAILED', 'X ne post id return nahi ki.')
    return {
      postId: tweetId,
      url: `https://x.com/${account.username || 'i'}/status/${tweetId}`,
      warning: post.location?.name ? 'X API location place-id maangti hai — location text mein add ki gayi.' : '',
    }
  },
}
