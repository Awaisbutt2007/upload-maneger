import {
  FaUpload, FaDownload, FaUserPlus, FaEye, FaArrowUp, FaArrowDown, FaThList
} from 'react-icons/fa'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import './pages.css'

const trafficData = [
  { name: 'Mon', uploads: 240, downloads: 180, visitors: 420 },
  { name: 'Tue', uploads: 320, downloads: 230, visitors: 560 },
  { name: 'Wed', uploads: 280, downloads: 260, visitors: 490 },
  { name: 'Thu', uploads: 400, downloads: 310, visitors: 680 },
  { name: 'Fri', uploads: 520, downloads: 420, visitors: 820 },
  { name: 'Sat', uploads: 380, downloads: 290, visitors: 610 },
  { name: 'Sun', uploads: 310, downloads: 240, visitors: 540 },
]

const fileTypeData = [
  { name: 'Images', value: 42, color: '#06b6d4' },
  { name: 'Videos', value: 24, color: '#14b8a6' },
  { name: 'Documents', value: 18, color: '#0ea5e9' },
  { name: 'Archives', value: 10, color: '#f59e0b' },
  { name: 'Other', value: 6, color: '#64748b' },
]

const barData = [
  { name: 'Week 1', new: 120, returning: 220 },
  { name: 'Week 2', new: 180, returning: 260 },
  { name: 'Week 3', new: 220, returning: 310 },
  { name: 'Week 4', new: 280, returning: 380 },
]

const topCountries = [
  { country: 'United States', flag: '🇺🇸', visits: 12420, change: '+12.4%', up: true },
  { country: 'Germany', flag: '🇩🇪', visits: 8640, change: '+8.2%', up: true },
  { country: 'Japan', flag: '🇯🇵', visits: 6120, change: '+15.1%', up: true },
  { country: 'Brazil', flag: '🇧🇷', visits: 4830, change: '-2.3%', up: false },
  { country: 'India', flag: '🇮🇳', visits: 3960, change: '+22.8%', up: true },
]

function Analytics() {
  const stats = [
    { label: 'Total Uploads', value: '12,847', delta: '+14.2%', up: true, icon: FaUpload, color: 'cyan' },
    { label: 'Total Downloads', value: '8,231', delta: '+9.6%', up: true, icon: FaDownload, color: 'teal' },
    { label: 'New Users', value: '1,284', delta: '+18.3%', up: true, icon: FaUserPlus, color: 'amber' },
    { label: 'Page Views', value: '64.2K', delta: '-2.1%', up: false, icon: FaEye, color: 'sky' },
  ]

  const tooltipStyle = {
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(6, 182, 212, 0.3)',
    borderRadius: '12px',
    color: '#e2e8f0',
    fontSize: '13px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Overview of your platform performance</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary">7 Days</button>
          <button className="btn btn-primary">30 Days</button>
          <button className="btn btn-secondary">90 Days</button>
        </div>
      </header>

      <div className="stat-grid">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="stat-card glass-card" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <div className={`stat-icon ${s.color}`}><Icon /></div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className={`stat-delta ${s.up ? 'up' : 'down'}`}>
                {s.up ? <FaArrowUp /> : <FaArrowDown />} {s.delta} vs last month
              </div>
            </div>
          )
        })}
      </div>

      <div className="charts-grid">
        <div className="chart-card glass-card big" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.25s' }}>
          <div className="chart-head">
            <h3 className="chart-title">Traffic Overview</h3>
            <span className="badge badge-teal">Weekly</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trafficData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cUploads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cDownloads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} cursor={{ stroke: 'rgba(6,182,212,0.25)' }} />
                <Legend wrapperStyle={{ paddingTop: 16 }} />
                <Area type="monotone" dataKey="uploads" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cUploads)" animationDuration={1000} />
                <Area type="monotone" dataKey="downloads" stroke="#14b8a6" strokeWidth={2.5} fill="url(#cDownloads)" animationDuration={1200} />
                <Area type="monotone" dataKey="visitors" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#cVisitors)" animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.3s' }}>
          <div className="chart-head">
            <h3 className="chart-title">File Types</h3>
            <span className="badge badge-cyan">Distribution</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={fileTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={1200}
                >
                  {fileTypeData.map((e, i) => (
                    <Cell key={i} fill={e.color} stroke="rgba(15, 23, 42, 0.8)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card glass-card" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.35s' }}>
          <div className="chart-head">
            <h3 className="chart-title">Weekly Growth</h3>
            <span className="badge badge-amber">Users</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(6,182,212,0.08)' }} />
                <Legend wrapperStyle={{ paddingTop: 12 }} />
                <Bar dataKey="new" fill="#06b6d4" radius={[8, 8, 0, 0]} animationDuration={1000} />
                <Bar dataKey="returning" fill="#14b8a6" radius={[8, 8, 0, 0]} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card glass-card big" style={{ animation: 'fadeIn 0.6s ease both', animationDelay: '0.4s' }}>
          <div className="chart-head">
            <h3 className="chart-title">Top Countries</h3>
            <FaThList style={{ color: '#64748b' }} />
          </div>
          <div className="country-list">
            {topCountries.map((c, i) => (
              <div key={c.country} className="country-row">
                <span className="country-rank">{i + 1}</span>
                <span className="country-flag">{c.flag}</span>
                <span className="country-name">{c.country}</span>
                <span className="country-visits">{c.visits.toLocaleString()}</span>
                <span className={`stat-delta ${c.up ? 'up' : 'down'}`}>
                  {c.up ? <FaArrowUp /> : <FaArrowDown />} {c.change}
                </span>
                <div className="country-bar">
                  <div
                    className="country-bar-fill"
                    style={{
                      width: `${(c.visits / topCountries[0].visits) * 100}%`,
                      background: c.up
                        ? 'linear-gradient(90deg, #06b6d4, #14b8a6)'
                        : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
