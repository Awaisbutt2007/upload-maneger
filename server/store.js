import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const RESTART_MESSAGE = 'Server restart ho gaya tha jab yeh post chal rahi thi. Video dobara upload karein.'

// Sessions (connected accounts, upload jobs) keyed by the browser cookie; tokens never leave the server.
// With a databaseUrl they live in Postgres (serverless hosts such as Vercel have no lasting disk);
// with a dataDir they live in a JSON file that survives server restarts.
export function createSessionStore(dataDir, databaseUrl) {
  return databaseUrl ? createDatabaseStore(databaseUrl) : createFileStore(dataDir)
}

function createFileStore(dataDir) {
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
    // Everything is already in memory; these exist so callers can treat both stores alike.
    load: async id => sessions.get(id),
    loadAll: async () => [...sessions.values()],
    flush: async () => {},
    pin() {},
    unpin() {},
    get: id => sessions.get(id),
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

// Every request may land on a fresh serverless instance, so each one loads its session from
// Postgres and writes back only the top-level keys it changed: a status poll never overwrites
// progress that a running publish job saved in the meantime.
function createDatabaseStore(databaseUrl) {
  const sessions = new Map()
  const saved = new Map()
  // A session this instance is publishing from stays authoritative in memory until the job ends.
  const pinned = new Map()
  let ready = null
  let timer = null
  let writing = Promise.resolve()

  const sql = () => {
    ready ||= (async () => {
      const { neon } = await import('@neondatabase/serverless')
      const query = neon(databaseUrl)
      await query.query('CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())')
      return query
    })().catch(error => { ready = null; throw error })
    return ready
  }
  const snapshot = session => Object.fromEntries(Object.entries(session).map(([key, value]) => [key, JSON.stringify(value)]))
  const adopt = (id, data) => {
    if (pinned.has(id)) return sessions.get(id)
    sessions.set(id, data)
    saved.set(id, snapshot(data))
    return data
  }

  const flush = () => {
    clearTimeout(timer)
    timer = null
    writing = writing.then(async () => {
      for (const [id, session] of sessions) {
        const before = saved.get(id) || {}
        const after = snapshot(session)
        const changed = Object.keys(after).filter(key => after[key] !== before[key])
        if (!changed.length) continue
        const patch = `{${changed.map(key => `${JSON.stringify(key)}:${after[key]}`).join(',')}}`
        const query = await sql()
        await query.query(
          'INSERT INTO sessions (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = sessions.data || $2::jsonb, updated_at = now()',
          [id, patch],
        )
        saved.set(id, after)
      }
    }).catch(error => console.warn(`Could not save sessions: ${error.message}`))
    return writing
  }

  return {
    async load(id) {
      const rows = await (await sql()).query('SELECT data FROM sessions WHERE id = $1', [id])
      return rows[0] ? adopt(id, rows[0].data) : sessions.get(id)
    },
    async loadAll() {
      const rows = await (await sql()).query("SELECT id, data FROM sessions WHERE data->'accounts' <> '{}'::jsonb")
      return rows.map(row => adopt(row.id, row.data))
    },
    flush,
    pin: id => pinned.set(id, (pinned.get(id) || 0) + 1),
    unpin(id) {
      const count = (pinned.get(id) || 1) - 1
      if (count) pinned.set(id, count)
      else pinned.delete(id)
    },
    get: id => sessions.get(id),
    create(id) {
      const session = { accounts: {}, jobs: {}, uploads: {} }
      sessions.set(id, session)
      saved.set(id, {})
      return session
    },
    async delete(id) {
      sessions.delete(id)
      saved.delete(id)
      await (await sql()).query('DELETE FROM sessions WHERE id = $1', [id])
    },
    // Background work (a publish job) saves progress shortly after each change.
    persist() {
      if (timer) return
      timer = setTimeout(flush, 150)
      timer.unref?.()
    },
  }
}
