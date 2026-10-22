import { FaTiktok, FaInstagram, FaFacebook, FaYoutube, FaLinkedin, FaXTwitter } from 'react-icons/fa6'

// Display data for each publish target, in the same order as the server's PLATFORMS list.
export const PLATFORMS = [
  {
    id: 'tiktok', label: 'TikTok', Icon: FaTiktok, color: '#ff0050', gradient: 'linear-gradient(135deg, #ff0050, #00f2ea)',
    provider: 'tiktok', location: 'caption', inboxUrl: 'https://www.tiktok.com/messages',
  },
  {
    id: 'instagram', label: 'Instagram', Icon: FaInstagram, color: '#E1306C', gradient: 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)',
    provider: 'meta', location: 'native', inboxUrl: 'https://www.instagram.com/direct/inbox/',
  },
  {
    id: 'facebook', label: 'Facebook', Icon: FaFacebook, color: '#1877F2', gradient: 'linear-gradient(135deg, #1877F2, #0a4fb5)',
    provider: 'meta', location: 'native', inboxUrl: 'https://business.facebook.com/latest/inbox',
  },
  {
    id: 'youtube', label: 'YouTube', Icon: FaYoutube, color: '#FF0000', gradient: 'linear-gradient(135deg, #FF0000, #b30000)',
    provider: 'youtube', location: 'caption', inboxUrl: 'https://studio.youtube.com/',
  },
  {
    id: 'linkedin', label: 'LinkedIn', Icon: FaLinkedin, color: '#0A66C2', gradient: 'linear-gradient(135deg, #0A66C2, #004182)',
    provider: 'linkedin', location: 'caption', inboxUrl: 'https://www.linkedin.com/messaging/',
  },
  {
    id: 'x', label: 'X', Icon: FaXTwitter, color: '#e5e7eb', gradient: 'linear-gradient(135deg, #3f3f46, #0f0f10)',
    provider: 'x', location: 'caption', inboxUrl: 'https://x.com/messages',
  },
]

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map(platform => [platform.id, platform]))

export const PROVIDER_HELP = {
  tiktok: {
    title: 'TikTok Developer app',
    steps: [
      'developers.tiktok.com par app banayein, Login Kit aur Content Posting API products add karein.',
      'Scopes: user.info.basic aur video.publish.',
      'Neeche wala Redirect URI app mein register karein.',
      'Jab tak TikTok app audit approve na kare, posts sirf "Only me" (private) jayengi.',
    ],
  },
  meta: {
    title: 'Meta app (Facebook + Instagram)',
    steps: [
      'developers.facebook.com par "Business" type app banayein aur Facebook Login for Business add karein.',
      'Instagram account Professional (Business/Creator) ho aur kisi Facebook Page se linked ho.',
      'Permissions: pages_show_list, pages_manage_posts, pages_read_engagement, business_management, instagram_basic, instagram_content_publish.',
      'Redirect URI ko "Valid OAuth Redirect URIs" mein add karein. Dusre logon ke liye App Review zaroori hai.',
    ],
  },
  youtube: {
    title: 'Google Cloud OAuth client',
    steps: [
      'console.cloud.google.com par project banayein aur "YouTube Data API v3" enable karein.',
      'OAuth consent screen set karein aur apna email Test users mein add karein.',
      'Credentials → OAuth client ID (Web application) banayein, Redirect URI neeche wala dalein.',
      'Unverified apps ki videos YouTube khud private rakh sakta hai jab tak Google audit na ho.',
    ],
  },
  linkedin: {
    title: 'LinkedIn Developer app',
    steps: [
      'linkedin.com/developers par app banayein (ek Company Page se link karna hota hai).',
      'Products: "Share on LinkedIn" aur "Sign In with LinkedIn using OpenID Connect".',
      'Auth tab mein Redirect URI add karein.',
      'Token 60 din chalta hai, phir dobara connect karna hoga.',
    ],
  },
  x: {
    title: 'X Developer app',
    steps: [
      'developer.x.com par project/app banayein — video post karne ke liye paid API access chahiye.',
      'User authentication settings: OAuth 2.0, type "Web App (confidential client)", Read and write.',
      'Callback URI neeche wala dalein, phir OAuth 2.0 Client ID aur Secret copy karein.',
    ],
  },
}

export const PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: 'Everyone (public)',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
}

export function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${units[index]}`
}

export function timeAgo(timestamp) {
  const seconds = Math.round((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  return new Date(timestamp).toLocaleDateString()
}

// "@user" for handle-based platforms; Facebook shows the Page name as is.
export function displayHandle(id, username) {
  if (!username) return ''
  return id === 'facebook' || id === 'linkedin' ? username : `@${username.replace(/^@/, '')}`
}

// Server errors usually start with "<Platform>:" already; avoid printing the label twice.
export function platformMessage(id, text) {
  const label = PLATFORM_BY_ID[id]?.label || id
  return text.startsWith(`${label}:`) || text.startsWith(`${label} `) ? text : `${label}: ${text}`
}
