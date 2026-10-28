import { useEffect, useState } from 'react'
import {
  FaUser, FaBell, FaPalette, FaLink, FaHashtag, FaExclamationTriangle, FaCheck, FaExternalLinkAlt,
  FaPlug, FaSpinner, FaInfoCircle, FaUnlock, FaEye, FaEyeSlash, FaExclamationCircle, FaCopy, FaSave,
  FaKey, FaMapMarkerAlt, FaVolumeUp,
} from 'react-icons/fa'
import { api } from '../api'
import { PLATFORMS, PLATFORM_BY_ID, PROVIDER_HELP, displayHandle } from '../platforms'
import './pages.css'

const tabs = [
  { id: 'accounts', label: 'Accounts', icon: FaLink, subtitle: 'Social media accounts connect karein' },
  { id: 'defaults', label: 'Post Defaults', icon: FaHashtag, subtitle: 'Har upload par pehle se bhare tags, location aur platforms' },
  { id: 'profile', label: 'Profile', icon: FaUser, subtitle: 'Sidebar mein dikhne wala naam' },
  { id: 'notifications', label: 'Notifications', icon: FaBell, subtitle: 'Post publish hone par alert' },
  { id: 'appearance', label: 'Appearance', icon: FaPalette, subtitle: 'Theme aur animations' },
]

function Toggle({ checked, onChange, label, sub }) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} />
    </div>
  )
}

