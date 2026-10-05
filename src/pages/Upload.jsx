import { useState, useRef, useMemo, useEffect } from 'react'
import {
  FaUpload, FaFileAlt, FaFileImage, FaFileVideo, FaFileArchive, FaTrash,
  FaCheckCircle, FaCloudUploadAlt, FaFolderPlus, FaExternalLinkAlt, FaClock,
  FaInbox, FaLink, FaTimes, FaImage, FaPaperclip, FaFile, FaSync, FaExclamationTriangle,
  FaExclamationCircle, FaSpinner
} from 'react-icons/fa'
import { FaTiktok, FaInstagram, FaLinkedin, FaTwitter, FaWhatsapp } from 'react-icons/fa6'
import './pages.css'

const PLATFORM_META = {
  tiktok:    { label: 'TikTok',     Icon: FaTiktok,    color: '#ff0050' },
  instagram: { label: 'Instagram',  Icon: FaInstagram, color: '#E1306C' },
  linkedin:  { label: 'LinkedIn',   Icon: FaLinkedin,  color: '#0A66C2' },
  twitter:   { label: 'X / Twitter', Icon: FaTwitter,  color: '#1da1f2' },
  whatsapp:  { label: 'WhatsApp',   Icon: FaWhatsapp,  color: '#25D366' },
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function detectType(name) {
  const n = name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/.test(n)) return 'image'
  if (/\.(mp4|mov|avi|mkv|webm|m4v)$/.test(n)) return 'video'
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return 'archive'
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|fig|psd)$/.test(n)) return 'design'
  return 'other'
}

