import { createHash, randomBytes } from 'node:crypto'
import { apiError, readJson, refreshOnce, sleep } from '../http.js'
import { captionFor } from '../caption.js'

const API = 'https://open.tiktokapis.com'
const MIN_CHUNK = 5 * 1024 * 1024
const CHUNK = 10 * 1024 * 1024

async function tiktokRequest(ctx, path, accessToken, body) {
  const response = await ctx.fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  })
  const payload = await readJson(response)
  if (!response.ok || (payload.error?.code && payload.error.code !== 'ok')) {
    throw apiError(502, 'TIKTOK_API_ERROR', payload.error?.message || `TikTok API returned ${response.status}`)
  }
  return payload.data || {}
}

async function exchangeToken(ctx, body) {
  const response = await ctx.fetch(`${API}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams(body),
  })
  const payload = await readJson(response)
  if (!response.ok || payload.error || !payload.access_token) {
    const error = apiError(502, 'TIKTOK_OAUTH_FAILED', payload.error_description || 'TikTok token exchange failed')
    error.oauthError = typeof payload.error === 'string' ? payload.error : ''
    throw error
  }
  return payload
}

// TikTok wants floor(size / chunk) chunks; the last one absorbs the remainder.
export function tiktokChunks(size) {
  if (size < MIN_CHUNK * 2) return { chunkSize: size, ranges: [[0, size]] }
  const count = Math.floor(size / CHUNK)
  const ranges = []
  for (let index = 0; index < count; index++) {
    ranges.push([index * CHUNK, index === count - 1 ? size : (index + 1) * CHUNK])
  }
  return { chunkSize: CHUNK, ranges }
}

export const tiktok = {
  id: 'tiktok',
  label: 'TikTok',
  platforms: ['tiktok'],
  scopes: 'user.info.basic,video.publish',
  envKeys: { clientId: 'TIKTOK_CLIENT_KEY', clientSecret: 'TIKTOK_CLIENT_SECRET', redirectUri: 'TIKTOK_REDIRECT_URI' },
  developerUrl: 'https://developers.tiktok.com/apps',
  usesPkce: true,

  // TikTok expects the S256 challenge hex-encoded, not base64url like RFC 7636.
  pkcePair() {
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('hex')
    return { verifier, challenge }
  },

  authorizationUrl({ config, state, codeChallenge }) {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
    url.search = new URLSearchParams({
      client_key: config.clientId,
      scope: this.scopes,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString()
    return url.toString()
  },

  async exchangeCode(ctx, { code, codeVerifier }) {
    const tokens = await exchangeToken(ctx, {
      client_key: ctx.config.clientId,
      client_secret: ctx.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: ctx.config.redirectUri,
      code_verifier: codeVerifier,
    })
    if (!String(tokens.scope || '').split(',').includes('video.publish')) {
      throw apiError(400, 'TIKTOK_SCOPE_MISSING', 'TikTok app/user ne required video.publish scope approve nahi kiya.')
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      openId: tokens.open_id,
      scopes: tokens.scope || '',
      expiresAt: Date.now() + (Number(tokens.expires_in) || 0) * 1000,
      refreshExpiresAt: tokens.refresh_expires_in ? Date.now() + Number(tokens.refresh_expires_in) * 1000 : null,
    }
  },

  async ensureToken(ctx, account) {
    if (account.expiresAt > Date.now() + 60_000) return account
    const reconnect = apiError(401, 'TIKTOK_RECONNECT_REQUIRED', 'TikTok ne access wapas le liya (password change ya app permission remove). Dobara connect karein.')
    if (!account.refreshToken) throw reconnect
    return refreshOnce(account, async () => {
      const refreshed = await exchangeToken(ctx, {
        client_key: ctx.config.clientId,
        client_secret: ctx.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
      })
      // Every refresh also renews the 365-day refresh token, so a regularly refreshed account never expires.
      Object.assign(account, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || account.refreshToken,
        refreshExpiresAt: refreshed.refresh_expires_in ? Date.now() + Number(refreshed.refresh_expires_in) * 1000 : account.refreshExpiresAt,
        openId: refreshed.open_id || account.openId,
        scopes: refreshed.scope || account.scopes,
        expiresAt: Date.now() + (Number(refreshed.expires_in) || 0) * 1000,
        creatorInfoAt: 0,
      })
      return account
    }, reconnect)
  },

  async creatorInfo(ctx, account) {
    if (account.creatorInfo && Date.now() - (account.creatorInfoAt || 0) < 60_000) return account.creatorInfo
    const data = await tiktokRequest(ctx, '/v2/post/publish/creator_info/query/', account.accessToken, {})
    account.creatorInfo = data
    account.creatorInfoAt = Date.now()
    account.username = data.creator_username || ''
    return data
  },

  async describe(ctx, account) {
    await this.ensureToken(ctx, account)
    const creator = await this.creatorInfo(ctx, account)
    return {
      tiktok: {
        connected: true,
        username: creator.creator_username || '',
        displayName: creator.creator_nickname || '',
        options: {
          privacyLevels: creator.privacy_level_options || [],
          commentDisabled: Boolean(creator.comment_disabled),
          duetDisabled: Boolean(creator.duet_disabled),
          stitchDisabled: Boolean(creator.stitch_disabled),
          maxDurationSec: creator.max_video_post_duration_sec || null,
        },
      },
    }
  },

  // Uploads the video and returns the publish id; TikTok then processes it asynchronously.
  async startPublish(ctx, account, { caption, media, options = {} }) {
    await this.ensureToken(ctx, account)
    const creator = await this.creatorInfo(ctx, account)
    const privacyLevel = options.privacyLevel || ''
    if (!creator.privacy_level_options?.includes(privacyLevel)) {
      throw apiError(400, 'INVALID_PRIVACY_LEVEL', 'TikTok creator ki allowed privacy setting select karein.')
    }
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(media.contentType)) {
      throw apiError(415, 'UNSUPPORTED_VIDEO_TYPE', 'TikTok upload ke liye MP4, MOV ya WebM video select karein.')
    }

    const { chunkSize, ranges } = tiktokChunks(media.size)
    const postInfo = {
      title: caption,
      privacy_level: privacyLevel,
      disable_duet: Boolean(creator.duet_disabled || options.disableDuet),
      disable_comment: Boolean(creator.comment_disabled || options.disableComment),
      disable_stitch: Boolean(creator.stitch_disabled || options.disableStitch),
      video_cover_timestamp_ms: 1000,
    }
    if (options.brandOrganic) postInfo.brand_organic_toggle = true
    if (options.brandContent) postInfo.brand_content_toggle = true

    const initialized = await tiktokRequest(ctx, '/v2/post/publish/video/init/', account.accessToken, {
      post_info: postInfo,
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: media.size,
        chunk_size: chunkSize,
        total_chunk_count: ranges.length,
      },
    })
    if (!initialized.publish_id || !initialized.upload_url) throw apiError(502, 'TIKTOK_UPLOAD_INIT_FAILED', 'TikTok ne upload session return nahi ki.')
    const uploadUrl = new URL(initialized.upload_url)
    if (uploadUrl.protocol !== 'https:' || uploadUrl.hostname !== 'open-upload.tiktokapis.com') {
      throw apiError(502, 'TIKTOK_UPLOAD_URL_INVALID', 'TikTok upload URL expected host se match nahi karta.')
    }

    for (const [start, end] of ranges) {
      const chunk = await media.readRange(start, end)
      const uploadResponse = await ctx.fetch(initialized.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': media.contentType,
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end - 1}/${media.size}`,
        },
        body: chunk,
      })
      if (!uploadResponse.ok) throw apiError(502, 'TIKTOK_VIDEO_UPLOAD_FAILED', `TikTok video upload failed (${uploadResponse.status}).`)
    }
    return initialized.publish_id
  },

  async fetchStatus(ctx, account, publishId) {
    await this.ensureToken(ctx, account)
    const data = await tiktokRequest(ctx, '/v2/post/publish/status/fetch/', account.accessToken, { publish_id: publishId })
    const postId = data.publicaly_available_post_id?.[0]
    const shareUrl = data.status === 'PUBLISH_COMPLETE' && postId && account.username
      ? `https://www.tiktok.com/@${encodeURIComponent(account.username)}/video/${postId}`
      : null
    return { status: data.status, failReason: data.fail_reason || '', shareUrl }
  },

  async publish(ctx, account, _platform, { post, media, options, onStage }) {
    onStage('uploading')
    const publishId = await this.startPublish(ctx, account, { caption: captionFor('tiktok', post).text, media, options })
    onStage('processing')
    const deadline = Date.now() + ctx.pollTimeoutMs
    while (Date.now() < deadline) {
      await sleep(ctx.pollIntervalMs)
      const status = await this.fetchStatus(ctx, account, publishId)
      if (status.status === 'FAILED') throw apiError(502, 'TIKTOK_PUBLISH_FAILED', `TikTok ne post reject kar di: ${status.failReason || 'unknown reason'}`)
      if (status.status === 'PUBLISH_COMPLETE') {
        return {
          postId: publishId,
          url: status.shareUrl,
          warning: status.shareUrl ? '' : 'TikTok ne post confirm kar di lekin public link nahi diya (private post ho sakti hai).',
        }
      }
    }
    return { postId: publishId, url: null, warning: 'TikTok abhi bhi process kar raha hai — thori dair baad TikTok app mein check karein.' }
  },
}
