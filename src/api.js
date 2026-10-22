export async function api(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Backend server se connection nahi ho saka. `npm run dev` chal raha hai?')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(payload.error?.message || `Request fail ho gayi (${response.status}).`), {
      status: response.status,
      code: payload.error?.code,
    })
  }
  return payload
}

// XHR instead of fetch so the browser can report upload progress.
export function uploadVideo(file, onProgress) {
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
      else reject(new Error(payload.error?.message || `Upload fail ho gaya (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('Upload ke dauran network error aaya.'))
    xhr.send(file)
  })
}
