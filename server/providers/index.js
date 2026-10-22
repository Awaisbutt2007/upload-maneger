import { tiktok } from './tiktok.js'
import { meta } from './meta.js'
import { youtube } from './youtube.js'
import { linkedin } from './linkedin.js'
import { x } from './x.js'

export const PROVIDERS = { tiktok, meta, youtube, linkedin, x }

// Publish targets shown in the UI, in display order.
export const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'x']

export function providerForPlatform(platform) {
  return Object.values(PROVIDERS).find(provider => provider.platforms.includes(platform)) || null
}
