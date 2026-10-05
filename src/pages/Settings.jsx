import { useState } from 'react'
import {
  FaUser, FaBell, FaShieldAlt, FaPalette, FaCloud, FaKey,
  FaToggleOn, FaToggleOff, FaSave, FaLanguage, FaExclamationTriangle,
  FaLink, FaCheck, FaExternalLinkAlt, FaPlug, FaClock, FaSpinner,
  FaInfoCircle, FaUnlock, FaSync, FaEye, FaEyeSlash, FaExclamationCircle
} from 'react-icons/fa'
import { FaTiktok, FaInstagram, FaLinkedin, FaTwitter, FaWhatsapp } from 'react-icons/fa6'
import './pages.css'

const tabs = [
  { id: 'profile', label: 'Profile', icon: FaUser },
  { id: 'notifications', label: 'Notifications', icon: FaBell },
  { id: 'appearance', label: 'Appearance', icon: FaPalette },
  { id: 'links', label: 'Links', icon: FaLink },
  { id: 'security', label: 'Security', icon: FaShieldAlt },
  { id: 'storage', label: 'Storage', icon: FaCloud },
]

const PLATFORMS = [
  {
    id: 'tiktok', label: 'TikTok', Icon: FaTiktok,
    color: '#000000', accent: '#ff0050', placeholder: 'https://tiktok.com/@yourname',
    hint: 'Kisi bhi video ko auto-publish karne ke liye connect karein',
    oauthHint: 'TikTok OAuth 2.0 — Content Post API',
    requiresClientKey: true,
    scopes: 'video.publish,user.info.basic,video.upload',
    uploadEndpoint: '/v2/post/publish/video/init/',
    docsLink: 'https://developers.tiktok.com/doc/content-posting-api-overview',
  },
  {
    id: 'instagram', label: 'Instagram', Icon: FaInstagram,
    color: '#E1306C', accent: '#f77737', placeholder: 'https://instagram.com/yourname',
    hint: 'Photos, reels aur stories sab yahan se upload honge',
    oauthHint: 'Facebook Graph API — IG Media Publishing',
    requiresClientKey: true,
    scopes: 'publish_video,publish_to_story',
    uploadEndpoint: '/v20.0/{ig_user_id}/media',
    docsLink: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing',
  },
  {
    id: 'linkedin', label: 'LinkedIn', Icon: FaLinkedin,
    color: '#0A66C2', accent: '#0077b5', placeholder: 'https://linkedin.com/in/yourname',
    hint: 'Professional posts aur documents publish karein',
    oauthHint: 'LinkedIn Marketing API — UGC Posts',
    requiresClientKey: true,
    scopes: 'w_member_social,r_liteprofile',
    uploadEndpoint: '/v2/ugcPosts',
    docsLink: 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin',
  },
  {
    id: 'twitter', label: 'Twitter / X', Icon: FaTwitter,
    color: '#000000', accent: '#1da1f2', placeholder: 'https://twitter.com/yourname',
    hint: 'Tweets, threads aur media ek click mein share karein',
    oauthHint: 'X API v2 — OAuth 1.0a + v2 manage_tweets',
    requiresClientKey: true,
    scopes: 'tweet.read,tweet.write,users.read',
    uploadEndpoint: '/2/tweets',
    docsLink: 'https://developer.x.com/en/docs/twitter-api/tweets/manage-tweets/introduction',
  },
  {
    id: 'whatsapp', label: 'WhatsApp Channel', Icon: FaWhatsapp,
    color: '#25D366', accent: '#128c7e', placeholder: 'https://whatsapp.com/channel/xxx',
    hint: 'Channel subscribers ko automatic updates bhejein',
    oauthHint: 'WhatsApp Business Cloud API — Channel Messages',
    requiresClientKey: true,
    scopes: 'business_management,whatsapp_business_messaging',
    uploadEndpoint: '/v18.0/{phone_number_id}/messages',
    docsLink: 'https://business.whatsapp.com/products/business-platform/',
  },
]

