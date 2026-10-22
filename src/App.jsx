import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Upload from './pages/Upload'
import Inbox from './pages/Inbox'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import { api } from './api'
import { PLATFORM_BY_ID } from './platforms'
import './App.css'

const THEMES = {
  aqua:     { a1: '#06b6d4', a2: '#14b8a6', a3: '#0ea5e9', name: 'Aqua' },
  emerald:  { a1: '#10b981', a2: '#059669', a3: '#34d399', name: 'Emerald' },
  sunset:   { a1: '#f59e0b', a2: '#ef4444', a3: '#f97316', name: 'Sunset' },
  sky:      { a1: '#0ea5e9', a2: '#6366f1', a3: '#38bdf8', name: 'Sky' },
  rose:     { a1: '#f43f5e', a2: '#ec4899', a3: '#fb7185', name: 'Rose' },
  mono:     { a1: '#64748b', a2: '#1e293b', a3: '#94a3b8', name: 'Mono' },
}

const STORAGE_KEY = 'platform-manager-state-v1'
const DEFAULT_PROFILE = { name: 'Admin', email: '' }
const DEFAULT_POST_DEFAULTS = { tags: [], locationName: '', placeId: '', targets: null }
const DEFAULT_PREFS = { desktopNotify: false, sound: true, reducedMotion: false }

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${key}`)
      if (raw === null) return fallback
      const parsed = JSON.parse(raw)
      return fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? { ...fallback, ...parsed } : parsed
    } catch { return fallback }
  })
  useEffect(() => {
    try { localStorage.setItem(`${STORAGE_KEY}:${key}`, JSON.stringify(value)) } catch {}
  }, [key, value])
  return [value, setValue]
}

function playChime() {
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.12, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.5)
  } catch {}
}

function App() {
  const [active, setActive] = usePersistentState('page', 'upload')
  const [collapsed, setCollapsed] = usePersistentState('sidebarCollapsed', false)
  const [themeId, setThemeId] = usePersistentState('theme', 'aqua')
  const [profile, setProfile] = usePersistentState('profile', DEFAULT_PROFILE)
  const [postDefaults, setPostDefaults] = usePersistentState('postDefaults', DEFAULT_POST_DEFAULTS)
  const [prefs, setPrefs] = usePersistentState('prefs', DEFAULT_PREFS)
  const [transfers, setTransfers] = usePersistentState('transfers-v2', [])
  const [platformState, setPlatformState] = useState({ loading: true, providers: [], platforms: {}, canConfigure: false, error: '' })
  const [flash, setFlash] = useState(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const transfersRef = useRef(transfers)
  transfersRef.current = transfers

  const refreshPlatforms = useCallback(async () => {
    try {
      const data = await api('/api/platforms')
      setPlatformState({ loading: false, error: '', ...data })
    } catch (error) {
      setPlatformState(previous => ({ ...previous, loading: false, error: error.message }))
    }
  }, [])

  useEffect(() => { refreshPlatforms() }, [refreshPlatforms])

  // Returning from a platform's OAuth screen lands on /?oauth=...; show the result in Settings.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (!query.has('oauth')) return
    const provider = query.get('provider') || ''
    setFlash(query.get('oauth') === 'connected'
      ? { type: 'ok', msg: `${provider === 'meta' ? 'Facebook/Instagram' : PLATFORM_BY_ID[provider]?.label || provider} connect ho gaya!` }
      : { type: 'error', msg: query.get('message') || 'Authorization fail ho gayi.' })
    setActive('settings')
    window.history.replaceState({}, '', window.location.pathname)
  }, [setActive])

  useEffect(() => {
    const t = THEMES[themeId] || THEMES.aqua
    const root = document.documentElement
    root.style.setProperty('--accent-1', t.a1)
    root.style.setProperty('--accent-2', t.a2)
    root.style.setProperty('--accent-1-soft', `rgba(${hexToRgb(t.a1)}, 0.15)`)
    root.style.setProperty('--accent-2-soft', `rgba(${hexToRgb(t.a2)}, 0.15)`)
    root.style.setProperty('--accent-1-border', `rgba(${hexToRgb(t.a1)}, 0.4)`)
    root.style.setProperty('--accent-glow', `rgba(${hexToRgb(t.a1)}, 0.35)`)
    root.style.setProperty('--orb-1', `rgba(${hexToRgb(t.a1)}, 0.32)`)
    root.style.setProperty('--orb-2', `rgba(${hexToRgb(t.a2)}, 0.26)`)
    root.style.setProperty('--orb-3', `rgba(${hexToRgb(t.a3)}, 0.2)`)
  }, [themeId])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', Boolean(prefs.reducedMotion))
  }, [prefs.reducedMotion])

  const notifyFinished = useCallback((job, transfer) => {
    const results = Object.entries(job.platforms)
    const ok = results.filter(([, entry]) => entry.status === 'done').map(([id]) => PLATFORM_BY_ID[id]?.label || id)
    const failed = results.filter(([, entry]) => entry.status === 'failed').map(([id]) => PLATFORM_BY_ID[id]?.label || id)
    if (prefsRef.current.sound) playChime()
    if (prefsRef.current.desktopNotify && 'Notification' in window && Notification.permission === 'granted') {
      const body = [ok.length ? `Published: ${ok.join(', ')}` : '', failed.length ? `Failed: ${failed.join(', ')}` : ''].filter(Boolean).join(' · ')
      try { new Notification(`"${transfer.title || transfer.name}" upload complete`, { body }) } catch {}
    }
  }, [])

  // Poll the server for every post that is still being published.
  const runningKey = transfers.filter(transfer => transfer.status === 'running').map(transfer => transfer.id).join('|')
  useEffect(() => {
    if (!runningKey) return undefined
    let stopped = false
    const poll = async () => {
      for (const id of runningKey.split('|')) {
        try {
          const { job } = await api(`/api/publish/${id}`)
          if (stopped) return
          const existing = transfersRef.current.find(transfer => transfer.id === id)
          if (existing?.status === 'running' && job.status !== 'running') notifyFinished(job, existing)
          setTransfers(previous => previous.map(transfer => transfer.id !== id ? transfer : {
            ...transfer, status: job.status, platforms: job.platforms, finishedAt: job.finishedAt,
          }))
        } catch (error) {
          if (stopped || error.status !== 404) continue
          setTransfers(previous => previous.map(transfer => transfer.id !== id ? transfer : {
            ...transfer,
            status: 'failed',
            platforms: Object.fromEntries(Object.entries(transfer.platforms).map(([pid, entry]) => [pid,
              ['done', 'failed'].includes(entry.status) ? entry : { ...entry, status: 'failed', error: 'Server par yeh job nahi mili.' }])),
          }))
        }
      }
    }
    poll()
    const timer = setInterval(poll, 3000)
    return () => { stopped = true; clearInterval(timer) }
  }, [runningKey, setTransfers, notifyFinished])

  const runningCount = transfers.filter(transfer => transfer.status === 'running').length
  const shared = { platformState, refreshPlatforms, setActive }

  const renderPage = () => {
    switch (active) {
      case 'inbox':
        return <Inbox {...shared} transfers={transfers} />
      case 'analytics':
        return <Analytics transfers={transfers} />
      case 'settings':
        return (
          <Settings
            {...shared}
            themeId={themeId}
            setThemeId={setThemeId}
            themes={THEMES}
            profile={profile}
            setProfile={setProfile}
            postDefaults={postDefaults}
            setPostDefaults={setPostDefaults}
            prefs={prefs}
            setPrefs={setPrefs}
            setTransfers={setTransfers}
            flash={flash}
            clearFlash={() => setFlash(null)}
          />
        )
      default:
        return (
          <Upload
            {...shared}
            transfers={transfers}
            setTransfers={setTransfers}
            postDefaults={postDefaults}
            setPostDefaults={setPostDefaults}
          />
        )
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      <Sidebar
        active={active}
        setActive={setActive}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        runningCount={runningCount}
        profile={profile}
      />

      <main className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <div className="page-wrapper" key={active}>
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

export default App
