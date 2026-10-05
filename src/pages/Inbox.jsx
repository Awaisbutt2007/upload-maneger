import { useState, useMemo } from 'react'
import {
  FaReply, FaSearch, FaFilter, FaPaperclip, FaCheck, FaCheckDouble,
  FaArrowRight, FaLink, FaUnlink, FaInbox
} from 'react-icons/fa'
import { FaTiktok, FaInstagram, FaLinkedin, FaTwitter, FaWhatsapp } from 'react-icons/fa6'
import './pages.css'

const PLATFORMS = [
  {
    id: 'tiktok',
    label: 'TikTok Inbox',
    Icon: FaTiktok,
    color: '#ff0050',
    accent: '#00f2ea',
    gradient: 'linear-gradient(135deg, #ff0050, #00f2ea)',
  },
  {
    id: 'instagram',
    label: 'Instagram Inbox',
    Icon: FaInstagram,
    color: '#E1306C',
    accent: '#f77737',
    gradient: 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Inbox',
    Icon: FaLinkedin,
    color: '#0A66C2',
    accent: '#0077b5',
    gradient: 'linear-gradient(135deg, #0A66C2, #0077b5)',
  },
  {
    id: 'twitter',
    label: 'Twitter / X Inbox',
    Icon: FaTwitter,
    color: '#1da1f2',
    accent: '#14171A',
    gradient: 'linear-gradient(135deg, #14171A, #1da1f2)',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Inbox',
    Icon: FaWhatsapp,
    color: '#25D366',
    accent: '#128c7e',
    gradient: 'linear-gradient(135deg, #128c7e, #25D366)',
  },
]

