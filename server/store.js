import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const RESTART_MESSAGE = 'Server restart ho gaya tha jab yeh post chal rahi thi. Video dobara upload karein.'

// Sessions (connected accounts, upload jobs) keyed by the browser cookie.
// With a dataDir they survive server restarts; tokens never leave the server.
export function createSessionStore(dataDir) {
  const sessions = new Map()
  const file = dataDir ? join(dataDir, 'sessions.json') : null

  if (file && existsSync(file)) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      for (const [id, session] of Object.entries(saved)) {
        for (const job of Object.values(session.jobs || {})) {
          if (job.status !== 'running') continue
          job.status = 'failed'
          for (const entry of Object.values(job.platforms)) {
            if (['done', 'failed'].includes(entry.status)) continue
            entry.status = 'failed'
            entry.error = RESTART_MESSAGE
          }
        }
        session.uploads = {}
        sessions.set(id, session)
      }
    } catch (error) {
      console.warn(`Could not read ${file}: ${error.message}`)
    }
  }

  let timer = null
  let writing = Promise.resolve()
  const persist = () => {
    if (!file || timer) return
    timer = setTimeout(() => {
      timer = null
      const snapshot = JSON.stringify(Object.fromEntries(sessions), (key, value) => key === 'uploads' ? {} : value)
      writing = writing.then(async () => {
        mkdirSync(dataDir, { recursive: true })
        await writeFile(`${file}.tmp`, snapshot, { encoding: 'utf8', mode: 0o600 })
        await rename(`${file}.tmp`, file)
      }).catch(error => console.warn(`Could not save sessions: ${error.message}`))
    }, 150)
    timer.unref?.()
  }

  return {
    get: id => sessions.get(id),
    all: () => [...sessions.values()],
    create(id) {
      const session = { accounts: {}, jobs: {}, uploads: {} }
      sessions.set(id, session)
      persist()
      return session
    },
    delete(id) {
      sessions.delete(id)
      persist()
    },
    persist,
  }
}
