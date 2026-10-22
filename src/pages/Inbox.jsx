import { FaExternalLinkAlt, FaInfoCircle, FaPlug, FaUser, FaCommentDots } from 'react-icons/fa'
import { PLATFORMS, PLATFORM_BY_ID, displayHandle, timeAgo } from '../platforms'
import './pages.css'

function profileUrl(id, username) {
  const handle = (username || '').replace(/^@/, '')
  if (!handle) return null
  return {
    tiktok: `https://www.tiktok.com/@${handle}`,
    instagram: `https://www.instagram.com/${handle}/`,
    youtube: `https://www.youtube.com/@${handle}`,
    x: `https://x.com/${handle}`,
  }[id] || null
}

function Inbox({ platformState, setActive, transfers = [] }) {
  const platforms = platformState.platforms || {}
  const connectedCount = PLATFORMS.filter(platform => platforms[platform.id]?.connected).length
  const published = transfers
    .flatMap(transfer => Object.entries(transfer.platforms || {})
      .filter(([, entry]) => entry.status === 'done' && entry.url)
      .map(([id, entry]) => ({ id, url: entry.url, title: transfer.title || transfer.name, createdAt: transfer.createdAt, key: `${transfer.id}-${id}` })))
    .slice(0, 12)

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Inbox</h1>
          <p className="page-subtitle">
            Har platform ke messages aur comments ek jagah se kholein ·{' '}
            <b style={{ color: connectedCount ? 'var(--accent-1)' : '#f59e0b' }}>{connectedCount} accounts connected</b>
          </p>
        </div>
      </header>

      <div className="disclaimer-block" style={{ marginBottom: 20 }}>
        <div className="disclaimer-icon"><FaInfoCircle /></div>
        <div>
          <div className="disclaimer-title">Messages platform ki apni app mein khulte hain</div>
          <div className="disclaimer-body">
            TikTok, Instagram, Facebook, YouTube, LinkedIn aur X apni public APIs se DMs padhne/bhejne nahi dete (ya iske liye
            alag business approval chahiye). Is liye yahan se har inbox ek click mein khulta hai — aur neeche aapki published posts ke
            comments ke links hain.
          </div>
        </div>
      </div>

      <div className="inbox-hub">
        {PLATFORMS.map((platform, index) => {
          const info = platforms[platform.id] || {}
          const profile = profileUrl(platform.id, info.username)
          const { Icon } = platform
          return (
            <div key={platform.id} className={`hub-card glass-card ${info.connected ? 'on' : ''}`} style={{ '--pcol': platform.color, animation: 'fadeIn 0.45s ease both', animationDelay: `${0.06 * index}s` }}>
              <div className="hub-top">
                <div className="hub-icon" style={{ background: platform.gradient }}><Icon /></div>
                <div className="hub-info">
                  <div className="hub-name">{platform.label}</div>
                  <div className="hub-user">
                    {info.connected ? displayHandle(platform.id, info.username) || 'Connected' : 'Not connected'}
                  </div>
                </div>
              </div>
              <div className="hub-actions">
                <a className="btn btn-secondary" href={platform.inboxUrl} target="_blank" rel="noreferrer">
                  <FaCommentDots /> Open inbox <FaExternalLinkAlt className="hub-ext" />
                </a>
                {profile && (
                  <a className="btn btn-ghost" href={profile} target="_blank" rel="noreferrer" title="Profile kholein" aria-label={`${platform.label} profile`}>
                    <FaUser />
                  </a>
                )}
                {!info.connected && (
                  <button type="button" className="btn btn-ghost" onClick={() => setActive('settings')} title="Settings mein connect karein">
                    <FaPlug /> Connect
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="section-header" style={{ marginTop: 28 }}>
        <h2 className="section-title">Published posts — comments dekhein</h2>
      </div>
      <div className="file-list glass-card">
        {published.length === 0 ? (
          <div className="empty-state empty-large" style={{ padding: 36 }}>
            <p style={{ color: '#64748b', fontSize: 14 }}>Jab videos publish hongi, unke links yahan aayenge.</p>
          </div>
        ) : published.map(item => {
          const meta = PLATFORM_BY_ID[item.id]
          const { Icon } = meta
          return (
            <a key={item.key} className="file-row hub-post" href={item.url} target="_blank" rel="noreferrer">
              <div className="file-icon" style={{ background: meta.gradient, color: '#fff' }}><Icon /></div>
              <div className="file-info">
                <div className="file-name">{item.title}</div>
                <div className="file-meta"><span>{meta.label}</span><span className="dot-sep" /><span>{timeAgo(item.createdAt)}</span></div>
              </div>
              <FaExternalLinkAlt style={{ color: '#64748b' }} />
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default Inbox
