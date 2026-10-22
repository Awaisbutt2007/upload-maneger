// Turns one post (title, description, tags, location) into the text each platform accepts.

export function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(/[\s,]+/)
  const seen = new Set()
  const result = []
  for (const raw of list) {
    const tag = String(raw || '').trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')
    if (!tag || tag.length > 100 || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    result.push(tag)
  }
  return result
}

export function normalizePost(input = {}) {
  const location = input.location && typeof input.location === 'object' ? input.location : {}
  return {
    title: String(input.title || '').trim().slice(0, 300),
    description: String(input.description || '').trim().slice(0, 5000),
    tags: normalizeTags(input.tags).slice(0, 60),
    location: {
      name: String(location.name || '').trim().slice(0, 120),
      placeId: /^\d{3,30}$/.test(String(location.placeId || '').trim()) ? String(location.placeId).trim() : '',
    },
  }
}

const hashtags = (tags, limit = tags.length) => tags.slice(0, limit).map(tag => `#${tag}`).join(' ')
const locationLine = post => post.location.name ? `📍 ${post.location.name}` : ''

function joinBlocks(blocks) {
  return blocks.map(block => (block || '').trim()).filter(Boolean).join('\n\n')
}

// Shortens the body so that the fixed suffix (tags, location) always survives.
function fit(body, suffix, max) {
  const full = joinBlocks([body, suffix])
  if ([...full].length <= max) return full
  const room = max - [...joinBlocks(['x', suffix])].length
  if (room <= 1) return [...joinBlocks([body])].slice(0, max - 1).join('') + '…'
  return joinBlocks([[...body].slice(0, room - 1).join('').trimEnd() + '…', suffix])
}

// Count used by X: most characters count 1, emoji and CJK count 2.
export function xLength(text) {
  let total = 0
  for (const char of text) total += char.codePointAt(0) > 0x10ff ? 2 : 1
  return total
}

function fitX(body, suffix, max = 280) {
  let candidate = joinBlocks([body, suffix])
  if (xLength(candidate) <= max) return candidate
  let chars = [...body]
  while (chars.length && xLength(joinBlocks([chars.join('').trimEnd() + '…', suffix])) > max) chars = chars.slice(0, -1)
  candidate = chars.length ? joinBlocks([chars.join('').trimEnd() + '…', suffix]) : suffix
  while (xLength(candidate) > max) candidate = [...candidate].slice(0, -1).join('')
  return candidate
}

// LinkedIn "little text" format reserves these characters.
const escapeLinkedIn = text => text.replace(/[\\|{}@[\]()<>#*_~]/g, char => `\\${char}`)

export function captionFor(platform, rawPost) {
  const post = rawPost.tags && rawPost.location ? rawPost : normalizePost(rawPost)
  const body = joinBlocks([post.title, post.description])
  const tagText = hashtags(post.tags)
  const nativeLocation = Boolean(post.location.placeId)

  switch (platform) {
    case 'tiktok':
      return { text: fit(body, joinBlocks([tagText, locationLine(post)]), 2200) }
    case 'instagram':
      return {
        text: fit(body, joinBlocks([hashtags(post.tags, 30), nativeLocation ? '' : locationLine(post)]), 2200),
        locationId: post.location.placeId || '',
      }
    case 'facebook':
      return {
        title: post.title.slice(0, 255),
        text: fit(post.description || post.title, joinBlocks([tagText, nativeLocation ? '' : locationLine(post)]), 5000),
        placeId: post.location.placeId || '',
      }
    case 'youtube': {
      const clean = text => text.replace(/[<>]/g, '')
      const tags = []
      let tagChars = 0
      for (const tag of post.tags) {
        if (tagChars + tag.length + 1 > 480) break
        tags.push(tag)
        tagChars += tag.length + 1
      }
      return {
        title: clean(post.title || post.description.split('\n')[0] || 'Untitled video').slice(0, 100),
        text: clean(fit(post.description, joinBlocks([tagText, locationLine(post)]), 5000)),
        tags,
      }
    }
    case 'linkedin': {
      const tagTemplates = post.tags.map(tag => `{hashtag|\\#|${tag}}`).join(' ')
      const location = post.location.name ? `📍 ${escapeLinkedIn(post.location.name)}` : ''
      return {
        title: post.title.slice(0, 200),
        text: fit(escapeLinkedIn(body), joinBlocks([tagTemplates, location]), 3000),
      }
    }
    case 'x':
      return { text: fitX(body, joinBlocks([tagText, locationLine(post)])) }
    default:
      return { text: fit(body, tagText, 2200) }
  }
}
