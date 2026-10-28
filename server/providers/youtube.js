import { apiError, platformErrorMessage, readJson, refreshOnce, requestJson } from '../http.js'
import { captionFor } from '../caption.js'

const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'
// Resumable chunks must be a multiple of 256 KiB.
const CHUNK = 32 * 256 * 1024

async function tokenRequest(ctx, body) {
  const { payload } = await requestJson(ctx.fetch, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  }, { code: 'YOUTUBE_OAUTH_FAILED', label: 'Google' })
  if (!payload.access_token) throw apiError(502, 'YOUTUBE_OAUTH_FAILED', 'Google ne access token return nahi kiya.')
  return payload
}

export const youtube = {
  id: 'youtube',
  label: 'YouTube',
  platforms: ['youtube'],
  scopes: SCOPES,
  envKeys: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET', redirectUri: 'GOOGLE_REDIRECT_URI' },
  developerUrl: 'https://console.cloud.google.com/apis/credentials',

  authorizationUrl({ config, state }) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString()
    return url.toString()
  },

  async exchangeCode(ctx, { code }) {
    const tokens = await tokenRequest(ctx, {
      code,
      client_id: ctx.config.clientId,
      client_secret: ctx.config.clientSecret,
      redirect_uri: ctx.config.redirectUri,
      grant_type: 'authorization_code',
    })
    if (!String(tokens.scope || '').includes('youtube.upload')) {
      throw apiError(400, 'YOUTUBE_SCOPE_MISSING', 'Google consent screen par YouTube upload permission allow karein.')
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt: Date.now() + (Number(tokens.expires_in) || 0) * 1000,
    }
  },

  async ensureToken(ctx, account) {
    if (account.expiresAt > Date.now() + 60_000) return account
    const reconnect = apiError(401, 'YOUTUBE_RECONNECT_REQUIRED', 'Google ne YouTube access wapas le liya. Dobara connect karein.')
    if (!account.refreshToken) throw reconnect
    return refreshOnce(account, async () => {
      const tokens = await tokenRequest(ctx, {
        client_id: ctx.config.clientId,
        client_secret: ctx.config.clientSecret,
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
      })
      account.accessToken = tokens.access_token
      account.refreshToken = tokens.refresh_token || account.refreshToken
      account.expiresAt = Date.now() + (Number(tokens.expires_in) || 0) * 1000
      return account
    }, reconnect)
  },

  async describe(ctx, account) {
    await this.ensureToken(ctx, account)
    if (!account.channelId) {
      const { payload } = await requestJson(ctx.fetch, 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      }, { code: 'YOUTUBE_API_ERROR', label: 'YouTube' })
      const channel = payload.items?.[0]
      if (!channel) return { youtube: { connected: false, error: { message: 'Is Google account par koi YouTube channel nahi hai. Pehle channel banayein.' } } }
      account.channelId = channel.id
      account.username = channel.snippet?.customUrl || channel.snippet?.title || ''
    }
    return { youtube: { connected: true, username: account.username, options: { privacyStatuses: ['public', 'unlisted', 'private'] } } }
  },

  async publish(ctx, account, _platform, { post, media, options = {}, onStage }) {
    await this.ensureToken(ctx, account)
    const caption = captionFor('youtube', post)
    const privacyStatus = ['public', 'unlisted', 'private'].includes(options.privacyStatus) ? options.privacyStatus : 'private'
    onStage('uploading')

    const session = await ctx.fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(media.size),
        'X-Upload-Content-Type': media.contentType,
      },
      body: JSON.stringify({
        snippet: { title: caption.title, description: caption.text, tags: caption.tags, categoryId: '22' },
        status: { privacyStatus, selfDeclaredMadeForKids: Boolean(options.madeForKids) },
      }),
    })
    const uploadUrl = session.headers.get('location')
    if (!session.ok || !uploadUrl) {
      throw apiError(502, 'YOUTUBE_UPLOAD_FAILED', `YouTube: ${platformErrorMessage(await readJson(session), `HTTP ${session.status}`)}`)
    }

    let video = null
    let start = 0
    while (start < media.size) {
      const end = Math.min(start + CHUNK, media.size)
      const response = await ctx.fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Length': String(end - start),
          'Content-Range': `bytes ${start}-${end - 1}/${media.size}`,
        },
        body: await media.readRange(start, end),
      })
      // 308 = chunk accepted; Range says how many bytes Google actually stored, which can be fewer than sent.
      if (response.status === 308) {
        const stored = response.headers.get('range')?.match(/bytes=0-(\d+)/)
        start = stored ? Number(stored[1]) + 1 : 0
        continue
      }
      const payload = await readJson(response)
      if (!response.ok) throw apiError(502, 'YOUTUBE_UPLOAD_FAILED', `YouTube: ${platformErrorMessage(payload, `HTTP ${response.status}`)}`)
      video = payload
      break
    }
    if (!video?.id) throw apiError(502, 'YOUTUBE_UPLOAD_FAILED', 'YouTube ne video id return nahi ki.')
    return {
      postId: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      warning: post.location?.name ? 'YouTube API location support nahi karti — location description mein add ki gayi.' : '',
    }
  },
}
