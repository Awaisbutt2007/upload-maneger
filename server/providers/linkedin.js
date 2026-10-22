import { apiError, requestJson, sleep } from '../http.js'
import { captionFor } from '../caption.js'

const SCOPES = 'openid profile w_member_social'

function restHeaders(ctx, account, extra = {}) {
  return {
    Authorization: `Bearer ${account.accessToken}`,
    'LinkedIn-Version': ctx.config.apiVersion || '202601',
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
    ...extra,
  }
}

export const linkedin = {
  id: 'linkedin',
  label: 'LinkedIn',
  platforms: ['linkedin'],
  scopes: SCOPES,
  envKeys: { clientId: 'LINKEDIN_CLIENT_ID', clientSecret: 'LINKEDIN_CLIENT_SECRET', redirectUri: 'LINKEDIN_REDIRECT_URI' },
  developerUrl: 'https://www.linkedin.com/developers/apps',

  authorizationUrl({ config, state }) {
    const url = new URL('https://www.linkedin.com/oauth/v2/authorization')
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: SCOPES,
    }).toString()
    return url.toString()
  },

  async exchangeCode(ctx, { code }) {
    const { payload } = await requestJson(ctx.fetch, 'https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: ctx.config.redirectUri,
        client_id: ctx.config.clientId,
        client_secret: ctx.config.clientSecret,
      }),
    }, { code: 'LINKEDIN_OAUTH_FAILED', label: 'LinkedIn' })
    if (!payload.access_token) throw apiError(502, 'LINKEDIN_OAUTH_FAILED', 'LinkedIn ne access token return nahi kiya.')
    const account = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || '',
      expiresAt: Date.now() + (Number(payload.expires_in) || 0) * 1000,
    }
    const { payload: profile } = await requestJson(ctx.fetch, 'https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    }, { code: 'LINKEDIN_API_ERROR', label: 'LinkedIn' })
    account.personUrn = `urn:li:person:${profile.sub}`
    account.username = profile.name || ''
    return account
  },

  async ensureToken(_ctx, account) {
    if (account.expiresAt > Date.now() + 60_000) return account
    throw apiError(401, 'LINKEDIN_RECONNECT_REQUIRED', 'LinkedIn session expire ho gayi (60 din). Dobara connect karein.')
  },

  async describe(ctx, account) {
    await this.ensureToken(ctx, account)
    return { linkedin: { connected: true, username: account.username } }
  },

  async publish(ctx, account, _platform, { post, media, onStage }) {
    await this.ensureToken(ctx, account)
    if (media.contentType !== 'video/mp4') throw apiError(415, 'UNSUPPORTED_VIDEO_TYPE', 'LinkedIn sirf MP4 video accept karta hai.')
    const caption = captionFor('linkedin', post)
    onStage('uploading')

    const { payload: init } = await requestJson(ctx.fetch, 'https://api.linkedin.com/rest/videos?action=initializeUpload', {
      method: 'POST',
      headers: restHeaders(ctx, account),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: account.personUrn,
          fileSizeBytes: media.size,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    }, { code: 'LINKEDIN_UPLOAD_FAILED', label: 'LinkedIn' })
    const { video, uploadInstructions = [], uploadToken = '' } = init.value || {}
    if (!video || !uploadInstructions.length) throw apiError(502, 'LINKEDIN_UPLOAD_FAILED', 'LinkedIn ne upload session return nahi ki.')

    const partIds = []
    for (const part of uploadInstructions) {
      const response = await ctx.fetch(part.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: await media.readRange(part.firstByte, part.lastByte + 1),
      })
      if (!response.ok) throw apiError(502, 'LINKEDIN_UPLOAD_FAILED', `LinkedIn video part upload failed (${response.status}).`)
      partIds.push(response.headers.get('etag'))
    }

    await requestJson(ctx.fetch, 'https://api.linkedin.com/rest/videos?action=finalizeUpload', {
      method: 'POST',
      headers: restHeaders(ctx, account),
      body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken, uploadedPartIds: partIds } }),
    }, { code: 'LINKEDIN_UPLOAD_FAILED', label: 'LinkedIn' })

    onStage('processing')
    const deadline = Date.now() + ctx.pollTimeoutMs
    let status = ''
    while (Date.now() < deadline) {
      await sleep(ctx.pollIntervalMs)
      const { payload } = await requestJson(ctx.fetch, `https://api.linkedin.com/rest/videos/${encodeURIComponent(video)}`, {
        headers: restHeaders(ctx, account),
      }, { code: 'LINKEDIN_API_ERROR', label: 'LinkedIn' })
      status = payload.status
      if (status === 'AVAILABLE') break
      if (status === 'PROCESSING_FAILED') throw apiError(502, 'LINKEDIN_PROCESSING_FAILED', 'LinkedIn video process nahi kar saka.')
    }
    if (status !== 'AVAILABLE') throw apiError(504, 'LINKEDIN_PROCESSING_TIMEOUT', 'LinkedIn processing mein zyada waqt lag gaya. Dobara try karein.')

    const { response } = await requestJson(ctx.fetch, 'https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: restHeaders(ctx, account),
      body: JSON.stringify({
        author: account.personUrn,
        commentary: caption.text,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { title: caption.title || 'Video', id: video } },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    }, { code: 'LINKEDIN_POST_FAILED', label: 'LinkedIn' })
    const postUrn = response.headers.get('x-restli-id') || ''
    return {
      postId: postUrn,
      url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : null,
      warning: post.location?.name ? 'LinkedIn API location support nahi karti — location text mein add ki gayi.' : '',
    }
  },
}
