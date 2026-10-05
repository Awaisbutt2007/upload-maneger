import {
  FaUpload, FaInbox, FaChartLine, FaCog, FaChevronLeft, FaChevronRight
} from 'react-icons/fa'
import './Sidebar.css'

function Sidebar({ active, setActive, collapsed, setCollapsed }) {
  const topItems = [
    { id: 'upload', label: 'Upload', icon: FaUpload, badge: 3 },
    { id: 'inbox', label: 'Inbox', icon: FaInbox, badge: 12 },
  ]
  const midItems = [
    { id: 'analytics', label: 'Analytics', icon: FaChartLine },
  ]
  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: FaCog },
  ]

  const renderItem = (item, idx, idxGlobal) => {
    const Icon = item.icon
    const isActive = active === item.id

    return (
      <button
        key={item.id}
        className={`nav-item ${isActive ? 'active' : ''}`}
        onClick={() => setActive(item.id)}
        style={{ animationDelay: `${idxGlobal * 0.06}s` }}
      >
        <div className="nav-icon-wrap">
          <Icon className="nav-icon" />
          {isActive && <span className="nav-pulse" />}
        </div>

        {!collapsed && (
          <>
            <span className="nav-label">{item.label}</span>
            {item.badge && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </>
        )}

        {collapsed && item.badge && (
          <span className="nav-badge-dot" />
        )}

        {isActive && !collapsed && <span className="nav-indicator" />}
        {isActive && collapsed && <span className="nav-indicator-side" />}
      </button>
    )
  }

  let globalIdx = 0

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-inner">
        <div className="sidebar-header">
          <div className="logo-wrap">
            <div className="logo-icon">
              <span className="logo-shape" />
              <span className="logo-shape-2" />
            </div>
            {!collapsed && (
              <div className="logo-text-wrap">
                <span className="logo-text">Platform</span>
                <span className="logo-text-accent">Manager</span>
              </div>
            )}
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {!collapsed && <span className="nav-section-title">Quick Actions</span>}
            <div className="nav-group">
              {topItems.map((it, i) => renderItem(it, i, globalIdx++))}
            </div>
          </div>

          <div className="nav-section">
            {!collapsed && <span className="nav-section-title">Insights</span>}
            <div className="nav-group">
              {midItems.map((it, i) => renderItem(it, i, globalIdx++))}
            </div>
          </div>
        </nav>

        <div className="nav-section bottom">
          {!collapsed && <span className="nav-section-title">System</span>}
          <div className="nav-group">
            {bottomItems.map((it, i) => renderItem(it, i, globalIdx++))}
          </div>

          {!collapsed && (
            <div className="profile-card">
              <div className="avatar">
                <span className="avatar-initials">PM</span>
                <span className="avatar-status" />
              </div>
              <div className="profile-info">
                <span className="profile-name">Admin</span>
                <span className="profile-role">Pro Plan</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
