export function apiError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const refreshing = new WeakMap()

// One token refresh per account at a time: TikTok and X rotate refresh tokens, so a second
// parallel refresh would use an already-spent token. Only a token the platform rejected
// (invalid_grant) turns into "reconnect required"; network blips stay retryable.
export function refreshOnce(account, refresh, reconnectError) {
  if (!refreshing.has(account)) {
    const pending = refresh()
      .catch(error => { throw error.oauthError === 'invalid_grant' ? reconnectError : error })
      .finally(() => refreshing.delete(account))
    refreshing.set(account, pending)
  }
  return refreshing.get(account)
}

// Pulls a human readable message out of the different error shapes the platform APIs return.
export function platformErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = payload.error
  if (typeof error === 'string') return payload.error_description || error
  if (error?.message) return error.message
  if (error?.error_user_msg) return error.error_user_msg
  if (Array.isArray(payload.errors) && payload.errors[0]) {
    const first = payload.errors[0]
    return first.message || first.detail || first.title || fallback
  }
  return payload.detail || payload.message || payload.error_description || fallback
}

export async function readJson(response) {
  const text = await response.text().catch(() => '')
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { message: text.slice(0, 300) } }
}

// fetch + JSON parse; throws a 502 apiError with the platform's own message on failure.
export async function requestJson(fetchImpl, url, options, { code, label }) {
  const response = await fetchImpl(url, options)
  const payload = await readJson(response)
  if (!response.ok) {
    const error = apiError(502, code, `${label}: ${platformErrorMessage(payload, `HTTP ${response.status}`)}`)
    error.oauthError = typeof payload.error === 'string' ? payload.error : ''
    throw error
  }
  return { payload, response }
}
