import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FaTimes, FaCloudUploadAlt, FaSpinner, FaMapMarkerAlt, FaSearch, FaHashtag, FaExclamationTriangle,
  FaInfoCircle, FaCheck,
} from 'react-icons/fa'
import { api, uploadVideo } from '../api'
import { PLATFORMS, PLATFORM_BY_ID, PRIVACY_LABELS, displayHandle, formatSize } from '../platforms'
import './composer.css'

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MP4_ONLY = { linkedin: ['video/mp4'], instagram: ['video/mp4', 'video/quicktime'], facebook: ['video/mp4', 'video/quicktime'], x: ['video/mp4', 'video/quicktime'] }

function splitTags(text) {
  return text.split(/[\s,]+/).map(tag => tag.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean)
}

function Composer({ file, platformState, initialTargets, postDefaults, setPostDefaults, onClose, onPublished }) {
  const platforms = platformState.platforms || {}
  const connected = PLATFORMS.filter(platform => platforms[platform.id]?.connected).map(platform => platform.id)
  const metaConnected = platforms.instagram?.connected || platforms.facebook?.connected
  const tiktokInfo = platforms.tiktok?.options || {}

  const [previewUrl, setPreviewUrl] = useState('')
  const [duration, setDuration] = useState(null)
  const [title, setTitle] = useState(() => file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 100))
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState(postDefaults.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [locationName, setLocationName] = useState(postDefaults.locationName || '')
  const [placeId, setPlaceId] = useState(postDefaults.placeId || '')
  const [placeResults, setPlaceResults] = useState(null)
  const [placeSearching, setPlaceSearching] = useState(false)
  const [targets, setTargets] = useState(() => new Set(initialTargets.filter(id => connected.includes(id))))
  const [tiktok, setTiktok] = useState({ privacyLevel: '', allowComment: true, allowDuet: true, allowStitch: true, disclose: false, yourBrand: false, brandedContent: false })
  const [youtube, setYoutube] = useState({ privacyStatus: 'public', madeForKids: false })
  const [instagram, setInstagram] = useState({ shareToFeed: true })
  const [consent, setConsent] = useState(false)
  const [previews, setPreviews] = useState({})
  const [previewTab, setPreviewTab] = useState('')
  const [phase, setPhase] = useState('edit')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape' && phase === 'edit') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onClose])

  const pendingTags = splitTags(tagInput)
  const allTags = useMemo(() => [...new Set([...tags, ...pendingTags])], [tags, tagInput])
  const selected = PLATFORMS.filter(platform => targets.has(platform.id)).map(platform => platform.id)
  const activePreview = selected.includes(previewTab) ? previewTab : selected[0]

  // Ask the server for the exact text every selected platform will get.
  useEffect(() => {
    if (!selected.length) { setPreviews({}); return undefined }
    const timer = setTimeout(() => {
      api('/api/preview', {
        method: 'POST',
        body: { title, description, tags: allTags, location: { name: locationName, placeId }, platforms: selected },
      }).then(result => setPreviews(result.previews || {})).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [title, description, allTags.join(' '), locationName, placeId, selected.join(',')])

  const addTags = () => {
    if (!pendingTags.length) return
    setTags(previous => [...new Set([...previous, ...pendingTags])].slice(0, 30))
    setTagInput('')
  }

  const toggleTarget = id => setTargets(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const searchPlaces = async () => {
    if (locationName.trim().length < 2) return
    setPlaceSearching(true)
    try {
      const result = await api(`/api/meta/places?q=${encodeURIComponent(locationName.trim())}`)
      setPlaceResults(result.places)
    } catch (searchError) {
      setPlaceResults({ error: searchError.message })
    } finally {
      setPlaceSearching(false)
    }
  }

  const problems = []
  if (!VIDEO_TYPES.includes(file.type)) problems.push('Sirf MP4, MOV ya WebM video upload ho sakti hai.')
  if (!selected.length) problems.push('Kam az kam ek connected platform select karein.')
  if (!title.trim() && !description.trim()) problems.push('Title ya description likhein.')
  for (const id of selected) {
    if (MP4_ONLY[id] && !MP4_ONLY[id].includes(file.type)) problems.push(`${PLATFORM_BY_ID[id].label} ${id === 'linkedin' ? 'sirf MP4' : 'MP4 ya MOV'} accept karta hai.`)
  }
  if (targets.has('tiktok')) {
    if (!tiktok.privacyLevel) problems.push('TikTok: "Who can view" select karein.')
    if (tiktok.disclose && !tiktok.yourBrand && !tiktok.brandedContent) problems.push('TikTok: content disclosure on hai — "Your brand" ya "Branded content" select karein.')
    if (tiktokInfo.maxDurationSec && duration && duration > tiktokInfo.maxDurationSec) {
      problems.push(`TikTok: aapke account par max ${tiktokInfo.maxDurationSec}s video post ho sakti hai.`)
    }
  }
  if (!consent) problems.push('Neeche confirmation checkbox select karein.')

  const warnings = []
  if (duration && targets.has('x') && duration > 140) warnings.push('X par 140 second se lambi video sirf Premium accounts post kar sakte hain.')
  if (duration && targets.has('instagram') && (duration < 3 || duration > 900)) warnings.push('Instagram Reels 3 second se 15 minute tak ki honi chahiye.')
  if (targets.has('tiktok') && tiktok.privacyLevel && tiktok.privacyLevel !== 'SELF_ONLY') {
    warnings.push('Unaudited TikTok apps sirf "Only me" par post kar sakti hain — warna TikTok post reject kar dega.')
  }
  if (locationName && !placeId && selected.some(id => PLATFORM_BY_ID[id].location === 'native')) {
    warnings.push('Instagram/Facebook par asli location tag ke liye Place ID chahiye; warna location caption mein text ki tarah jayegi.')
  }

  const publish = async () => {
    if (problems.length || phase !== 'edit') return
    setError('')
    try {
      setPhase('uploading')
      const { uploadId } = await uploadVideo(file, setProgress)
      setPhase('publishing')
      const { job } = await api('/api/publish', {
        method: 'POST',
        body: {
          uploadId,
          title,
          description,
          tags: allTags,
          location: { name: locationName, placeId },
          platforms: selected,
          consent: true,
          options: {
            tiktok: {
              privacyLevel: tiktok.privacyLevel,
              disableComment: !tiktok.allowComment,
              disableDuet: !tiktok.allowDuet,
              disableStitch: !tiktok.allowStitch,
              brandOrganic: tiktok.disclose && tiktok.yourBrand,
              brandContent: tiktok.disclose && tiktok.brandedContent,
            },
            youtube,
            instagram,
          },
        },
      })
      setPostDefaults(previous => ({ ...previous, targets: selected }))
      onPublished({
        id: job.id,
        name: file.name,
        size: file.size,
        title: job.post.title,
        description: job.post.description,
        tags: job.post.tags,
        location: job.post.location,
        createdAt: job.createdAt,
        status: job.status,
        platforms: job.platforms,
      })
    } catch (publishError) {
      setError(publishError.message)
      setPhase('edit')
    }
  }

  const saveDefaults = () => setPostDefaults(previous => ({ ...previous, tags: allTags, locationName, placeId }))
  const busy = phase !== 'edit'
  const preview = activePreview ? previews[activePreview] : null

  // Portal to <body>: inside .main-content the modal would sit under the fixed sidebar.
  return createPortal(
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="upload-modal composer glass-card" role="dialog" aria-modal="true" aria-label="Publish video">
        <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close"><FaTimes /></button>
        <h2 className="composer-title">Publish video</h2>
        <p className="composer-sub">Ek dafa likhein — har selected platform par same video, description, tags aur location jayegi.</p>

        <div className="composer-grid">
          <div className="composer-left">
            <div className="preview-media composer-video">
              {previewUrl && <video src={previewUrl} controls muted playsInline onLoadedMetadata={event => setDuration(Math.round(event.currentTarget.duration))} />}
            </div>
            <div className="composer-file">
              <span className="badge badge-slate">{file.name}</span>
              <span className="badge badge-slate">{formatSize(file.size)}</span>
              {duration ? <span className="badge badge-slate">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')} min</span> : null}
            </div>

            <div className="field-label">Post to</div>
            <div className="target-grid">
              {PLATFORMS.map(platform => {
                const info = platforms[platform.id] || {}
                const isOn = targets.has(platform.id)
                const { Icon } = platform
                return (
                  <button
                    key={platform.id}
                    type="button"
                    className={`target-chip ${isOn ? 'on' : ''}`}
                    style={{ '--pcol': platform.color }}
                    disabled={!info.connected || busy}
                    onClick={() => toggleTarget(platform.id)}
                    title={info.connected ? displayHandle(platform.id, info.username) || platform.label : `${platform.label} connect nahi hai — Settings → Accounts`}
                    aria-pressed={isOn}
                  >
                    <Icon className="target-icon" />
                    <span className="target-text">
                      <b>{platform.label}</b>
                      <small>{info.connected ? displayHandle(platform.id, info.username) || 'Connected' : 'Not connected'}</small>
                    </span>
                    {isOn && <FaCheck className="target-check" />}
                  </button>
                )
              })}
            </div>
            {!connected.length && (
              <div className="composer-note warn"><FaInfoCircle /> Abhi koi platform connect nahi hai. Settings → Accounts se connect karein.</div>
            )}
          </div>

          <div className="composer-right">
            <label className="field-label" htmlFor="post-title">Title</label>
            <input id="post-title" className="field-input" value={title} maxLength={100} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="Video ka title" />

            <label className="field-label" htmlFor="post-description">
              Description <span className="field-count">{description.length} / 2200</span>
            </label>
            <textarea id="post-description" className="field-input desc-input" value={description} maxLength={2200} disabled={busy} onChange={event => setDescription(event.target.value)} placeholder="Caption / description likhein…" />

            <label className="field-label" htmlFor="post-tags"><FaHashtag /> Tags <span className="field-count">{allTags.length} / 30</span></label>
            <div className="tag-box">
              {tags.map(tag => (
                <span key={tag} className="tag-chip">
                  #{tag}
                  <button type="button" disabled={busy} onClick={() => setTags(previous => previous.filter(item => item !== tag))} aria-label={`Remove ${tag}`}><FaTimes /></button>
                </span>
              ))}
              <input
                id="post-tags"
                value={tagInput}
                disabled={busy}
                onChange={event => setTagInput(event.target.value)}
                onKeyDown={event => {
                  if (['Enter', ',', ' '].includes(event.key)) { event.preventDefault(); addTags() }
                  if (event.key === 'Backspace' && !tagInput && tags.length) setTags(previous => previous.slice(0, -1))
                }}
                onBlur={addTags}
                placeholder={tags.length ? 'Aur tag…' : 'travel, food, vlog — Enter dabayein'}
              />
            </div>

            <label className="field-label" htmlFor="post-location"><FaMapMarkerAlt /> Location</label>
            <div className="location-row">
              <input
                id="post-location"
                className="field-input"
                value={locationName}
                disabled={busy}
                onChange={event => { setLocationName(event.target.value); setPlaceId(''); setPlaceResults(null) }}
                onKeyDown={event => { if (event.key === 'Enter' && metaConnected) { event.preventDefault(); searchPlaces() } }}
                placeholder="e.g. Lahore, Pakistan"
              />
              {metaConnected && (
                <button type="button" className="btn btn-secondary" onClick={searchPlaces} disabled={busy || placeSearching || locationName.trim().length < 2} title="Instagram/Facebook location dhoondein">
                  {placeSearching ? <FaSpinner className="spin" /> : <FaSearch />} Find
                </button>
              )}
            </div>
            {placeResults && (
              <div className="place-results">
                {placeResults.error
                  ? <div className="composer-note warn">{placeResults.error} — Place ID khud neeche paste kar sakte hain.</div>
                  : placeResults.length === 0
                    ? <div className="composer-note">Koi location nahi mili.</div>
                    : placeResults.map(place => (
                      <button key={place.id} type="button" className="place-item" onClick={() => { setPlaceId(place.id); setLocationName(place.name); setPlaceResults(null) }}>
                        <FaMapMarkerAlt /> <b>{place.name}</b> <small>{place.detail}</small>
                      </button>
                    ))}
              </div>
            )}
            {metaConnected && (
              <input
                className="field-input place-id-input"
                value={placeId}
                disabled={busy}
                onChange={event => setPlaceId(event.target.value.replace(/\D/g, ''))}
                placeholder="Facebook/Instagram Place ID (optional — native location tag ke liye)"
                aria-label="Facebook Place ID"
              />
            )}
            <button type="button" className="link-btn" onClick={saveDefaults} disabled={busy}>Tags aur location ko default bana dein</button>

            {targets.has('tiktok') && (
              <fieldset className="platform-options" style={{ '--pcol': PLATFORM_BY_ID.tiktok.color }}>
                <legend>TikTok {platforms.tiktok?.displayName ? `· ${platforms.tiktok.displayName}` : ''}</legend>
                <label className="field-label" htmlFor="tiktok-privacy">Who can view this video</label>
                <select id="tiktok-privacy" className="field-input" value={tiktok.privacyLevel} disabled={busy} onChange={event => setTiktok(previous => ({ ...previous, privacyLevel: event.target.value }))}>
                  <option value="">Select…</option>
                  {(tiktokInfo.privacyLevels || []).map(level => (
                    <option key={level} value={level} disabled={tiktok.brandedContent && level === 'SELF_ONLY'}>{PRIVACY_LABELS[level] || level}</option>
                  ))}
                </select>
                <div className="check-row">
                  <label><input type="checkbox" checked={tiktok.allowComment && !tiktokInfo.commentDisabled} disabled={busy || tiktokInfo.commentDisabled} onChange={event => setTiktok(previous => ({ ...previous, allowComment: event.target.checked }))} /> Comments</label>
                  <label><input type="checkbox" checked={tiktok.allowDuet && !tiktokInfo.duetDisabled} disabled={busy || tiktokInfo.duetDisabled} onChange={event => setTiktok(previous => ({ ...previous, allowDuet: event.target.checked }))} /> Duet</label>
                  <label><input type="checkbox" checked={tiktok.allowStitch && !tiktokInfo.stitchDisabled} disabled={busy || tiktokInfo.stitchDisabled} onChange={event => setTiktok(previous => ({ ...previous, allowStitch: event.target.checked }))} /> Stitch</label>
                </div>
                <label className="check-line"><input type="checkbox" checked={tiktok.disclose} disabled={busy} onChange={event => setTiktok(previous => ({ ...previous, disclose: event.target.checked }))} /> Disclose video content (promotion / paid partnership)</label>
                {tiktok.disclose && (
                  <div className="check-row">
                    <label><input type="checkbox" checked={tiktok.yourBrand} disabled={busy} onChange={event => setTiktok(previous => ({ ...previous, yourBrand: event.target.checked }))} /> Your brand</label>
                    <label><input type="checkbox" checked={tiktok.brandedContent} disabled={busy} onChange={event => setTiktok(previous => ({ ...previous, brandedContent: event.target.checked, privacyLevel: event.target.checked && previous.privacyLevel === 'SELF_ONLY' ? '' : previous.privacyLevel }))} /> Branded content</label>
                  </div>
                )}
              </fieldset>
            )}

            {targets.has('youtube') && (
              <fieldset className="platform-options" style={{ '--pcol': PLATFORM_BY_ID.youtube.color }}>
                <legend>YouTube</legend>
                <label className="field-label" htmlFor="youtube-privacy">Visibility</label>
                <select id="youtube-privacy" className="field-input" value={youtube.privacyStatus} disabled={busy} onChange={event => setYoutube(previous => ({ ...previous, privacyStatus: event.target.value }))}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
                <label className="check-line"><input type="checkbox" checked={youtube.madeForKids} disabled={busy} onChange={event => setYoutube(previous => ({ ...previous, madeForKids: event.target.checked }))} /> Yes, it's made for kids</label>
              </fieldset>
            )}

            {targets.has('instagram') && (
              <fieldset className="platform-options" style={{ '--pcol': PLATFORM_BY_ID.instagram.color }}>
                <legend>Instagram</legend>
                <label className="check-line"><input type="checkbox" checked={instagram.shareToFeed} disabled={busy} onChange={event => setInstagram({ shareToFeed: event.target.checked })} /> Reel ko profile feed par bhi dikhayein</label>
              </fieldset>
            )}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="caption-preview">
            <div className="preview-tabs" role="tablist">
              {selected.map(id => {
                const { Icon, label } = PLATFORM_BY_ID[id]
                return (
                  <button key={id} type="button" role="tab" aria-selected={id === activePreview} className={id === activePreview ? 'on' : ''} onClick={() => setPreviewTab(id)}>
                    <Icon /> {label}
                  </button>
                )
              })}
            </div>
            <div className="preview-body">
              {preview ? (
                <>
                  {preview.title !== undefined && activePreview !== 'linkedin' && <div className="preview-title">{preview.title || '—'}</div>}
                  <pre className="preview-text">{preview.text || '—'}</pre>
                  <div className="preview-foot">
                    <span>{[...(preview.text || '')].length} characters</span>
                    {preview.tags && <span>Tags: {preview.tags.join(', ') || '—'}</span>}
                    {(preview.locationId || preview.placeId) && <span><FaMapMarkerAlt /> Location tag: {preview.locationId || preview.placeId}</span>}
                  </div>
                </>
              ) : <div className="preview-text muted">Preview load ho raha hai…</div>}
            </div>
          </div>
        )}

        {warnings.map(warning => <div key={warning} className="composer-note warn"><FaExclamationTriangle /> {warning}</div>)}

        <label className="consent-line">
          <input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />
          <span>
            Main confirm karta/karti hoon ke is video ko post karne ka haq mere paas hai aur ye selected platforms par publish ho jaye.
            {targets.has('tiktok') && (
              <> By posting, you agree to TikTok's <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer">Music Usage Confirmation</a>
                {tiktok.brandedContent && <> and <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer">Branded Content Policy</a></>}.</>
            )}
          </span>
        </label>

        {error && <div className="composer-note error"><FaExclamationTriangle /> {error}</div>}

        {phase === 'uploading' && (
          <div className="composer-progress">
            <div className="progress-wrap"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
            <span>Video server par upload ho rahi hai… {progress}%</span>
          </div>
        )}

        <div className="modal-foot">
          {problems.length > 0 && phase === 'edit' && <span className="foot-hint">{problems[0]}</span>}
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={publish} disabled={busy || problems.length > 0}>
            {busy ? <FaSpinner className="spin" /> : <FaCloudUploadAlt />}
            {phase === 'uploading' ? 'Uploading…' : phase === 'publishing' ? 'Starting…' : `Publish to ${selected.length || ''} platform${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Composer