function ProviderCard({ provider, platforms, canConfigure, showToast, refreshPlatforms }) {
  const linkedPlatforms = provider.platforms.map(id => ({ meta: PLATFORM_BY_ID[id], info: platforms[id] || {} }))
  const anyConnected = linkedPlatforms.some(item => item.info.connected)
  const [expanded, setExpanded] = useState(!provider.configured)
  const [busy, setBusy] = useState('')
  const [form, setForm] = useState({ clientId: provider.clientId || '', clientSecret: '' })
  const [secretVisible, setSecretVisible] = useState(false)
  const help = PROVIDER_HELP[provider.id]
  const MainIcon = linkedPlatforms[0].meta.Icon
  const pageOptions = linkedPlatforms[0].info.options?.pages || []

  const connect = async () => {
    setBusy('connect')
    try {
      const { authorizationUrl } = await api(`/api/${provider.id}/oauth/start`, { method: 'POST' })
      window.location.assign(authorizationUrl)
    } catch (error) {
      showToast(error.message, 'error')
      setBusy('')
    }
  }

  const disconnect = async () => {
    setBusy('disconnect')
    try {
      await api(`/api/${provider.id}/disconnect`, { method: 'POST' })
      await refreshPlatforms()
      showToast(`${provider.label} disconnect ho gaya.`, 'info')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const saveConfig = async event => {
    event.preventDefault()
    setBusy('config')
    try {
      await api(`/api/${provider.id}/config`, { method: 'POST', body: form })
      setForm(previous => ({ ...previous, clientSecret: '' }))
      await refreshPlatforms()
      showToast(`${provider.label} credentials save ho gayi. Ab Connect dabayein.`, 'ok')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const selectPage = async pageId => {
    setBusy('page')
    try {
      await api('/api/meta/page', { method: 'POST', body: { pageId } })
      await refreshPlatforms()
      showToast('Facebook Page select ho gaya.', 'ok')
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); showToast('Redirect URI copy ho gaya.', 'ok') }
    catch { showToast('Copy nahi ho saka — khud select karke copy karein.', 'error') }
  }

  return (
    <div className={`platform-card advanced ${anyConnected ? 'connected' : ''} ${expanded ? 'expanded' : ''}`}>
      <div className="platform-card-top">
        <div className="platform-icon" style={{ background: linkedPlatforms[0].meta.gradient }}>
          <MainIcon />
        </div>

        <div className="platform-info">
          <div className="platform-head">
            <h4 className="platform-name">{provider.label}</h4>
            {!provider.configured && <span className="badge badge-amber">Setup needed</span>}
          </div>
          <div className="provider-status">
            {linkedPlatforms.map(({ meta, info }) => {
              const { Icon } = meta
              return (
                <span key={meta.id} className={`badge ${info.connected ? 'badge-green' : info.error ? 'badge-amber' : 'badge-slate'}`} title={info.error?.message}>
                  <Icon /> {meta.label}: {info.connected ? displayHandle(meta.id, info.username) || 'Connected' : info.error ? 'Action needed' : 'Not connected'}
                </span>
              )
            })}
          </div>
          {linkedPlatforms.filter(item => item.info.error).map(({ meta, info }) => (
            <div key={meta.id} className="provider-error"><FaExclamationTriangle /> {meta.label}: {info.error.message}</div>
          ))}
        </div>

        <div className="provider-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
            {expanded ? 'Hide setup' : 'Setup'}
          </button>
          {provider.accountLinked ? (
            <>
              <button type="button" className="btn btn-secondary" disabled={!!busy || !provider.configured} onClick={connect} title="Permissions dobara approve karein">
                {busy === 'connect' ? <FaSpinner className="spin" /> : <FaUnlock />} Reconnect
              </button>
              <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={disconnect}>
                {busy === 'disconnect' ? <FaSpinner className="spin" /> : <FaPlug />} Disconnect
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!!busy || !provider.configured} onClick={connect} title={provider.configured ? '' : 'Pehle Setup mein credentials save karein'}>
              {busy === 'connect' ? <FaSpinner className="spin" /> : <FaUnlock />} Connect
            </button>
          )}
        </div>
      </div>

      {provider.id === 'meta' && pageOptions.length > 1 && (
        <div className="page-picker">
          <label className="adv-label" htmlFor="meta-page">Facebook Page (Instagram isi Page se linked hona chahiye)</label>
          <select id="meta-page" className="form-input" value={linkedPlatforms[0].info.options?.selectedPageId || ''} disabled={!!busy} onChange={event => selectPage(event.target.value)}>
            {pageOptions.map(page => (
              <option key={page.id} value={page.id}>{page.name}{page.instagram ? ` · IG @${page.instagram}` : ' · no Instagram'}</option>
            ))}
          </select>
        </div>
      )}

      {expanded && (
        <div className="platform-card-expand">
          <div className="setup-help">
            <div className="setup-help-title">{help.title}</div>
            <ol>
              {help.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
            <a href={provider.developerUrl} target="_blank" rel="noreferrer" className="link-hover setup-link">
              Developer portal kholein <FaExternalLinkAlt style={{ display: 'inline' }} />
            </a>
          </div>

          <label className="adv-label"><FaLink /> Redirect URI (developer app mein exactly yahi register karein)</label>
          <div className="adv-input-wrap">
            <input className="form-input mono" readOnly value={provider.redirectUri} onFocus={event => event.target.select()} />
            <button type="button" className="adv-suffix-btn" onClick={() => copy(provider.redirectUri)} title="Copy" aria-label="Copy redirect URI"><FaCopy /></button>
          </div>
          <div className="adv-scopes">Scopes: <code>{provider.scopes}</code></div>

          {canConfigure ? (
            <form className="adv-grid" onSubmit={saveConfig} style={{ marginTop: 16 }}>
              <div className="adv-field">
                <label className="adv-label" htmlFor={`${provider.id}-client-id`}><FaKey /> {provider.id === 'tiktok' ? 'Client Key' : provider.id === 'meta' ? 'App ID' : 'Client ID'}</label>
                <input
                  id={`${provider.id}-client-id`}
                  className="form-input"
                  autoComplete="off"
                  value={form.clientId}
                  onChange={event => setForm(previous => ({ ...previous, clientId: event.target.value }))}
                  placeholder={provider.configured ? 'Saved — badalne ke liye naya dalein' : 'Developer portal se copy karein'}
                  required
                />
              </div>
              <div className="adv-field">
                <label className="adv-label" htmlFor={`${provider.id}-client-secret`}><FaKey /> {provider.id === 'meta' ? 'App Secret' : 'Client Secret'}</label>
                <div className="adv-input-wrap">
                  <input
                    id={`${provider.id}-client-secret`}
                    className="form-input"
                    type={secretVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.clientSecret}
                    onChange={event => setForm(previous => ({ ...previous, clientSecret: event.target.value }))}
                    placeholder={provider.configured ? '•••••••• saved (security ke liye chhupa hai) — badalne ke liye naya dalein' : 'Server par save hoga, browser mein nahi'}
                    required
                  />
                  <button type="button" className="adv-suffix-btn" onClick={() => setSecretVisible(value => !value)} title={secretVisible ? 'Hide secret' : 'Show secret'} aria-label={secretVisible ? 'Hide secret' : 'Show secret'}>
                    {secretVisible ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div className="adv-field full">
                <button className="btn btn-primary" type="submit" disabled={busy === 'config'}>
                  {busy === 'config' ? <FaSpinner className="spin" /> : <FaSave />} Save credentials
                </button>
                {provider.configured && <span className="badge badge-green" style={{ marginLeft: 10 }}><FaCheck /> Credentials saved</span>}
              </div>
            </form>
          ) : (
            <div className="adv-summary warn" style={{ marginTop: 16 }}>
              Credentials form sirf local server (localhost) par khulta hai. Production mein hosting ke environment variables set karein (dekhein <code>.env.example</code>).
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Settings({
  platformState, refreshPlatforms, themeId, setThemeId, themes, profile, setProfile, postDefaults, setPostDefaults,
  prefs, setPrefs, setTransfers, flash, clearFlash,
}) {
  const [tab, setTab] = useState('accounts')
  const [toast, setToast] = useState(null)
  const [tagText, setTagText] = useState((postDefaults.tags || []).map(tag => `#${tag}`).join(' '))
  const platforms = platformState.platforms || {}
  const connectedCount = PLATFORMS.filter(platform => platforms[platform.id]?.connected).length

  const showToast = (msg, type = 'ok') => setToast({ msg, type, at: Date.now() })

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!flash) return
    showToast(flash.msg, flash.type)
    clearFlash()
    refreshPlatforms()
  }, [flash])

  const saveTags = text => {
    const tags = [...new Set(text.split(/[\s,]+/).map(tag => tag.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean))].slice(0, 30)
    setPostDefaults(previous => ({ ...previous, tags }))
    setTagText(tags.map(tag => `#${tag}`).join(' '))
  }

  const toggleDefaultTarget = id => setPostDefaults(previous => {
    const current = previous.targets?.length ? previous.targets : PLATFORMS.filter(platform => platforms[platform.id]?.connected).map(platform => platform.id)
    const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    return { ...previous, targets: next }
  })

  const setDesktopNotify = async enabled => {
    if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showToast('Browser ne notification permission nahi di.', 'error')
        return
      }
    }
    if (enabled && !('Notification' in window)) {
      showToast('Yeh browser desktop notifications support nahi karta.', 'error')
      return
    }
    setPrefs(previous => ({ ...previous, desktopNotify: enabled }))
  }

  const resetAll = async () => {
    if (!window.confirm('Saare accounts disconnect aur post history delete ho jayegi. Continue?')) return
    await Promise.allSettled(platformState.providers.filter(provider => provider.accountLinked).map(provider => api(`/api/${provider.id}/disconnect`, { method: 'POST' })))
    setTransfers([])
    await refreshPlatforms()
    showToast('Accounts disconnect aur history clear ho gayi.', 'info')
  }

  const activeTab = tabs.find(item => item.id === tab)
  const ActiveIcon = activeTab.icon
  const defaultTargets = postDefaults.targets?.length ? postDefaults.targets : PLATFORMS.filter(platform => platforms[platform.id]?.connected).map(platform => platform.id)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Har change khud-ba-khud save hota hai</p>
        </div>
      </header>

      {toast && (
        <div className={`toast ${toast.type}`} role="status" style={{ animation: 'toastIn 0.4s ease both' }} key={toast.at}>
          {toast.type === 'error' ? <FaExclamationCircle /> : toast.type === 'info' ? <FaInfoCircle /> : <FaCheck />} {toast.msg}
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-tabs glass-card" style={{ animation: 'slideInLeft 0.5s ease both', animationDelay: '0.1s' }}>
          {tabs.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`settings-tab ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
                style={{ animation: 'fadeIn 0.4s ease both', animationDelay: `${0.12 + index * 0.04}s` }}
              >
                <Icon className="tab-icon" />
                <span>{item.label}</span>
                {item.id === 'accounts' && <span className="tab-count">{connectedCount}/{PLATFORMS.length}</span>}
              </button>
            )
          })}

          <div className="danger-zone" style={{ animation: 'fadeIn 0.5s ease both', animationDelay: '0.4s' }}>
            <div className="danger-icon"><FaExclamationTriangle /></div>
            <div className="danger-text">
              <div className="danger-title">Danger Zone</div>
              <div className="danger-sub">Sab disconnect + history clear</div>
            </div>
            <button className="btn btn-ghost danger-btn" onClick={resetAll}>Reset</button>
          </div>
        </div>

        <div className="settings-content glass-card" style={{ animation: 'slideInRight 0.5s ease both', animationDelay: '0.12s' }} key={tab}>
          <div className="settings-head">
            <div className="settings-head-icon"><ActiveIcon /></div>
            <div>
              <h2 className="settings-title">{activeTab.label}</h2>
              <p className="settings-subtitle">{activeTab.subtitle}</p>
            </div>
          </div>

          {tab === 'accounts' && (
            <div className="settings-body">
              <div className="disclaimer-block">
                <div className="disclaimer-icon"><FaInfoCircle /></div>
                <div>
                  <div className="disclaimer-title">Har platform ke liye ek dafa setup</div>
                  <div className="disclaimer-body">
                    1) "Setup" kholein aur us platform ki developer app banayein · 2) Redirect URI wahan register karein ·
                    3) Client ID/Secret yahan save karein · 4) "Connect" dabayein aur apne account se login karein.
                    Tokens sirf aapke server par rehte hain.
                  </div>
                </div>
              </div>

              {platformState.error && (
                <div className="adv-summary warn"><FaExclamationTriangle /> {platformState.error}</div>
              )}

              <div className="platform-list platform-list-advanced">
                {platformState.providers.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    platforms={platforms}
                    canConfigure={platformState.canConfigure}
                    showToast={showToast}
                    refreshPlatforms={refreshPlatforms}
                  />
                ))}
                {platformState.loading && !platformState.providers.length && (
                  <div className="settings-inline-hint"><FaSpinner className="spin" /> Platforms load ho rahe hain…</div>
                )}
              </div>

              <div className="settings-section">
                <h3 className="section-title-sm">WhatsApp</h3>
                <p className="settings-inline-hint">
                  WhatsApp Channels par post karne ki koi public API nahi hai, is liye WhatsApp auto-publish mein shamil nahi hai.
                  Video publish hone ke baad post ka link WhatsApp par khud share kar sakte hain.
                </p>
              </div>
            </div>
          )}

          {tab === 'defaults' && (
            <div className="settings-body">
              <div className="settings-section">
                <h3 className="section-title-sm"><FaHashtag /> Default tags</h3>
                <input
                  className="form-input"
                  value={tagText}
                  onChange={event => setTagText(event.target.value)}
                  onBlur={event => saveTags(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') saveTags(event.currentTarget.value) }}
                  placeholder="#vlog #travel #pakistan"
                />
                <p className="settings-inline-hint">Yeh tags har naye upload mein pehle se lage honge (upload form mein hata bhi sakte hain).</p>
              </div>

              <div className="settings-section">
                <h3 className="section-title-sm"><FaMapMarkerAlt /> Default location</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="default-location">Location name</label>
                    <input id="default-location" className="form-input" value={postDefaults.locationName || ''} onChange={event => setPostDefaults(previous => ({ ...previous, locationName: event.target.value, placeId: '' }))} placeholder="Lahore, Pakistan" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="default-place">Facebook/Instagram Place ID (optional)</label>
                    <input id="default-place" className="form-input" value={postDefaults.placeId || ''} onChange={event => setPostDefaults(previous => ({ ...previous, placeId: event.target.value.replace(/\D/g, '') }))} placeholder="e.g. 108105505876145" />
                  </div>
                </div>
                <p className="settings-inline-hint">
                  Instagram aur Facebook par Place ID se asli location tag lagta hai. TikTok, YouTube, LinkedIn aur X ki API location tag nahi leti — wahan location caption mein "📍 name" ki tarah jati hai.
                </p>
              </div>

              <div className="settings-section">
                <h3 className="section-title-sm">Default platforms</h3>
                <div className="default-targets">
                  {PLATFORMS.map(platform => {
                    const info = platforms[platform.id] || {}
                    const { Icon } = platform
                    return (
                      <label key={platform.id} className={`default-target ${info.connected ? '' : 'disabled'}`} style={{ '--pcol': platform.color }}>
                        <input type="checkbox" checked={info.connected && defaultTargets.includes(platform.id)} disabled={!info.connected} onChange={() => toggleDefaultTarget(platform.id)} />
                        <Icon style={{ color: platform.color }} /> {platform.label}
                        {!info.connected && <small>not connected</small>}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <div className="settings-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-name">Name</label>
                  <input id="profile-name" className="form-input" value={profile.name} maxLength={40} onChange={event => setProfile(previous => ({ ...previous, name: event.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-email">Email / subtitle</label>
                  <input id="profile-email" className="form-input" value={profile.email} maxLength={60} onChange={event => setProfile(previous => ({ ...previous, email: event.target.value }))} placeholder="you@example.com" />
                </div>
              </div>
              <p className="settings-inline-hint">Yeh sirf is browser mein save hota hai aur sidebar mein dikhta hai.</p>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="settings-body">
              <div className="settings-section">
                <h3 className="section-title-sm">Jab post publish ho jaye</h3>
                <Toggle checked={!!prefs.desktopNotify} onChange={setDesktopNotify} label="Desktop notification" sub="Browser notification dikhayein (tab khula hona chahiye)" />
                <Toggle checked={!!prefs.sound} onChange={value => setPrefs(previous => ({ ...previous, sound: value }))} label="Sound" sub="Chhoti si chime bajayein" />
                <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => {
                  if (prefs.desktopNotify && 'Notification' in window && Notification.permission === 'granted') new Notification('Platform Manager', { body: 'Test notification ✔' })
                  else showToast('Desktop notification off hai.', 'info')
                }}>
                  <FaVolumeUp /> Test notification
                </button>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="settings-body">
              <div className="settings-section">
                <h3 className="section-title-sm">Theme</h3>
                <div className="theme-grid">
                  {Object.entries(themes).map(([id, theme]) => {
                    const isActive = themeId === id
                    return (
                      <button key={id} className={`theme-card ${isActive ? 'active' : ''}`} onClick={() => setThemeId(id)} type="button" aria-pressed={isActive}>
                        <div className="theme-preview" style={{ background: `linear-gradient(135deg, ${theme.a1}, ${theme.a2})` }}>
                          {isActive && <span className="theme-check"><FaCheck /></span>}
                        </div>
                        <span className="theme-name">{theme.name} {isActive && <span style={{ opacity: 0.8 }}>• Active</span>}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="settings-section">
                <h3 className="section-title-sm">Interface</h3>
                <Toggle checked={!!prefs.reducedMotion} onChange={value => setPrefs(previous => ({ ...previous, reducedMotion: value }))} label="Reduced motion" sub="Animations band kar dein" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
