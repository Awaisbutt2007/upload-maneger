const OFFLINE_MESSAGE = 'Backend server se connection nahi ho saka. `npm run dev` chal raha hai?'
// Static hosting (e.g. Vercel) answers /api/* with its own HTML 404 instead of our JSON errors.
const NO_BACKEND_MESSAGE = 'Is website par backend server nahi chal raha. App laptop par `npm run dev` se chalayein (http://localhost:3001).'

function failureMessage(status, payload, fallback) {
  if (payload.error?.message) return payload.error.message
  if (status === 404) return NO_BACKEND_MESSAGE
  return fallback
}

export async function api(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(OFFLINE_MESSAGE)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(failureMessage(response.status, payload, `Request fail ho gayi (${response.status}).`)), {
      status: response.status,
      code: payload.error?.code,
    })
  }
  return payload
}

let uploadModeRequest = null
const uploadMode = () => (uploadModeRequest ||= api('/api/health').then(health => health.uploadMode || 'direct').catch(() => 'direct'))

export async function uploadVideo(file, onProgress) {
  return (await uploadMode()) === 'blob' ? uploadToBlob(file, onProgress) : uploadDirect(file, onProgress)
}

// On Vercel the request body limit is 4.5 MB, so the browser sends the video straight to Blob storage.
async function uploadToBlob(file, onProgress) {
  const { upload } = await import('@vercel/blob/client')
  let blob
  try {
    blob = await upload(`videos/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/uploads/blob',
      contentType: file.type,
      multipart: file.size > 50 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
    })
  } catch (error) {
    throw new Error(`Upload fail ho gaya: ${error.message}`)
  }
  return api('/api/uploads/register', { method: 'POST', body: { url: blob.url, name: file.name } })
}

// XHR instead of fetch so the browser can report upload progress.
function uploadDirect(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/uploads')
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let payload = {}
      try { payload = JSON.parse(xhr.responseText) } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload)
      else reject(new Error(failureMessage(xhr.status, payload, `Upload fail ho gaya (${xhr.status}).`)))
    }
    xhr.onerror = () => reject(new Error('Upload ke dauran network error aaya.'))
    xhr.send(file)
  })
}
