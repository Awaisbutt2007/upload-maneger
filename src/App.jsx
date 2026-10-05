import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Upload from './pages/Upload'
import Inbox from './pages/Inbox'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import './App.css'

const THEMES = {
  aqua:     { a1: '#06b6d4', a2: '#14b8a6', a3: '#0ea5e9', name: 'Aqua' },
  emerald:  { a1: '#10b981', a2: '#059669', a3: '#34d399', name: 'Emerald' },
  sunset:   { a1: '#f59e0b', a2: '#ef4444', a3: '#f97316', name: 'Sunset' },
  sky:      { a1: '#0ea5e9', a2: '#6366f1', a3: '#38bdf8', name: 'Sky' },
  rose:     { a1: '#f43f5e', a2: '#ec4899', a3: '#fb7185', name: 'Rose' },
  mono:     { a1: '#64748b', a2: '#1e293b', a3: '#94a3b8', name: 'Mono' },
}

const DEFAULT_LINKS = {
  tiktok:    { url: '', connected: false, accessToken: '', refreshToken: '', userHandle: '', postUrlTemplate: 'https://www.tiktok.com/@{handle}/video/{id}', expiresAt: null, authStatus: 'disconnected', clientKey: '' },
  instagram: { url: '', connected: false, accessToken: '', refreshToken: '', userHandle: '', postUrlTemplate: 'https://www.instagram.com/p/{id}/', expiresAt: null, authStatus: 'disconnected', clientKey: '' },
  linkedin:  { url: '', connected: false, accessToken: '', refreshToken: '', userHandle: '', postUrlTemplate: 'https://www.linkedin.com/feed/update/{id}/', expiresAt: null, authStatus: 'disconnected', clientKey: '' },
  twitter:   { url: '', connected: false, accessToken: '', refreshToken: '', userHandle: '', postUrlTemplate: 'https://twitter.com/{handle}/status/{id}', expiresAt: null, authStatus: 'disconnected', clientKey: '' },
  whatsapp:  { url: '', connected: false, accessToken: '', refreshToken: '', userHandle: '', postUrlTemplate: 'https://whatsapp.com/channel/{handle}/{id}', expiresAt: null, authStatus: 'disconnected', clientKey: '' },
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function App() {
  const STORAGE_KEY = 'platform-manager-state-v1'

  const [active, setActive] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY + ':active') || 'upload' }
    catch { return 'upload' }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY + ':collapsed') === '1' }
    catch { return false }
  })
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY + ':themeId') || 'aqua' }
    catch { return 'aqua' }
  })
  const [links, setLinks] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + ':links')
      if (raw) {
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_LINKS, ...parsed }
      }
    } catch {}
    return DEFAULT_LINKS
  })
  const [transfers, setTransfers] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + ':transfers')
      if (raw) return JSON.parse(raw)
    } catch {}
    return []
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY + ':active', active) } catch {}
  }, [active])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY + ':collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY + ':themeId', themeId) } catch {}
  }, [themeId])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY + ':links', JSON.stringify(links)) } catch {}
  }, [links])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY + ':transfers', JSON.stringify(transfers)) } catch {}
  }, [transfers])

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

  const renderPage = () => {
    switch (active) {
      case 'upload':
        return <Upload links={links} transfers={transfers} setTransfers={setTransfers} />
      case 'inbox':
        return <Inbox links={links} />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return (
          <Settings
            themeId={themeId}
            setThemeId={setThemeId}
            themes={THEMES}
            links={links}
            setLinks={setLinks}
          />
        )
      default:
        return <Upload links={links} transfers={transfers} setTransfers={setTransfers} />
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
