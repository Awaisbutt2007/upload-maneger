import { useRef, useState } from 'react'
import {
  FaUpload, FaCloudUploadAlt, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaTrash, FaSync,
  FaFileVideo, FaInbox, FaLink, FaMapMarkerAlt, FaExternalLinkAlt, FaPlug,
} from 'react-icons/fa'
import Composer from './Composer'
import { PLATFORMS, PLATFORM_BY_ID, displayHandle, formatSize, platformMessage, timeAgo } from '../platforms'
import './pages.css'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const STAGE_LABEL = { queued: 'Queued', uploading: 'Uploading', processing: 'Processing', done: 'Published', failed: 'Failed' }

function PlatformResult({ id, entry }) {
  const meta = PLATFORM_BY_ID[id]
  if (!meta) return null
  const { Icon } = meta
  const tone = entry.status === 'done' ? 'green' : entry.status === 'failed' ? 'red' : 'amber'
  const content = (
    <>
      <Icon style={{ color: meta.color }} />
      <span>{STAGE_LABEL[entry.status] || entry.status}</span>
      {entry.status === 'done' && entry.url && <FaExternalLinkAlt className="result-link-icon" />}
      {['queued', 'uploading', 'processing'].includes(entry.status) && <FaSpinner className="spin" />}
    </>
  )
  const title = entry.error || entry.warning || `${meta.label}: ${STAGE_LABEL[entry.status] || entry.status}`
  return entry.status === 'done' && entry.url
    ? <a className={`result-pill ${tone}`} href={entry.url} target="_blank" rel="noreferrer" title={`${meta.label} par post kholein`}>{content}</a>
    : <span className={`result-pill ${tone}`} title={title}>{content}</span>
}

