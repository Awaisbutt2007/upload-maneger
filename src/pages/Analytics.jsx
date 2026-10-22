import { useMemo, useState } from 'react'
import { FaUpload, FaCheckCircle, FaExclamationTriangle, FaPercent, FaHashtag, FaChartLine } from 'react-icons/fa'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { PLATFORMS, PLATFORM_BY_ID } from '../platforms'
import './pages.css'

const RANGES = [{ id: 7, label: '7 Days' }, { id: 30, label: '30 Days' }, { id: 90, label: '90 Days' }]
const DAY = 24 * 60 * 60 * 1000
const legendStyle = { fontSize: 12, color: '#94a3b8', paddingTop: 12 }
const tooltipStyle = {
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: '12px',
  color: '#e2e8f0',
  fontSize: '13px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

function Analytics({ transfers = [] }) {
  const [range, setRange] = useState(30)

  const data = useMemo(() => {
    const since = Date.now() - range * DAY
    const posts = transfers.filter(transfer => transfer.createdAt >= since)
    const perPlatform = Object.fromEntries(PLATFORMS.map(platform => [platform.id, { done: 0, failed: 0 }]))
    const tagCounts = new Map()
    let done = 0
    let failed = 0
    for (const post of posts) {
      for (const [id, entry] of Object.entries(post.platforms || {})) {
        if (!perPlatform[id]) continue
        if (entry.status === 'done') { perPlatform[id].done++; done++ }
        if (entry.status === 'failed') { perPlatform[id].failed++; failed++ }
      }
      for (const tag of post.tags || []) tagCounts.set(tag.toLowerCase(), (tagCounts.get(tag.toLowerCase()) || 0) + 1)
    }

    const bucketDays = range > 30 ? 7 : 1
    const buckets = []
    for (let start = since; start < Date.now(); start += bucketDays * DAY) {
      const end = start + bucketDays * DAY
      const inBucket = posts.filter(post => post.createdAt >= start && post.createdAt < end)
      buckets.push({
        name: new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        posts: inBucket.length,
        published: inBucket.reduce((sum, post) => sum + Object.values(post.platforms || {}).filter(entry => entry.status === 'done').length, 0),
      })
    }

    return {
      posts,
      done,
      failed,
      successRate: done + failed ? Math.round((done / (done + failed)) * 100) : null,
      timeline: buckets,
      platformBars: PLATFORMS.map(platform => ({ name: platform.label, published: perPlatform[platform.id].done, failed: perPlatform[platform.id].failed })),
      pie: PLATFORMS.map(platform => ({ name: platform.label, value: perPlatform[platform.id].done, color: platform.color })).filter(slice => slice.value > 0),
      topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    }
  }, [transfers, range])

  const stats = [
    { label: 'Videos posted', value: data.posts.length, icon: FaUpload, color: 'cyan' },
    { label: 'Platform publishes', value: data.done, icon: FaCheckCircle, color: 'teal' },
    { label: 'Failed', value: data.failed, icon: FaExclamationTriangle, color: 'amber' },
    { label: 'Success rate', value: data.successRate === null ? '—' : `${data.successRate}%`, icon: FaPercent, color: 'sky' },
  ]
  const maxTag = data.topTags[0]?.[1] || 1

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Aapki uploads ka hisaab — is browser ki post history se</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {RANGES.map(item => (
            <button
              key={item.id}
              type="button"
              className={'btn ' + (range === item.id ? 'btn-primary' : 'btn-secondary')}
              aria-pressed={range === item.id}
              onClick={() => setRange(item.id)}
            >{item.label}</button>
          ))}
        </div>
      </header>

      <div className="stat-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="stat-card glass-card" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
              <div className={`stat-icon ${stat.color}`}><Icon /></div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-delta">Last {range} days</div>
            </div>
          )
        })}
      </div>

      {data.posts.length === 0 ? (
        <div className="glass-card empty-state empty-large">
          <div className="empty-icon-wrap"><FaChartLine className="empty-icon-big" /></div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Is range mein koi post nahi</h3>
          <p style={{ color: '#64748b', fontSize: 14, maxWidth: 440, lineHeight: 1.6 }}>
            Upload page se video publish karein — yahan har platform ki kamyab aur fail posts ke charts ban jayenge.
          </p>
        </div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.25s' }}>
            <div className="chart-head">
              <h3 className="chart-title">Posting activity</h3>
              <span className="badge badge-teal">{range > 30 ? 'Weekly' : 'Daily'}</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cPosts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cPublished" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} minTickGap={16} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
                <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="posts" name="Videos" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cPosts)" />
                <Area type="monotone" dataKey="published" name="Platform publishes" stroke="#14b8a6" strokeWidth={2.5} fill="url(#cPublished)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.3s' }}>
            <div className="chart-head">
              <h3 className="chart-title">Published per platform</h3>
              <span className="badge badge-cyan">Share</span>
            </div>
            {data.pie.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.pie} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value">
                    {data.pie.map(slice => <Cell key={slice.name} fill={slice.color} stroke="rgba(15, 23, 42, 0.8)" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
                  <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="settings-inline-hint">Abhi koi post kamyabi se publish nahi hui.</p>}
          </div>

          <div className="chart-card glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.35s' }}>
            <div className="chart-head">
              <h3 className="chart-title">Success vs failed</h3>
              <span className="badge badge-amber">Platforms</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.platformBars} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                <Bar dataKey="published" name="Published" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.4s' }}>
            <div className="chart-head">
              <h3 className="chart-title">Top tags</h3>
              <FaHashtag style={{ color: '#64748b' }} />
            </div>
            {data.topTags.length ? (
              <div className="country-list">
                {data.topTags.map(([tag, count], index) => (
                  <div key={tag} className="country-row tag-row">
                    <span className="country-rank">{index + 1}</span>
                    <span className="country-name">#{tag}</span>
                    <span className="country-visits">{count}</span>
                    <div className="country-bar">
                      <div className="country-bar-fill" style={{ width: `${(count / maxTag) * 100}%`, background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="settings-inline-hint">Posts mein tags add karein — sab se zyada use hone wale yahan dikhenge.</p>}
          </div>
        </div>
      )}

      <p className="settings-inline-hint" style={{ marginTop: 20 }}>
        Views, likes aur followers jaisi stats har platform apni app/studio mein dikhata hai: {PLATFORMS.map(platform => PLATFORM_BY_ID[platform.id].label).join(', ')}.
      </p>
    </div>
  )
}

export default Analytics