function Upload({ links = {}, transfers = [], setTransfers }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const thumbRef = useRef(null)

  const connectedPlatforms = useMemo(
    () => Object.entries(links).filter(([, v]) => v?.connected).map(([k]) => k),
    [links]
  )

  const [publishTargets, setPublishTargets] = useState(() => new Set(connectedPlatforms))

  useEffect(() => {
    setPublishTargets(prev => {
      const fresh = new Set(prev)
      connectedPlatforms.forEach(p => fresh.add(p))
      return fresh
    })
  }, [connectedPlatforms.join('|')])

  const toggleTarget = (pid) => {
    setPublishTargets(prev => {
      const n = new Set(prev)
      if (n.has(pid)) n.delete(pid); else n.add(pid)
      return n
    })
  }

  const getFileIcon = (type) => {
    switch (type) {
      case 'image': return FaFileImage
      case 'video': return FaFileVideo
      case 'archive': return FaFileArchive
      default: return FaFileAlt
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'image': return '#22d3ee'
      case 'video': return '#fbbf24'
      case 'archive': return '#a78bfa'
      default: return '#38bdf8'
    }
  }

  const removeFile = (id) => {
    setTransfers(prev => prev.filter(f => f.id !== id))
  }

  const openLink = (pid, e) => {
    e.stopPropagation()
    const l = links[pid]?.url
    if (l) window.open(l.startsWith('http') ? l : 'https://' + l, '_blank')
  }

  // --- Modal State ---
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFiles, setModalFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState('')
  const [previewType, setPreviewType] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbName, setThumbName] = useState('')

  const openModalWithFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return
    const arr = Array.from(fileList)
    const main = arr[0]
    const t = detectType(main.name)
    const newPreviewUrl = (t === 'image' || t === 'video') ? URL.createObjectURL(main) : ''
    setModalFiles(arr)
    setPreviewType(t)
    setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return newPreviewUrl })
    setThumbPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return '' })
    const extIdx = main.name.lastIndexOf('.')
    setTitle(extIdx > 0 ? main.name.slice(0, extIdx) : main.name)
    setDescription('')
    setThumbName('')
    setModalOpen(true)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl)
    }
  }, [])

  const closeModal = () => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl('') }
    if (thumbPreviewUrl) { URL.revokeObjectURL(thumbPreviewUrl); setThumbPreviewUrl('') }
    setModalOpen(false)
    setModalFiles([])
    setTitle('')
    setDescription('')
    setThumbName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const pickThumbnail = (e) => { if (e) e.stopPropagation(); thumbRef.current?.click() }
  const onThumbChosen = (e) => {
    e.stopPropagation()
    const f = e.target.files?.[0]
    if (f && detectType(f.name) === 'image') {
      setThumbName(f.name)
      const newUrl = URL.createObjectURL(f)
      setThumbPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return newUrl })
    }
    e.target.value = ''
  }

  const generatePostId = (pid) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let s = ''
    for (let k = 0; k < 12; k++) s += chars.charAt(Math.floor(Math.random() * chars.length))
    return s
  }

  const buildPostUrl = (pid, linkData, postId) => {
    const tpl = linkData?.postUrlTemplate
    if (!tpl || !postId) return null
    const handle = linkData?.userHandle || (linkData?.url ? (linkData.url.match(/@?([A-Za-z0-9_.]+)/)?.[1] || '') : '')
    return tpl
      .replace(/\{handle\}/g, encodeURIComponent(handle))
      .replace(/\{id\}/g, encodeURIComponent(postId))
  }

  const confirmUpload = () => {
    if (modalFiles.length === 0) return
    const ts = Date.now()
    const targets = Array.from(publishTargets)
    const warnings = []
    const skippedPlatforms = []

    targets.forEach(pid => {
      const l = links[pid]
      const connected = !!l?.connected
      const hasToken = !!l?.accessToken && l.accessToken.length >= 8
      const hasUrl = !!l?.url && l.url.length >= 4
      if (!connected) {
        warnings.push(`${PLATFORM_META[pid]?.label || pid} — Not connected. Connect karein Settings se pehle.`)
        skippedPlatforms.push(pid)
      } else if (!hasToken || !hasUrl) {
        warnings.push(`${PLATFORM_META[pid]?.label}: Setup incomplete (need profile URL + access token)`)
      }
    })

    if (skippedPlatforms.length === targets.length && warnings.length > 0) {
      alert('Koi bhi platform ready nahi:\n\n' + warnings.join('\n') + '\n\nSab se pehle Settings → Links mein jaake platforms setup karein.')
      return
    }

    const readyTargets = targets.filter(pid => !skippedPlatforms.includes(pid))
    if (readyTargets.length === 0) return

    const newFiles = modalFiles.map((f, i) => {
      const type = detectType(f.name)
      const platforms = {}
      const platformPostIds = {}
      const platformUrls = {}
      const platformWarnings = {}

      readyTargets.forEach((pid, idx) => {
        const postId = generatePostId(pid)
        platformPostIds[pid] = postId
        const linkInfo = links[pid]
        const url = buildPostUrl(pid, linkInfo, postId)
        if (url) platformUrls[pid] = url
        if (!linkInfo?.accessToken || linkInfo.accessToken.length < 8) {
          platformWarnings[pid] = 'Prototype mode — actual API call ke liye backend server chahiye'
        }
        if (idx === 0) platforms[pid] = 'publishing'
        else platforms[pid] = 'queued'
      })

      const hasAnyPublishing = Object.values(platforms).some(s => s === 'publishing' || s === 'queued')
      const status = hasAnyPublishing ? 'uploading' : 'uploaded'
      const progress = status === 'uploading' ? 5 + Math.floor(Math.random() * 8) : undefined

      return {
        id: ts + '-' + i + '-' + Math.random().toString(36).slice(2, 7),
        name: f.name,
        type,
        size: formatSize(f.size),
        status,
        progress,
        date: 'just now',
        platforms,
        platformPostIds,
        platformUrls,
        platformWarnings,
        title: title.trim() || f.name,
        description: description.trim(),
        thumbnail: thumbName,
        lastStepTs: ts,
        failAttempts: 0,
        startedAt: ts,
      }
    })

    setTransfers(prev => [...newFiles, ...prev])
    closeModal()
  }

  useEffect(() => {
    const TICK_MS = 750

    const tick = () => {
      setTransfers(prevTransfers => {
        if (!prevTransfers.some(f => f.status === 'uploading')) return prevTransfers
        const now = Date.now()

        return prevTransfers.map(f => {
          if (f.status !== 'uploading') return f

          const nextPlatforms = { ...f.platforms }
          const pids = Object.keys(nextPlatforms)
          let pChanged = false

          const publishingIdx = pids.findIndex(p => nextPlatforms[p] === 'publishing')
          if (publishingIdx >= 0) {
            const shouldFinish = Math.random() < 0.28
            if (shouldFinish) {
              nextPlatforms[pids[publishingIdx]] = 'done'
              pChanged = true
              const nextQueuedIdx = pids.findIndex((p, j) => j > publishingIdx && nextPlatforms[p] === 'queued')
              if (nextQueuedIdx >= 0) {
                nextPlatforms[pids[nextQueuedIdx]] = 'publishing'
                pChanged = true
              }
            }
          }

          let nextProgress = f.progress ?? 0
          const allDone = Object.values(nextPlatforms).every(s => s === 'done')
          const anyActive = Object.values(nextPlatforms).some(s => s === 'publishing' || s === 'queued')

          if (allDone) {
            nextProgress = 100
          } else if (anyActive) {
            const remainingPlatforms = pids.filter(p => nextPlatforms[p] !== 'done').length
            const perPlatformChunk = 85 / Math.max(pids.length, 1)
            const doneCount = pids.length - remainingPlatforms
            const baseFromDone = Math.min(85, doneCount * perPlatformChunk)
            const currentPublishingProgress = Math.min(perPlatformChunk - 1, 2 + Math.random() * 6)
            const target = Math.min(96, baseFromDone + currentPublishingProgress)
            nextProgress = Math.min(96, Math.max(nextProgress + Math.ceil(Math.random() * 5), Math.min(target, nextProgress + 8)))
            nextProgress = Math.min(96, nextProgress)
          }

          const willFail = (!f.failAttempts || f.failAttempts < 1) && f.progress && f.progress > 40 && f.progress < 92 && Math.random() < 0.025

          if (willFail) {
            const pidsArr = pids.filter(p => nextPlatforms[p] === 'publishing' || nextPlatforms[p] === 'queued')
            if (pidsArr.length > 0) {
              const victim = pidsArr[0]
              nextPlatforms[victim] = 'failed'
              pChanged = true
              const hasMoreWork = Object.values(nextPlatforms).some(s => s === 'publishing' || s === 'queued')
              return {
                ...f,
                platforms: nextPlatforms,
                status: hasMoreWork ? 'uploading' : 'failed',
                progress: nextProgress,
                lastStepTs: now,
                failAttempts: (f.failAttempts ?? 0) + 1,
              }
            }
          }

          const nextStatus = allDone ? 'uploaded' : 'uploading'

          if (!pChanged && nextProgress === f.progress && nextStatus === f.status) return f
          return {
            ...f,
            platforms: pChanged ? nextPlatforms : f.platforms,
            progress: nextProgress,
            status: nextStatus,
            lastStepTs: now,
          }
        })
      })
    }

    const iv = setInterval(tick, TICK_MS)
    return () => clearInterval(iv)
  }, [setTransfers])

  const retryTransfer = (id) => {
    setTransfers(prevTransfers => prevTransfers.map(f => {
      if (f.id !== id) return f
      const newPlatforms = {}
      const pids = Object.keys(f.platforms)
      pids.forEach((pid, idx) => {
        const s = f.platforms[pid]
        if (s === 'failed' && idx === 0) newPlatforms[pid] = 'publishing'
        else if (s === 'failed') newPlatforms[pid] = 'queued'
        else newPlatforms[pid] = s
      })
      return {
        ...f,
        status: 'uploading',
        progress: Math.max(10, Math.min(90, (f.progress ?? 50) - 5)),
        platforms: newPlatforms,
        lastStepTs: Date.now(),
        failAttempts: (f.failAttempts ?? 0) + 1,
      }
    }))
  }

  const onFilesChosen = (e) => {
    openModalWithFiles(e.target.files)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    openModalWithFiles(e.dataTransfer.files)
  }

  const statusLabel = (s) => ({
    done: 'Published (go to post)',
    publishing: 'Uploading / processing…',
    queued: 'Queue mein hain — agla platform',
    failed: 'Failed — Retry dabayein',
  }[s] || s)

  const PublishPill = ({ pid, status, postUrl, warning }) => {
    const meta = PLATFORM_META[pid]
    if (!meta) return null
    const { Icon } = meta
    let cls = 'slate', extra = null
    if (status === 'done')      { cls = 'green';  extra = <FaCheckCircle /> }
    else if (status === 'publishing') { cls = 'amber'; extra = <FaClock className="spin" /> }
    else if (status === 'failed') { cls = 'red'; extra = <FaExclamationTriangle /> }
    else if (status === 'queued') { cls = 'slate'; extra = null }

    const Tip = (
      <div className="pill-tooltip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon style={{ color: meta.color }} />
          <b style={{ color: '#e2e8f0' }}>{meta.label}</b>
        </div>
        <div className="pill-tip-line">Status: <b className={'pill-tip-status ' + cls}>{status.toUpperCase()}</b></div>
        <div className="pill-tip-line small">{statusLabel(status)}</div>
        {warning && (
          <div className="pill-tip-line warn">
            <FaExclamationCircle /> {warning}
          </div>
        )}
        {status === 'done' && postUrl && (
          <div className="pill-tip-line done">
            <FaExternalLinkAlt /> Click pill to open post
          </div>
        )}
      </div>
    )

    const Tag = (props) => status === 'done' && postUrl
      ? <a href={postUrl} target="_blank" rel="noreferrer" {...props} />
      : <span {...props} />

    return (
      <Tag
        className={'platform-pill ' + cls + ' interactive'}
        style={{ borderColor: meta.color + '55', background: meta.color + '18', cursor: (status === 'done' && postUrl) ? 'pointer' : 'default' }}
      >
        <Icon style={{ color: meta.color }} />
        {extra}
        {Tip}
      </Tag>
    )
  }

  const firstFile = modalFiles[0]

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Upload</h1>
          <p className="page-subtitle">
            Neeche Upload dabayein ya drag & drop karein
            {connectedPlatforms.length > 0 && (
              <> · Auto-publish to <b style={{ color: 'var(--accent-1)' }}>{connectedPlatforms.length}</b> linked platforms</>
            )}
            {transfers.length > 0 && (
              <> · <b style={{ color: 'var(--accent-2)' }}>{transfers.length}</b> transfers in session</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary">
            <FaFolderPlus /> New Folder
          </button>
          <button
            className="btn btn-primary"
            onClick={() => inputRef.current?.click()}
          >
            <FaCloudUploadAlt /> Upload Files
          </button>
        </div>
      </header>

      {/* Auto Publish Panel */}
      <div
        className="publish-panel glass-card"
        style={{ animation: 'fadeIn 0.55s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.08s', marginBottom: 24 }}
      >
        <div className="publish-head">
          <div>
            <h3 className="publish-title">🌐 Auto-Publish To Social Platforms</h3>
            <p className="publish-sub">
              Jo platform yahan select honge — unpe file upload ke baad <b>automatic public</b> ho jayega.
              Settings → Links se aur platforms connect karein.
            </p>
          </div>
          {connectedPlatforms.length === 0 && (
            <span className="badge badge-amber">⚠️ No platforms linked</span>
          )}
        </div>

        <div className="publish-platforms">
          {Object.entries(PLATFORM_META).map(([pid, meta], i) => {
            const linked = !!links[pid]?.connected
            const enabled = publishTargets.has(pid) && linked
            const { Icon } = meta

            return (
              <button
                key={pid}
                type="button"
                className={'publish-card ' + (enabled ? 'on ' : '') + (!linked ? 'disabled' : '')}
                onClick={() => linked && toggleTarget(pid)}
                disabled={!linked}
                style={{ animation: 'fadeIn 0.4s ease both', animationDelay: (0.12 + i * 0.04) + 's' }}
              >
                <div className="pub-card-top">
                  <div
                    className="pub-icon"
                    style={{
                      background: 'linear-gradient(135deg, ' + meta.color + ', ' + meta.color + 'cc)',
                      boxShadow: enabled ? '0 0 22px ' + meta.color + '88' : 'none',
                    }}
                  >
                    <Icon />
                  </div>
                  <span className={'pub-toggle ' + (enabled ? 'on' : '')}>
                    {enabled ? <FaCheckCircle /> : <FaClock style={{ opacity: linked ? 0.6 : 0.3 }} />}
                  </span>
                </div>
                <div className="pub-name">{meta.label}</div>
                <div className="pub-state">
                  {linked ? (
                    publishTargets.has(pid)
                      ? <span className="badge badge-green"><FaCheckCircle /> Will publish</span>
                      : <span className="badge badge-slate">Skipped</span>
                  ) : (
                    <span className="badge badge-red"><FaLink /> Not linked</span>
                  )}
                </div>
                {linked && links[pid]?.url && (
                  <button className="pub-link" onClick={(e) => openLink(pid, e)}>
                    <FaExternalLinkAlt /> Profile
                  </button>
                )}
              </button>
            )
          })}
        </div>

        <div className="publish-summary">
          <div>
            <b>{publishTargets.size}</b> / {Object.keys(PLATFORM_META).length} platforms selected ·
            <b> {connectedPlatforms.length}</b> connected
          </div>
          <div className="publish-selected">
            {Array.from(publishTargets).map(pid => {
              const { Icon, color, label } = PLATFORM_META[pid]
              return (
                <span key={pid} className="selected-chip" title={label} style={{ color }}>
                  <Icon />
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={onFilesChosen} />
      <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onThumbChosen} />

      {/* Simple Upload Zone — only "Upload" text */}
      <div
        className={'upload-zone glass-card minimal ' + (dragOver ? 'dragover' : '')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{ animation: 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) both', animationDelay: '0.15s' }}
      >
        <div className="upload-zone-inner minimal-inner">
          <div className="upload-icon-wrap big-zone-icon">
            <div className="upload-icon-ring" />
            <FaUpload className="upload-icon huge" />
          </div>
          <h2 className="upload-zone-big-text">Upload</h2>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="section-header">
          <h2 className="section-title">Recent Transfers</h2>
          {transfers.length > 0 && (
            <span className="badge badge-cyan">{transfers.length} file{transfers.length > 1 ? 's' : ''}</span>
          )}
          {transfers.length > 0 && (
            <a
              href=" "
              className="link-hover"
              onClick={(e) => {
                e.preventDefault()
                if (confirm('Clear all transfers?')) setTransfers([])
              }}
            >Clear all</a>
          )}
        </div>

        <div className="file-list glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.2s' }}>
          {transfers.length === 0 ? (
            <div className="empty-state empty-large">
              <div className="empty-icon-wrap">
                <FaInbox className="empty-icon-big" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                Abhi tak koi transfer nahi howa
              </h3>
              <p style={{ color: '#64748b', fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>
                Upar <b style={{ color: 'var(--accent-1)' }}>Upload</b> dabayein ya drag & drop karein.
                Files upload hote hi yahan Recent Transfers me nazar aayengi, aur jitne platforms
                aapne select kiye honge un par automatically publish bhi ho jayengi.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.entries(PLATFORM_META).map(([pid, meta]) => {
                  const linked = !!links[pid]?.connected
                  const { Icon } = meta
                  return (
                    <div
                      key={pid}
                      className="empty-platform-hint"
                      style={{
                        background: linked ? meta.color + '18' : 'rgba(71, 85, 105, 0.15)',
                        border: '1px solid ' + (linked ? meta.color + '55' : 'rgba(148, 163, 184, 0.12)'),
                        color: linked ? meta.color : '#64748b',
                      }}
                      title={linked ? meta.label + ' connected' : meta.label + ' not linked'}
                    >
                      <Icon />
                      <span>{meta.label}</span>
                      {linked ? <FaCheckCircle /> : <FaLink style={{ opacity: 0.7 }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : transfers.map((f, i) => {
            const Icon = getFileIcon(f.type)
            return (
              <div key={f.id} className="file-row" style={{ animation: 'fadeIn 0.5s ease both', animationDelay: (0.25 + i * 0.06) + 's' }}>
                <div className="file-icon" style={{ color: getIconColor(f.type), background: getIconColor(f.type) + '18' }}>
                  <Icon />
                </div>
                <div className="file-info">
                  <div className="file-name">{f.title || f.name}</div>
                  <div className="file-meta">
                    <span>{f.size}</span>
                    <span className="dot-sep" />
                    <span>{f.date}</span>
                    {f.description && (<><span className="dot-sep" /><span style={{ color: '#94a3b8' }}>{f.description.slice(0, 60)}</span></>)}
                  </div>
                  {(f.status === 'uploading' || f.status === 'failed') && typeof f.progress === 'number' && (
                    <div className="progress-wrap">
                      <div
                        className={'progress-bar ' + (f.status === 'failed' ? 'failed' : '')}
                        style={{ width: f.progress + '%' }}
                      />
                    </div>
                  )}
                  {f.platforms && Object.keys(f.platforms).length > 0 && (
                    <div className="file-platforms">
                      {Object.entries(f.platforms).map(([pid, st]) => (
                        <PublishPill
                          key={pid}
                          pid={pid}
                          status={st}
                          postUrl={f.platformUrls?.[pid]}
                          warning={f.platformWarnings?.[pid]}
                        />
                      ))}
                    </div>
                  )}
                  {f.status === 'uploaded' && f.platformUrls && Object.keys(f.platformUrls).length > 0 && (
                    <div className="file-post-links">
                      <FaExternalLinkAlt style={{ color: '#64748b', fontSize: 12 }} />
                      {Object.entries(f.platformUrls).filter(([pid]) => f.platforms?.[pid] === 'done').map(([pid, url]) => {
                        const m = PLATFORM_META[pid]
                        if (!m) return null
                        const { Icon, color } = m
                        return (
                          <a
                            key={pid + '-link'}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="post-link-chip"
                            title={`View on ${m.label}`}
                            style={{ color, borderColor: color + '55', background: color + '14' }}
                          >
                            <Icon /> View {m.label} post
                          </a>
                        )
                      })}
                    </div>
                  )}
                  {f.platformWarnings && Object.keys(f.platformWarnings).length > 0 && (
                    <div className="file-warnings">
                      <FaExclamationTriangle style={{ color: '#f59e0b', fontSize: 12 }} />
                      <span>
                        Prototype mode — Actual social API ke liye backend server chahiye. Ye link <b>pattern-based</b> hai (verify karne ke liye).
                      </span>
                    </div>
                  )}
                </div>
                <div className="file-status">
                  {f.status === 'uploaded' && <span className="badge badge-green"><FaCheckCircle /> Done</span>}
                  {f.status === 'uploading' && <span className="badge badge-amber">{f.progress || 0}%</span>}
                  {f.status === 'queued' && <span className="badge badge-cyan">Queued</span>}
                  {f.status === 'failed' && <span className="badge badge-red"><FaExclamationTriangle /> Failed</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {f.status === 'failed' && (
                    <button
                      className="file-action btn btn-ghost"
                      style={{ color: 'var(--accent-1)' }}
                      title="Retry upload"
                      onClick={(e) => { e.stopPropagation(); retryTransfer(f.id) }}
                    >
                      <FaSync />
                    </button>
                  )}
                  <button className="file-action btn-ghost btn" onClick={() => removeFile(f.id)} title="Remove from list">
                    <FaTrash />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upload Modal */}
      {modalOpen && firstFile && (
        <div key="modal-backdrop" className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div key="upload-modal" className="upload-modal glass-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}><FaTimes /></button>

            {/* Top row: preview (LEFT FIXED) + thumbnail (RIGHT FIXED) */}
            <div
              key="modal-top-grid"
              className="modal-top"
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 26,
                width: '100%',
                boxSizing: 'border-box',
                paddingBottom: 20,
                borderBottom: '1px solid rgba(148,163,184,0.14)',
                marginBottom: 22,
                flexWrap: 'nowrap',
              }}
            >
              {/* ====== LEFT: Selected File / Video Preview (NEVER CHANGES by thumbnail) ====== */}
              <div
                key="left-preview-column"
                className="modal-preview"
                style={{
                  flex: '0 0 auto',
                  width: '61.5%',
                  maxWidth: '61.5%',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxSizing: 'border-box',
                }}
              >
                <div className="preview-label">Selected file</div>
                <div key={`preview-media-${previewUrl || 'fallback'}`} className="preview-media">
                  {previewType === 'image' && previewUrl && (
                    <img key={`preview-img-${previewUrl}`} src={previewUrl} alt="selected-file-preview" />
                  )}
                  {previewType === 'video' && previewUrl && (
                    <video key={`preview-video-${previewUrl}`} src={previewUrl} controls autoPlay muted loop playsInline />
                  )}
                  {previewType !== 'image' && previewType !== 'video' && (
                    <div key={`preview-fb-${firstFile.name}`} className="preview-fallback">
                      <div className="preview-fallback-icon">
                        {previewType === 'archive' ? <FaFileArchive /> : <FaFile />}
                      </div>
                      <div className="preview-fallback-name">{firstFile.name}</div>
                      <div className="preview-fallback-size">{formatSize(firstFile.size)}</div>
                    </div>
                  )}
                </div>
                <div className="preview-meta">
                  <span className="badge badge-cyan"><FaPaperclip /> {firstFile.name}</span>
                  {modalFiles.length > 1 && (
                    <span className="badge badge-slate">+ {modalFiles.length - 1} more</span>
                  )}
                  <span className="badge badge-slate">{formatSize(firstFile.size)}</span>
                </div>
              </div>

              {/* ====== RIGHT: Thumbnail Column (OWN SECTION, never affects left) ====== */}
              <div
                key="right-thumb-column"
                className="modal-top-right"
                style={{
                  flex: '0 0 auto',
                  width: 'calc(38.5% - 26px)',
                  maxWidth: '38.5%',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  gap: 12,
                  paddingTop: 0,
                  boxSizing: 'border-box',
                }}
              >
                <div key="thumb-col-inner" className="thumb-col">
                  <div className="preview-label thumb-label">Thumbnail</div>
                  <div key={`thumb-frame-${thumbPreviewUrl || 'empty'}`} className={'thumb-preview-frame ' + (thumbPreviewUrl ? 'on' : '')}>
                    {thumbPreviewUrl ? (
                      <div key={`thumb-filled-${thumbPreviewUrl}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <img key={`thumb-img-${thumbPreviewUrl}`} src={thumbPreviewUrl} alt="thumbnail" className="thumb-preview-img" />
                        <div className="thumb-overlay-badge"><FaCheckCircle /> Selected</div>
                      </div>
                    ) : (
                      <div key="thumb-empty-state" className="thumb-empty">
                        <FaImage className="thumb-empty-icon" />
                        <div className="thumb-empty-text">No thumbnail</div>
                        <div className="thumb-empty-sub">Upload a cover image</div>
                      </div>
                    )}
                  </div>
                  <button className="btn btn-primary upload-thumb-btn" onClick={pickThumbnail} type="button">
                    <FaImage /> {thumbPreviewUrl ? 'Change Thumbnail' : 'Upload Thumbnail'}
                  </button>
                  {thumbName && thumbPreviewUrl && (
                    <div key={`thumb-info-${thumbName}`} className="thumb-info"><FaPaperclip /> {thumbName}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Title + Description inputs */}
            <div className="modal-body">
              <label className="field-label">Add Title</label>
              <input
                className="field-input title-input"
                placeholder="Title likhiye..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <label className="field-label" style={{ marginTop: 18 }}>Add Description</label>
              <textarea
                className="field-input desc-input"
                placeholder="Description likhiye..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary confirm-upload" onClick={confirmUpload}>
                <FaCloudUploadAlt /> Upload Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Upload