function Upload({ platformState, refreshPlatforms, setActive, transfers, setTransfers, postDefaults, setPostDefaults }) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [pickError, setPickError] = useState('')
  const inputRef = useRef(null)
  const platforms = platformState.platforms || {}
  const connected = PLATFORMS.filter(platform => platforms[platform.id]?.connected)
  const defaultTargets = postDefaults.targets?.length ? postDefaults.targets : connected.map(platform => platform.id)

  const choose = fileList => {
    const picked = fileList?.[0]
    if (!picked) return
    if (!VIDEO_TYPES.includes(picked.type)) {
      setPickError(`"${picked.name}" video nahi hai. MP4, MOV ya WebM select karein.`)
      return
    }
    setPickError('')
    setFile(picked)
  }

  const running = transfers.filter(transfer => transfer.status === 'running').length

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Upload</h1>
          <p className="page-subtitle">
            Ek video upload karein — sab connected platforms par same caption, tags aur location ke sath publish hogi
            {' · '}<b style={{ color: connected.length ? 'var(--accent-1)' : '#f59e0b' }}>{connected.length} / {PLATFORMS.length}</b> connected
            {running > 0 && <> · <b style={{ color: 'var(--accent-2)' }}>{running}</b> publishing</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={refreshPlatforms} title="Connection status dobara check karein">
            <FaSync className={platformState.loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
            <FaCloudUploadAlt /> Upload Video
          </button>
        </div>
      </header>

      <div className="publish-panel glass-card" style={{ animation: 'fadeIn 0.55s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.08s', marginBottom: 24 }}>
        <div className="publish-head">
          <div>
            <h3 className="publish-title">Connected platforms</h3>
            <p className="publish-sub">
              Jo platforms yahan connected hain, unhe upload form mein select kar ke ek click mein sab par post karein.
              Naya account jodne ke liye card par click karein.
            </p>
          </div>
          {platformState.error
            ? <span className="badge badge-red"><FaExclamationTriangle /> Backend offline</span>
            : connected.length === 0 && !platformState.loading && <span className="badge badge-amber"><FaExclamationTriangle /> No platforms linked</span>}
        </div>

        <div className="publish-platforms">
          {PLATFORMS.map((platform, index) => {
            const info = platforms[platform.id] || {}
            const { Icon } = platform
            return (
              <button
                key={platform.id}
                type="button"
                className={`publish-card ${info.connected ? 'on' : ''}`}
                onClick={() => setActive('settings')}
                title={info.error?.message || (info.connected ? `${platform.label} connected` : `${platform.label} connect karein`)}
                style={{ animation: 'fadeIn 0.4s ease both', animationDelay: (0.12 + index * 0.04) + 's' }}
              >
                <div className="pub-card-top">
                  <div className="pub-icon" style={{ background: platform.gradient }}><Icon /></div>
                  <span className={`pub-toggle ${info.connected ? 'on' : ''}`}>
                    {info.connected ? <FaCheckCircle /> : <FaPlug style={{ opacity: 0.5 }} />}
                  </span>
                </div>
                <div className="pub-name">{platform.label}</div>
                <div className="pub-state">
                  {platformState.loading
                    ? <span className="badge badge-slate"><FaSpinner className="spin" /> Checking</span>
                    : info.connected
                      ? <span className="badge badge-green pub-user">{displayHandle(platform.id, info.username) || 'Connected'}</span>
                      : info.error
                        ? <span className="badge badge-amber">Action needed</span>
                        : <span className="badge badge-red"><FaLink /> Connect</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: 'none' }} onChange={event => { choose(event.target.files); event.target.value = '' }} />

      <div
        className={'upload-zone glass-card minimal ' + (dragOver ? 'dragover' : '')}
        role="button"
        tabIndex={0}
        aria-label="Video upload karein"
        onDragOver={event => { event.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={event => { event.preventDefault(); setDragOver(false); choose(event.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click() } }}
        style={{ animation: 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) both', animationDelay: '0.15s' }}
      >
        <div className="upload-zone-inner minimal-inner">
          <div className="upload-icon-wrap big-zone-icon">
            <div className="upload-icon-ring" />
            <FaUpload className="upload-icon huge" />
          </div>
          <h2 className="upload-zone-big-text">Upload</h2>
          <p className="upload-zone-hint">Video yahan drag & drop karein ya click karein · MP4, MOV, WebM</p>
        </div>
      </div>
      {pickError && <div className="file-warnings" style={{ marginTop: 12 }}><FaExclamationTriangle /> {pickError}</div>}

      <div style={{ marginTop: 28 }}>
        <div className="section-header">
          <h2 className="section-title">Recent Posts</h2>
          {transfers.length > 0 && (
            <button
              type="button"
              className="link-btn"
              onClick={() => { if (window.confirm('Saari history clear kar dein? (Platforms par posts delete nahi hongi)')) setTransfers(previous => previous.filter(transfer => transfer.status === 'running')) }}
            >Clear history</button>
          )}
        </div>

        <div className="file-list glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.2s' }}>
          {transfers.length === 0 ? (
            <div className="empty-state empty-large">
              <div className="empty-icon-wrap"><FaInbox className="empty-icon-big" /></div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Abhi tak koi post nahi hui</h3>
              <p style={{ color: '#64748b', fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>
                Upar <b style={{ color: 'var(--accent-1)' }}>Upload</b> dabayein. Har post yahan dikhegi — har platform ka status aur asli post ka link ke sath.
              </p>
            </div>
          ) : transfers.map((transfer, index) => {
            const entries = Object.entries(transfer.platforms || {})
            const doneCount = entries.filter(([, entry]) => entry.status === 'done').length
            const problems = entries.filter(([, entry]) => entry.error || entry.warning)
            return (
              <div key={transfer.id} className="file-row post-row" style={{ animation: 'fadeIn 0.5s ease both', animationDelay: (0.25 + Math.min(index, 8) * 0.05) + 's' }}>
                <div className="file-icon" style={{ color: '#fbbf24', background: '#fbbf2418' }}><FaFileVideo /></div>
                <div className="file-info">
                  <div className="file-name">{transfer.title || transfer.name}</div>
                  <div className="file-meta">
                    <span>{transfer.name}</span>
                    <span className="dot-sep" />
                    <span>{formatSize(transfer.size)}</span>
                    <span className="dot-sep" />
                    <span>{timeAgo(transfer.createdAt)}</span>
                    {transfer.location?.name && <><span className="dot-sep" /><span><FaMapMarkerAlt /> {transfer.location.name}</span></>}
                  </div>
                  {transfer.tags?.length > 0 && <div className="post-tags">{transfer.tags.map(tag => `#${tag}`).join(' ')}</div>}
                  <div className="file-platforms">
                    {entries.map(([id, entry]) => <PlatformResult key={id} id={id} entry={entry} />)}
                  </div>
                  {problems.length > 0 && (
                    <div className="file-warnings">
                      {problems.map(([id, entry]) => (
                        <div key={id}>{platformMessage(id, entry.error || entry.warning)}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="file-status">
                  {transfer.status === 'running' && <span className="badge badge-amber"><FaSpinner className="spin" /> Publishing</span>}
                  {transfer.status === 'done' && <span className="badge badge-green"><FaCheckCircle /> {doneCount}/{entries.length} done</span>}
                  {transfer.status === 'partial' && <span className="badge badge-amber"><FaExclamationTriangle /> {doneCount}/{entries.length} done</span>}
                  {transfer.status === 'failed' && <span className="badge badge-red"><FaExclamationTriangle /> Failed</span>}
                </div>
                {transfer.status !== 'running' && (
                  <button className="file-action btn-ghost btn" onClick={() => setTransfers(previous => previous.filter(item => item.id !== transfer.id))} title="History se hatayein" aria-label="Remove from history">
                    <FaTrash />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {file && (
        <Composer
          file={file}
          platformState={platformState}
          initialTargets={defaultTargets}
          postDefaults={postDefaults}
          setPostDefaults={setPostDefaults}
          onClose={() => setFile(null)}
          onPublished={transfer => {
            setTransfers(previous => [transfer, ...previous].slice(0, 200))
            setFile(null)
          }}
        />
      )}
    </div>
  )
}

export default Upload
