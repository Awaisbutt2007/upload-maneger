import { apiError, requestJson, sleep } from '../http.js'
import { captionFor } from '../caption.js'

// One Meta app covers both the Facebook Page and the Instagram professional account linked to it.
const graph = config => `https://graph.facebook.com/${config.graphVersion || 'v24.0'}`
const graphVideo = config => `https://graph-video.facebook.com/${config.graphVersion || 'v24.0'}`
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
].join(',')

async function graphGet(ctx, path, params) {
  const url = new URL(`${graph(ctx.config)}${path}`)
  url.search = new URLSearchParams(params).toString()
  const { payload } = await requestJson(ctx.fetch, url, {}, { code: 'META_API_ERROR', label: 'Meta' })
  return payload
}

async function graphPost(ctx, path, params, base = graph(ctx.config)) {
  const { payload } = await requestJson(ctx.fetch, `${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  }, { code: 'META_API_ERROR', label: 'Meta' })
  return payload
}

function selectedPage(account) {
  return account.pages?.find(page => page.id === account.selectedPageId) || null
}

export const meta = {
  id: 'meta',
  label: 'Meta (Facebook + Instagram)',
  platforms: ['facebook', 'instagram'],
  scopes: SCOPES,
  envKeys: { clientId: 'META_APP_ID', clientSecret: 'META_APP_SECRET', redirectUri: 'META_REDIRECT_URI' },
  developerUrl: 'https://developers.facebook.com/apps',

  authorizationUrl({ config, state }) {
    const url = new URL(`https://www.facebook.com/${config.graphVersion || 'v24.0'}/dialog/oauth`)
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      scope: SCOPES,
      response_type: 'code',
    }).toString()
    return url.toString()
  },

  async exchangeCode(ctx, { code }) {
    const short = await graphGet(ctx, '/oauth/access_token', {
      client_id: ctx.config.clientId,
      client_secret: ctx.config.clientSecret,
      redirect_uri: ctx.config.redirectUri,
      code,
    })
    const long = await graphGet(ctx, '/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: ctx.config.clientId,
      client_secret: ctx.config.clientSecret,
      fb_exchange_token: short.access_token,
    })
    const account = {
      accessToken: long.access_token || short.access_token,
      expiresAt: long.expires_in ? Date.now() + Number(long.expires_in) * 1000 : null,
      pages: [],
      selectedPageId: '',
    }
    await this.loadPages(ctx, account)
    return account
  },

  async loadPages(ctx, account) {
    const me = await graphGet(ctx, '/me', { fields: 'id,name', access_token: account.accessToken })
    const pages = await graphGet(ctx, '/me/accounts', {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      limit: '100',
      access_token: account.accessToken,
    })
    account.userName = me.name || ''
    account.pages = (pages.data || []).map(page => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagram: page.instagram_business_account
        ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username || '' }
        : null,
    }))
    if (!account.pages.some(page => page.id === account.selectedPageId)) {
      account.selectedPageId = (account.pages.find(page => page.instagram) || account.pages[0])?.id || ''
    }
    return account
  },

  // Page tokens from a long-lived user token never expire, so posting keeps working after the 60-day user token lapses.
  async ensureToken(_ctx, account) {
    if (account.pages?.some(page => page.accessToken)) return account
    if (account.expiresAt && account.expiresAt < Date.now()) {
      throw apiError(401, 'META_RECONNECT_REQUIRED', 'Facebook/Instagram session expire ho gayi. Dobara connect karein.')
    }
    return account
  },

  async describe(ctx, account) {
    await this.ensureToken(ctx, account)
    const page = selectedPage(account)
    const pages = (account.pages || []).map(({ id, name, instagram }) => ({ id, name, instagram: instagram?.username || '' }))
    return {
      facebook: page
        ? { connected: true, username: page.name, options: { pages, selectedPageId: page.id } }
        : { connected: false, error: { message: 'Is Facebook account ke paas koi Page nahi mila. Video post karne ke liye Facebook Page chahiye.' } },
      instagram: page?.instagram
        ? { connected: true, username: page.instagram.username, options: { pages, selectedPageId: page.id } }
        : { connected: false, error: { message: page ? `Page "${page.name}" se koi Instagram Business/Creator account linked nahi hai.` : 'Instagram Business/Creator account ke liye Facebook Page zaroori hai.' } },
    }
  },

  selectPage(account, pageId) {
    if (!account.pages?.some(page => page.id === pageId)) throw apiError(400, 'PAGE_NOT_FOUND', 'Yeh Facebook Page is account mein nahi mila.')
    account.selectedPageId = pageId
  },

  async searchPlaces(ctx, account, query) {
    const payload = await graphGet(ctx, '/pages/search', {
      q: query,
      fields: 'id,name,location',
      limit: '10',
      access_token: account.accessToken,
    })
    return (payload.data || []).map(place => ({
      id: place.id,
      name: place.name,
      detail: [place.location?.city, place.location?.country].filter(Boolean).join(', '),
    }))
  },

  async publish(ctx, account, platform, { post, media, options = {}, onStage }) {
    await this.ensureToken(ctx, account)
    const page = selectedPage(account)
    if (!page) throw apiError(400, 'META_PAGE_REQUIRED', 'Settings mein Facebook Page select karein.')
    return platform === 'instagram'
      ? this.publishInstagram(ctx, page, { post, media, options, onStage })
      : this.publishFacebook(ctx, page, { post, media, onStage })
  },

  async publishFacebook(ctx, page, { post, media, onStage }) {
    if (!['video/mp4', 'video/quicktime'].includes(media.contentType)) {
      throw apiError(415, 'UNSUPPORTED_VIDEO_TYPE', 'Facebook ke liye MP4 ya MOV video chahiye.')
    }
    const caption = captionFor('facebook', post)
    onStage('uploading')
    const form = new FormData()
    form.set('access_token', page.accessToken)
    form.set('title', caption.title)
    form.set('description', caption.text)
    if (caption.placeId) form.set('place', caption.placeId)
    form.set('source', new Blob([await media.readAll()], { type: media.contentType }), media.name || 'video.mp4')
    const { payload } = await requestJson(ctx.fetch, `${graphVideo(ctx.config)}/${page.id}/videos`, {
      method: 'POST',
      body: form,
    }, { code: 'FACEBOOK_UPLOAD_FAILED', label: 'Facebook' })
    if (!payload.id) throw apiError(502, 'FACEBOOK_UPLOAD_FAILED', 'Facebook ne video id return nahi ki.')
    return { postId: payload.id, url: `https://www.facebook.com/${page.id}/videos/${payload.id}`, warning: '' }
  },

  async publishInstagram(ctx, page, { post, media, options, onStage }) {
    if (!page.instagram) throw apiError(400, 'INSTAGRAM_NOT_LINKED', 'Selected Facebook Page se Instagram professional account linked nahi hai.')
    if (!['video/mp4', 'video/quicktime'].includes(media.contentType)) {
      throw apiError(415, 'UNSUPPORTED_VIDEO_TYPE', 'Instagram Reels ke liye MP4 ya MOV video chahiye.')
    }
    const caption = captionFor('instagram', post)
    onStage('uploading')
    const params = {
      media_type: 'REELS',
      upload_type: 'resumable',
      caption: caption.text,
      share_to_feed: options.shareToFeed === false ? 'false' : 'true',
      access_token: page.accessToken,
    }
    if (caption.locationId) params.location_id = caption.locationId
    const container = await graphPost(ctx, `/${page.instagram.id}/media`, params)
    if (!container.id || !container.uri) throw apiError(502, 'INSTAGRAM_UPLOAD_FAILED', 'Instagram ne upload session return nahi ki.')

    await requestJson(ctx.fetch, container.uri, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${page.accessToken}`,
        offset: '0',
        file_size: String(media.size),
      },
      body: await media.readAll(),
    }, { code: 'INSTAGRAM_UPLOAD_FAILED', label: 'Instagram upload' })

    onStage('processing')
    const deadline = Date.now() + ctx.pollTimeoutMs
    let state = ''
    while (Date.now() < deadline) {
      await sleep(ctx.pollIntervalMs)
      const status = await graphGet(ctx, `/${container.id}`, { fields: 'status_code,status', access_token: page.accessToken })
      state = status.status_code
      if (state === 'FINISHED') break
      if (state === 'ERROR' || state === 'EXPIRED') {
        throw apiError(502, 'INSTAGRAM_PROCESSING_FAILED', `Instagram video process nahi kar saka: ${status.status || state}`)
      }
    }
    if (state !== 'FINISHED') throw apiError(504, 'INSTAGRAM_PROCESSING_TIMEOUT', 'Instagram processing mein zyada waqt lag gaya. Dobara try karein.')

    const published = await graphPost(ctx, `/${page.instagram.id}/media_publish`, {
      creation_id: container.id,
      access_token: page.accessToken,
    })
    let url = null
    try {
      const details = await graphGet(ctx, `/${published.id}`, { fields: 'permalink', access_token: page.accessToken })
      url = details.permalink || null
    } catch {}
    return { postId: published.id, url, warning: url ? '' : 'Instagram ne post publish kar di lekin link return nahi kiya.' }
  },
}