function Settings({ themeId, setThemeId, themes, links, setLinks }) {
  const [tab, setTab] = useState('profile')
  const [toast, setToast] = useState(null)
  const [toggles, setToggles] = useState({
    emailNotif: true, pushNotif: true, marketing: false, weeklyDigest: true,
    twoFactor: false, autoUpdate: true, telemetry: false, beta: false,
    sound: true, desktop: false,
  })
  const [linksDraft, setLinksDraft] = useState(links)
  const [tokenVisible, setTokenVisible] = useState({})
  const [connecting, setConnecting] = useState({})
  const [expanded, setExpanded] = useState({})

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3400)
  }

  const saveAll = () => {
    setLinks(linksDraft)
    showToast('Settings saved successfully!', 'ok')
  }

  const updateLinkField = (id, field, value) =>
    setLinksDraft(p => ({ ...p, [id]: { ...p[id], [field]: value } }))

  const extractHandle = (pid, url) => {
    try {
      const u = (url || '').replace(/\/$/, '')
      if (!u) return ''
      if (pid === 'tiktok') {
        const m = u.match(/@([A-Za-z0-9_.]+)/)
        return m ? m[1] : ''
      }
      if (pid === 'instagram') {
        const m = u.match(/instagram\.com\/([A-Za-z0-9_.]+)/)
        return m ? m[1] : ''
      }
      if (pid === 'twitter') {
        const m = u.match(/twitter\.com\/([A-Za-z0-9_]+)/)
        return m ? m[1] : ''
      }
      if (pid === 'linkedin') {
        const m = u.match(/linkedin\.com\/in\/([A-Za-z0-9_-]+)/)
        return m ? m[1] : ''
      }
      if (pid === 'whatsapp') {
        const m = u.match(/channel\/([A-Za-z0-9_-]+)/)
        return m ? m[1] : ''
      }
    } catch {}
    return ''
  }

  const toggleTokenVisibility = (id) => {
    setTokenVisible(p => ({ ...p, [id]: !p[id] }))
  }

  const startOAuthFlow = async (id, meta) => {
    if (connecting[id]) return
    setConnecting(p => ({ ...p, [id]: true }))
    setExpanded(p => ({ ...p, [id]: true }))
    let current = linksDraft[id] || {}

    try {
      showToast(`Connecting to ${meta.label}... (${meta.oauthHint || 'OAuth flow'})`, 'info')

      await new Promise(r => setTimeout(r, 900))

      if (!current.url || current.url.trim().length < 4) {
        setConnecting(p => ({ ...p, [id]: false }))
        showToast(`Pehle ${meta.label} profile URL enter karein`, 'error')
        return
      }

      await new Promise(r => setTimeout(r, 700))

      const needsClientKey = meta.requiresClientKey
      if (needsClientKey && (!current.clientKey || current.clientKey.trim().length < 6)) {
        setConnecting(p => ({ ...p, [id]: false }))
        showToast(`Client Key enter karein (${meta.label} Developers dashboard se milta hai)`, 'error')
        return
      }

      if (!current.accessToken || current.accessToken.trim().length < 8) {
        await new Promise(r => setTimeout(r, 1100))
        const fakeToken = meta.id + '_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36) + '_acc_' + btoa(Math.random().toString(36)).slice(0, 14)
        const fakeRefresh = meta.id + '_ref_' + Math.random().toString(36).slice(2) + btoa(Date.now().toString(36)).slice(0, 20)
        const handle = extractHandle(meta.id, current.url) || `user_${Math.random().toString(36).slice(2, 7)}`
        current = {
          ...current,
          accessToken: current.accessToken || fakeToken,
          refreshToken: fakeRefresh,
          userHandle: handle,
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 59,
        }
        setLinksDraft(p => ({ ...p, [id]: current }))
        showToast(`${meta.label} account verified — @${handle}`, 'ok')
      }

      await new Promise(r => setTimeout(r, 600))
      current = {
        ...current,
        connected: true,
        authStatus: 'connected',
      }
      setLinksDraft(p => ({ ...p, [id]: current }))
      showToast(`${meta.label} successfully linked! Auto-publish enabled.`, 'ok')
    } catch (e) {
      showToast(`${meta.label} connection failed: ${e.message || 'Unknown error'}`, 'error')
    } finally {
      setConnecting(p => ({ ...p, [id]: false }))
    }
  }

  const disconnectPlatform = (id, meta) => {
    setLinksDraft(p => ({
      ...p,
      [id]: {
        ...p[id],
        connected: false,
        authStatus: 'disconnected',
        expiresAt: null,
      },
    }))
    showToast(`${meta.label} disconnected`, 'info')
  }

  const Toggle = ({ id, label, sub }) => (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <button
        className={`toggle-switch ${toggles[id] ? 'on' : ''}`}
        onClick={() => setToggles(p => ({ ...p, [id]: !p[id] }))}
      >
        {toggles[id] ? <FaToggleOn /> : <FaToggleOff />}
      </button>
    </div>
  )

  const activeTab = tabs.find(t => t.id === tab)
  const ActiveIcon = activeTab?.icon || FaUser

  const themeList = [
    { id: 'aqua', name: 'Aqua', a: '#06b6d4', b: '#14b8a6' },
    { id: 'emerald', name: 'Emerald', a: '#10b981', b: '#059669' },
    { id: 'sunset', name: 'Sunset', a: '#f59e0b', b: '#ef4444' },
    { id: 'sky', name: 'Sky', a: '#0ea5e9', b: '#6366f1' },
    { id: 'rose', name: 'Rose', a: '#f43f5e', b: '#ec4899' },
    { id: 'mono', name: 'Mono', a: '#64748b', b: '#1e293b' },
  ]

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
        <button className="btn btn-primary" onClick={saveAll}>
          <FaSave /> Save Changes
        </button>
      </header>

      {toast && (
        <div className={`toast ${toast.type}`} style={{ animation: 'toastIn 0.4s ease both' }}>
          <FaCheck /> {toast.msg}
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-tabs glass-card" style={{ animation: 'slideInLeft 0.5s ease both', animationDelay: '0.1s' }}>
          {tabs.map((t, i) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                className={`settings-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                style={{ animation: `fadeIn 0.4s ease both`, animationDelay: `${0.12 + i * 0.04}s` }}
              >
                <Icon className="tab-icon" />
                <span>{t.label}</span>
              </button>
            )
          })}

          <div className="danger-zone" style={{ animation: 'fadeIn 0.5s ease both', animationDelay: '0.4s' }}>
            <div className="danger-icon"><FaExclamationTriangle /></div>
            <div className="danger-text">
              <div className="danger-title">Danger Zone</div>
              <div className="danger-sub">Irreversible account actions</div>
            </div>
            <button className="btn btn-ghost danger-btn">Delete</button>
          </div>
        </div>

        <div className="settings-content glass-card" style={{ animation: 'slideInRight 0.5s ease both', animationDelay: '0.12s' }} key={tab}>
          <div className="settings-head">
            <div className="settings-head-icon"><ActiveIcon /></div>
            <div>
              <h2 className="settings-title">{activeTab?.label} Settings</h2>
              <p className="settings-subtitle">Configure your {activeTab?.label.toLowerCase()} preferences</p>
            </div>
          </div>

          {tab === 'profile' && (
            <div className="settings-body">
              <div className="profile-hero">
                <div className="profile-avatar-large">
                  <span>PM</span>
                  <button className="avatar-edit">Edit</button>
                </div>
                <div className="profile-hero-info">
                  <input className="form-input big" defaultValue="Platform Admin" />
                  <input className="form-input" defaultValue="admin@platform.manager" type="email" />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" defaultValue="Platform Admin" />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-input" defaultValue="@admin" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" defaultValue="admin@platform.manager" />
                </div>
                <div className="form-group">
                  <label className="form-label"><FaLanguage /> Language</label>
                  <select className="form-input">
                    <option>English (US)</option>
                    <option>Roman Urdu</option>
                    <option>Spanish</option>
                    <option>Arabic</option>
                  </select>
                </div>
                <div className="form-group full">
                  <label className="form-label">Bio</label>
                  <textarea className="form-input textarea" defaultValue="Managing platform operations & content uploads." rows={3} />
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="settings-body">
              <div className="settings-section">
                <h3 className="section-title-sm">Email Notifications</h3>
                <Toggle id="emailNotif" label="Email notifications" sub="Receive updates via email" />
                <Toggle id="marketing" label="Marketing emails" sub="Occasional product news and tips" />
                <Toggle id="weeklyDigest" label="Weekly digest" sub="Summary of activity each week" />
              </div>
              <div className="settings-section">
                <h3 className="section-title-sm">Push & In-App</h3>
                <Toggle id="pushNotif" label="Push notifications" sub="Browser & desktop alerts" />
                <Toggle id="sound" label="Sound effects" sub="Play sound on new events" />
                <Toggle id="desktop" label="Desktop notifications" sub="Enable native desktop alerts" />
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="settings-body">
              <div className="settings-section">
                <h3 className="section-title-sm">Theme — Click to apply instantly</h3>
                <div className="theme-grid">
                  {themeList.map(t => {
                    const isActive = themeId === t.id
                    return (
                      <button
                        key={t.id}
                        className={`theme-card ${isActive ? 'active' : ''}`}
                        onClick={() => setThemeId(t.id)}
                        type="button"
                      >
                        <div className="theme-preview" style={{ background: `linear-gradient(135deg, ${t.a}, ${t.b})` }}>
                          {isActive && <span className="theme-check"><FaCheck /></span>}
                        </div>
                        <span className="theme-name">
                          {t.name} {isActive && <span style={{ opacity: 0.8 }}>• Active</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="theme-hint">
                  💡 Sab themes real-time apply hoti hain — <b>Save Changes</b> dabane ki zaroorat nahi.
                </div>
              </div>

              <div className="settings-section">
                <h3 className="section-title-sm">Interface</h3>
                <Toggle id="autoUpdate" label="Smooth animations" sub="Enabled rich transition effects" />
                <Toggle id="beta" label="Compact mode" sub="Reduce spacing in lists" />
                <Toggle id="telemetry" label="Reduced motion" sub="Minimize animations globally" />
              </div>
            </div>
          )}

          {tab === 'links' && (
            <div className="settings-body">
              <div className="disclaimer-block" style={{ animation: 'fadeIn 0.35s ease both' }}>
                <div className="disclaimer-icon"><FaInfoCircle /></div>
                <div>
                  <div className="disclaimer-title">Frontend-Only Prototype (Important)</div>
                  <div className="disclaimer-body">
                    Yeh app abhi frontend-only prototype hai. <b>Actual social API (TikTok/Instagram wagera) ke liye
                    aapko ek backend server chahiye hoga</b> — kyun ke browsers ke security rules (CORS) aur
                    OAuth redirect flows ke liye server zaroori hota hai. Yahan ke <code>Access Tokens</code> aur
                    <code> Client Keys</code> sirf skeleton/demo hain. Jab aapka backend ready hoga toh in fields mein
                    asli keys daalein. Jab tak demo mode mein "Connect" karein — app internal simulate karke upload progress
                    ko real-time dikhayega, aur done hone par us platform ke post URL pattern ka link banayega taake aap
                    verify kar saken.
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3 className="section-title-sm">
                  Connected Platforms <span className="badge badge-cyan" style={{ marginLeft: 8 }}>
                    {Object.values(linksDraft).filter(l => l.connected).length} / {PLATFORMS.length} linked
                  </span>
                </h3>
                <p className="settings-inline-hint">
                  Neeche har platform ka Client Key + Access Token daalein (Developer Dashboard se), profile URL enter karein,
                  phir <b>Connect</b> dabayein. Jab sab links <span className="badge badge-green" style={{ padding: '2px 6px', fontSize: 10 }}>Connected</span> ho jayen,
                  Upload par jaake file upload karein — wo automatic in par publish ho jayega, aur "Done" hone par seedha
                  us post ka link Recent Transfers mein nazar aayega.
                </p>

                <div className="platform-list platform-list-advanced">
                  {PLATFORMS.map((p, i) => {
                    const draft = linksDraft[p.id] || { url: '', connected: false, authStatus: 'disconnected', accessToken: '', clientKey: '', userHandle: '' }
                    const { Icon } = p
                    const isConnecting = !!connecting[p.id]
                    const isExpanded = !!expanded[p.id] || !draft.connected
                    const showToken = !!tokenVisible[p.id]
                    const expDays = draft.expiresAt ? Math.max(0, Math.ceil((draft.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))) : 0

                    return (
                      <div
                        key={p.id}
                        className={`platform-card advanced ${draft.connected ? 'connected' : ''} ${isExpanded ? 'expanded' : ''}`}
                        style={{ animation: `fadeIn 0.45s ease both`, animationDelay: `${0.1 + i * 0.06}s` }}
                      >
                        <div className="platform-card-top">
                          <div
                            className="platform-icon"
                            style={{
                              background: `linear-gradient(135deg, ${p.color}, ${p.accent})`,
                              boxShadow: `0 8px 24px ${p.accent}55`,
                            }}
                          >
                            <Icon />
                          </div>

                          <div className="platform-info">
                            <div className="platform-head">
                              <h4 className="platform-name">{p.label}</h4>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {isConnecting && <span className="badge badge-amber"><FaSpinner className="spin" /> Connecting…</span>}
                                {!isConnecting && draft.connected
                                  ? <span className="badge badge-green"><FaCheck /> Connected {draft.userHandle ? `· @${draft.userHandle}` : ''}</span>
                                  : <span className="badge badge-slate">{draft.authStatus === 'disconnected' ? 'Needs setup' : 'Pending verification'}</span>}
                              </div>
                            </div>
                            <div className="platform-hint">{p.hint}</div>
                            <div className="platform-oauth-hint">
                              <FaUnlock /> <span style={{ color: '#94a3b8' }}>{p.oauthHint}</span>
                              {' · '}
                              <a href={p.docsLink} target="_blank" rel="noreferrer" className="link-hover" style={{ fontSize: 12 }}>
                                API Docs <FaExternalLinkAlt style={{ display: 'inline' }} />
                              </a>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !isExpanded }))}
                              title="Toggle details"
                            >
                              {isExpanded ? 'Collapse' : 'Details'}
                            </button>
                            {draft.connected ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={isConnecting}
                                onClick={() => disconnectPlatform(p.id, p)}
                              >
                                {isConnecting ? <FaSpinner className="spin" /> : <FaPlug />}
                                Disconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isConnecting}
                                onClick={() => startOAuthFlow(p.id, p)}
                              >
                                {isConnecting ? <FaSpinner className="spin" /> : <FaUnlock />}
                                Connect
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="platform-card-expand" style={{ animation: 'fadeIn 0.3s ease both' }}>
                            <div className="adv-grid">
                              <div className="adv-field">
                                <div className="adv-label">
                                  <FaLink /> Profile / Channel URL <span className="req">*</span>
                                </div>
                                <div className="adv-input-wrap">
                                  <input
                                    className="form-input"
                                    placeholder={p.placeholder}
                                    value={draft.url}
                                    onChange={(e) => updateLinkField(p.id, 'url', e.target.value)}
                                    onBlur={(e) => {
                                      const v = e.target.value
                                      if (!draft.userHandle && v) {
                                        const h = extractHandle(p.id, v)
                                        if (h) updateLinkField(p.id, 'userHandle', h)
                                      }
                                    }}
                                  />
                                  {draft.url && (
                                    <a
                                      href={draft.url.startsWith('http') ? draft.url : `https://${draft.url}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="adv-suffix-btn"
                                    >
                                      <FaExternalLinkAlt />
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="adv-field">
                                <div className="adv-label">
                                  <FaUser /> Username / Handle
                                </div>
                                <div className="adv-input-wrap">
                                  <input
                                    className="form-input"
                                    placeholder="@yourhandle"
                                    value={draft.userHandle}
                                    onChange={(e) => updateLinkField(p.id, 'userHandle', e.target.value.replace(/^@/, ''))}
                                  />
                                </div>
                              </div>

                              <div className="adv-field">
                                <div className="adv-label">
                                  <FaKey /> Client Key / App ID <span className="req">*</span>
                                  <span className="adv-sub">
                                    {p.label} Developer Dashboard se milta hai
                                  </span>
                                </div>
                                <input
                                  className="form-input"
                                  placeholder="Client Key (e.g. awbo0d…)"
                                  value={draft.clientKey}
                                  onChange={(e) => updateLinkField(p.id, 'clientKey', e.target.value)}
                                />
                              </div>

                              <div className="adv-field">
                                <div className="adv-label">
                                  <FaKey /> Access Token <span className="req">*</span>
                                  <span className="adv-sub">
                                    {draft.connected && draft.expiresAt
                                      ? `Expires in ${expDays} days · `
                                      : ''}
                                    Required scopes: <code>{p.scopes}</code>
                                  </span>
                                </div>
                                <div className="adv-input-wrap">
                                  <input
                                    className="form-input"
                                    type={showToken ? 'text' : 'password'}
                                    placeholder="OAuth access_token..."
                                    value={draft.accessToken}
                                    onChange={(e) => updateLinkField(p.id, 'accessToken', e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="adv-suffix-btn"
                                    onClick={() => toggleTokenVisibility(p.id)}
                                    title={showToken ? 'Hide token' : 'Show token'}
                                  >
                                    {showToken ? <FaEyeSlash /> : <FaEye />}
                                  </button>
                                </div>
                              </div>

                              <div className="adv-field full">
                                <div className="adv-label">
                                  <FaSync /> Upload Endpoint
                                </div>
                                <input
                                  className="form-input mono"
                                  value={p.uploadEndpoint}
                                  readOnly
                                  style={{ color: '#94a3b8' }}
                                />
                                <div className="endpoint-note">
                                  <FaInfoCircle /> Actual API call yahan se <code>POST {p.uploadEndpoint}</code> jayega (jab backend ready ho).
                                  Prototype mode mein browser is CORS ki wajah se direct nahi bhej sakta.
                                </div>
                              </div>
                            </div>

                            {draft.connected && (
                              <div className="adv-summary">
                                <div className="summary-pill green">
                                  <FaCheck /> Auth OK
                                </div>
                                <div className="summary-pill cyan">
                                  <FaKey /> Token: {draft.accessToken ? (draft.accessToken.slice(0, 8) + '•••' + draft.accessToken.slice(-4)) : 'N/A'}
                                </div>
                                <div className="summary-pill slate">
                                  <FaClock /> Expires: {draft.expiresAt ? `${expDays}d` : 'N/A'}
                                </div>
                                <div className="summary-pill amber">
                                  <FaExclamationTriangle /> Scopes: <code style={{ color: 'inherit' }}>{p.scopes}</code>
                                </div>
                              </div>
                            )}

                            {!draft.connected && (
                              <div className="adv-summary warn">
                                <FaExclamationCircle /> Setup zaroorat: Profile URL + Client Key + Access Token —
                                sab 3 fields enter karein phir <b>Connect</b> dabayein.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="settings-section">
                <h3 className="section-title-sm">Auto-Publish Behavior</h3>
                <Toggle id="autoUpdate" label="Auto-publish on upload" sub="Jaise hi file upload ho sab linked platforms par bhej de" />
                <Toggle id="marketing" label="Ask confirmation each time" sub="Har upload se pehle confirm prompt dikhayein" />
                <Toggle id="beta" label="Add hashtags & caption template" sub="Har post ke saath default caption & tags include karein" />
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="settings-body">
              <div className="settings-section">
                <h3 className="section-title-sm">Password</h3>
                <div className="form-grid">
                  <div className="form-group full">
                    <label className="form-label">Current password</label>
                    <input className="form-input" type="password" placeholder="••••••••" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New password</label>
                    <input className="form-input" type="password" placeholder="••••••••" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm new</label>
                    <input className="form-input" type="password" placeholder="••••••••" />
                  </div>
                </div>
              </div>
              <div className="settings-section">
                <h3 className="section-title-sm">Authentication</h3>
                <Toggle id="twoFactor" label="Two-factor authentication" sub="Add an extra layer of login security" />
                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label"><FaKey /> API Keys</div>
                    <div className="toggle-sub">Manage access tokens for integrations</div>
                  </div>
                  <button className="btn btn-secondary">Manage</button>
                </div>
                <div className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">Active sessions</div>
                    <div className="toggle-sub">2 devices · Last seen just now</div>
                  </div>
                  <button className="btn btn-ghost" style={{ color: '#f87171' }}>Sign out all</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'storage' && (
            <div className="settings-body">
              <div className="storage-overview">
                <div className="storage-ring">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" stroke="rgba(148,163,184,0.15)" strokeWidth="10" fill="none" />
                    <circle
                      cx="60" cy="60" r="52"
                      stroke="url(#grad-storage)" strokeWidth="10" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(68 / 100) * 326} 326`}
                      transform="rotate(-90 60 60)"
                      style={{ animation: 'strokeGrow 1.4s cubic-bezier(0.4,0,0.2,1) both' }}
                    />
                    <defs>
                      <linearGradient id="grad-storage" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--accent-1)" />
                        <stop offset="100%" stopColor="var(--accent-2)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="storage-ring-text">
                    <div className="storage-pct">68%</div>
                    <div className="storage-label">used</div>
                  </div>
                </div>
                <div className="storage-info">
                  <div className="storage-row">
                    <span>Images</span><b>34.2 GB</b>
                  </div>
                  <div className="storage-row">
                    <span>Videos</span><b>22.8 GB</b>
                  </div>
                  <div className="storage-row">
                    <span>Documents</span><b>8.6 GB</b>
                  </div>
                  <div className="storage-row total">
                    <span>Total</span><b>65.6 / 100 GB</b>
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}>Upgrade Plan</button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-foot">
            <button className="btn btn-secondary" onClick={() => {
              setLinksDraft(links)
              showToast('Changes discarded', 'info')
            }}>Discard</button>
            <button className="btn btn-primary" onClick={saveAll}>
              <FaSave /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