function Inbox({ links = {} }) {
  const [platformId, setPlatformId] = useState('tiktok')
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [sentMsgs, setSentMsgs] = useState({})

  const platform = PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0]
  const linked = !!links[platformId]?.connected
  const profileUrl = links[platformId]?.url || ''
  const pname = platform.label.split(' ')[0]

  const platformMsgList = useMemo(() => {
    if (!linked) return []
    const key = 'inbox_' + platformId
    const sent = sentMsgs[key] || []
    if (search.trim()) {
      return sent.filter(m => m.text.toLowerCase().includes(search.toLowerCase()))
    }
    return sent
  }, [linked, platformId, sentMsgs, search])

  const sendReply = () => {
    if (!reply.trim() || !linked) return
    const key = 'inbox_' + platformId
    const msg = {
      id: 'm-' + Date.now(),
      me: true,
      text: reply,
      time: 'Just now',
    }
    setSentMsgs(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), msg],
    }))
    setReply('')
  }

  const openProfile = (e) => {
    if (!profileUrl) return
    const url = profileUrl.startsWith('http') ? profileUrl : 'https://' + profileUrl
    window.open(url, '_blank', 'noopener,noreferrer')
    e.preventDefault()
  }

  const linkedCount = Object.values(links).filter(l => l && l.connected).length

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Inbox</h1>
          <p className="page-subtitle">
            All platform messages, one place ·{' '}
            {linkedCount === 0 ? (
              <b style={{ color: '#f59e0b' }}>0 accounts linked</b>
            ) : (
              <><b style={{ color: 'var(--accent-1)' }}>{linkedCount}</b> accounts connected</>
            )}
          </p>
        </div>
        <div className="inbox-header-stats">
          {PLATFORMS.map(p => {
            const linkedP = !!(links[p.id] && links[p.id].connected)
            const I = p.Icon
            return (
              <div
                key={p.id}
                className={'header-stat ' + (platformId === p.id ? 'on ' : '') + (!linkedP ? 'dim' : '')}
                style={{ '--pcol': p.color }}
              >
                <I />
                {!linkedP && <span className="stat-line" />}
              </div>
            )
          })}
        </div>
      </header>

      <div className="social-tabs glass-card" style={{ animation: 'fadeIn 0.45s ease both', animationDelay: '0.08s', marginBottom: 20 }}>
        {PLATFORMS.map((p, i) => {
          const Icon = p.Icon
          const active = p.id === platformId
          const isLinked = !!(links[p.id] && links[p.id].connected)
          return (
            <button
              key={p.id}
              className={'social-tab ' + (active ? 'active ' : '') + (!isLinked ? 'unlinked' : '')}
              onClick={() => { setPlatformId(p.id); setSearch(''); setReply('') }}
              style={{
                animation: 'fadeIn 0.4s ease both',
                animationDelay: (0.1 + i * 0.04) + 's',
                '--pgrad': p.gradient,
                '--pcol': p.color,
              }}
            >
              <span className="st-icon-wrap">
                <Icon className="st-icon" />
                {!isLinked && <span className="st-off-badge"><FaUnlink /></span>}
              </span>
              <span className="st-label">{p.label}</span>
              {active && <span className="st-indicator" />}
            </button>
          )
        })}
      </div>

      <div className="inbox-layout social">
        {/* Chat list */}
        <div className="inbox-list glass-card" style={{ animation: 'slideInLeft 0.5s ease both', animationDelay: '0.1s' }}>
          <div className="inbox-toolbar">
            <div className="search-input-wrap">
              <FaSearch className="search-icon" />
              <input
                className="search-input"
                placeholder={'Search ' + platform.label + '...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost" title="Filter"><FaFilter /></button>
          </div>

          <div className="inbox-platform-banner" style={{ background: platform.gradient }}>
            <div className="ipb-overlay" />
            <platform.Icon className="ipb-icon" />
            <div className="ipb-info">
              <div className="ipb-title">{platform.label}</div>
              <div className="ipb-sub">
                {linked ? 'Account linked · Waiting for new messages' : 'Account not linked yet'}
              </div>
            </div>
          </div>

          <div className="message-list">
            {!linked ? (
              <div className="empty-state empty-large" style={{ padding: 40 }}>
                <div className="empty-icon-wrap" style={{ background: platform.color + '1a' }}>
                  <FaUnlink className="empty-icon-big" style={{ color: platform.color }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                  Abhi ya account link nahi howa
                </h3>
                <p style={{ color: '#64748b', fontSize: 14, maxWidth: 380, lineHeight: 1.6, padding: '0 12px' }}>
                  <b>{pname}</b> ka inbox yahan dekhne ke liye pehlay apna account link karein:
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="badge badge-red"><FaUnlink /> Not connected</span>
                  <span className="badge badge-slate">No messages</span>
                </div>
                <div className="link-notice" style={{ borderLeft: '3px solid ' + platform.color + 'cc' }}>
                  <span>
                    👉 Pehlay <b style={{ color: platform.color }}>Settings → Links</b> jayein,{' '}
                    <span style={{ color: '#e2e8f0' }}>{pname}</span> ka profile URL dalein aur{' '}
                    <b>Connect</b> dabayein. Phir wapas inbox mein aayein — messages aana shuru ho jayengi!
                  </span>
                </div>
              </div>
            ) : platformMsgList.length === 0 && search.trim() === '' ? (
              <div className="empty-state empty-large" style={{ padding: 40 }}>
                <div className="empty-icon-wrap" style={{ background: platform.color + '1a' }}>
                  <platform.Icon className="empty-icon-big" style={{ color: platform.color }} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                  Abhi koi message nahi aya
                </h3>
                <p style={{ color: '#64748b', fontSize: 14, maxWidth: 380, lineHeight: 1.6, padding: '0 12px' }}>
                  <b>{pname}</b> account successfully link hai. New messages jab aayengi
                  woh automatically yahan list mein nazar aayengi. Neeche composer se aap reply bhi bhej sakte hain.
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="badge badge-green"><FaCheck /> Linked</span>
                  {profileUrl && (
                    <a href=" " onClick={openProfile} className="badge badge-cyan link-hover" style={{ textDecoration: 'none' }}>
                      Open Profile
                    </a>
                  )}
                </div>
              </div>
            ) : (
              platformMsgList.map((m, i) => (
                <div
                  key={m.id}
                  className="message-item active"
                  style={{
                    animation: 'fadeIn 0.4s ease both',
                    animationDelay: (0.1 + i * 0.03) + 's',
                  }}
                >
                  <div
                    className="msg-avatar"
                    style={{
                      background: 'linear-gradient(135deg, #1e293b, #334155)',
                      color: '#cbd5e1',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >You</div>
                  <div className="msg-body">
                    <div className="msg-head">
                      <span className="msg-from">You (Outgoing)</span>
                      <span className="msg-time">now</span>
                    </div>
                    <div className="msg-subject" style={{ fontWeight: 500, fontSize: 12, color: platform.color, marginBottom: 4 }}>
                      via {pname}
                    </div>
                    <div className="msg-preview">{m.text}</div>
                    <div className="msg-foot">
                      <span className="msg-chip unread-count" style={{ background: platform.color }}>
                        <FaCheckDouble /> Sent
                      </span>
                    </div>
                  </div>
                  <FaCheckDouble style={{ color: platform.color, alignSelf: 'center', fontSize: 14 }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat detail */}
        <div className="inbox-detail glass-card chat-detail" style={{ animation: 'slideInRight 0.5s ease both', animationDelay: '0.12s' }}>
          {!linked ? (
            <div className="empty-state empty-large" style={{ padding: 50 }}>
              <div
                className="empty-icon-wrap big"
                style={{
                  background: 'linear-gradient(135deg, ' + platform.color + '22, ' + platform.accent + '18)',
                }}
              >
                <platform.Icon className="empty-icon-big huge" style={{ color: platform.color }} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', marginBottom: 10 }}>
                <span style={{ color: platform.color }}>{pname}</span> account link nahi howa
              </h3>
              <p style={{ color: '#64748b', fontSize: 15, maxWidth: 520, lineHeight: 1.7 }}>
                Jab tak aap <b>{pname}</b> ka apna account connect nahi karte,
                is section mein koi chat nahi dikhega.
              </p>

              <div className="steps-box" style={{ border: '1px solid ' + platform.color + '44' }}>
                <div className="step-item">
                  <span className="step-num" style={{ background: platform.color }}>1</span>
                  <div>
                    <div className="step-title">Settings → Links kholiye</div>
                    <div className="step-sub">{pname} section tak jayein</div>
                  </div>
                </div>
                <div className="step-item">
                  <span className="step-num" style={{ background: platform.color }}>2</span>
                  <div>
                    <div className="step-title">Apni profile URL dalein</div>
                    <div className="step-sub">Placeholder mein apna link paste karein</div>
                  </div>
                </div>
                <div className="step-item">
                  <span className="step-num" style={{ background: platform.color }}>3</span>
                  <div>
                    <div className="step-title">Connect dabayein</div>
                    <div className="step-sub">Bas! Phir wapas inbox mein messages ana shuru ho jayengi</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="badge badge-red"><FaUnlink /> Status: Not Connected</span>
                <span className="badge badge-amber">Pending Setup Required</span>
              </div>
            </div>
          ) : (
            <>
              <div className="detail-head chat-head">
                <div
                  className="detail-avatar"
                  style={{
                    background: 'linear-gradient(135deg, ' + platform.color + ', ' + platform.accent + ')',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 800,
                  }}
                ><platform.Icon /></div>
                <div className="detail-info">
                  <div className="detail-from-row">
                    <h3 className="detail-from">{platform.label}</h3>
                  </div>
                  <div className="detail-email">
                    {profileUrl ? (
                      <a href=" " onClick={openProfile} className="link-hover" style={{ fontSize: 13 }}>
                        {profileUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                      </a>
                    ) : 'Your linked account'}
                  </div>
                  <div className="detail-to-row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FaCheck style={{ color: '#22c55e' }} /> Listening for new {pname} messages
                    </span>
                    <span className="detail-time">
                      <FaCheck style={{ color: '#22c55e' }} /> Live
                    </span>
                  </div>
                </div>
                <div className="chat-head-actions">
                  {profileUrl && (
                    <a href=" " onClick={openProfile} className="btn btn-secondary" style={{ padding: '8px 14px', textDecoration: 'none' }}>
                      <FaLink /> Open
                    </a>
                  )}
                </div>
              </div>

              <div className="chat-window">
                {platformMsgList.length === 0 ? (
                  <div className="empty-state" style={{ padding: '60px 20px' }}>
                    <div className="empty-icon-wrap">
                      <FaInbox className="empty-icon-big" style={{ color: platform.color }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                      Inbox empty — koi message nahi
                    </h3>
                    <p style={{ color: '#64748b', fontSize: 14, maxWidth: 420, lineHeight: 1.6 }}>
                      Abhi tak is <b>{pname}</b> par aapke paas koi incoming message nahi aaya.
                      Neeche composer se aap pehla message bhej sakte hain — ya intezaar karein naye messages ka.
                    </p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span className="badge badge-green"><FaCheck /> Connected</span>
                      <span className="badge badge-cyan">Live sync on {pname}</span>
                    </div>
                  </div>
                ) : (
                  platformMsgList.map((m, i) => (
                    <div
                      key={m.id}
                      className={'bubble-wrap ' + (m.me ? 'me' : 'them')}
                      style={{ animation: 'bubbleIn 0.4s ease both', animationDelay: (i * 0.03) + 's' }}
                    >
                      {!m.me && (
                        <div
                          className="bubble-avatar"
                          style={{ background: 'linear-gradient(135deg, ' + platform.color + ', ' + platform.accent + ')', color: '#fff' }}
                        >
                          <platform.Icon style={{ fontSize: 12 }} />
                        </div>
                      )}
                      <div
                        className={'bubble ' + (m.me ? 'mine' : 'theirs')}
                        style={m.me ? { background: 'linear-gradient(135deg, ' + platform.color + 'cc, ' + platform.accent + ')' } : {}}
                      >
                        <div className="bubble-text">{m.text}</div>
                        <div className="bubble-time">
                          {m.time} {m.me && <FaCheckDouble style={{ color: '#93c5fd' }} />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="chat-composer">
                <button className="composer-attach"><FaPaperclip /></button>
                <input
                  className="composer-input"
                  placeholder={linked ? 'Message on ' + pname + '...' : 'Connect account first to send messages'}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendReply() }}
                  disabled={!linked}
                />
                <button
                  className={'btn btn-primary composer-send ' + (reply.trim() && linked ? 'ready' : '')}
                  onClick={sendReply}
                  disabled={!reply.trim() || !linked}
                  style={linked ? { background: platform.gradient, border: 'none' } : {}}
                >
                  <FaReply style={{ transform: 'scaleX(-1)' }} />
                  <span className="send-label">Send</span>
                  <FaArrowRight className="send-arrow" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Inbox
