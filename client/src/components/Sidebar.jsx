import { NavLink } from 'react-router-dom'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  )
}

function PatientsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 15c3.6-.8 5.8.8 6.5 4.5" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  )
}

function Sidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onClose,
  onNavigate,
  onLogout,
}) {
  const getNavLinkClass = ({ isActive }) =>
    isActive ? 'sidebar-link active' : 'sidebar-link'

  return (
    <aside
      id="clinic-sidebar"
      className={`sidebar${collapsed ? ' collapsed' : ''}${
        mobileOpen ? ' mobile-open' : ''
      }`}
    >
      <div className="sidebar-header">
        <span className="sidebar-brand">Clinic System</span>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <MenuIcon />
        </button>
        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          ×
        </button>
      </div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        <NavLink
          to="/dashboard"
          className={getNavLinkClass}
          onClick={onNavigate}
          title={collapsed ? 'Dashboard' : undefined}
        >
          <span className="sidebar-icon">
            <DashboardIcon />
          </span>
          <span className="sidebar-label">Dashboard</span>
        </NavLink>

        <NavLink
          to="/patients"
          className={getNavLinkClass}
          onClick={onNavigate}
          title={collapsed ? 'Patients' : undefined}
        >
          <span className="sidebar-icon">
            <PatientsIcon />
          </span>
          <span className="sidebar-label">Patients</span>
        </NavLink>
      </nav>

      <button
        type="button"
        className="sidebar-link sidebar-logout"
        onClick={onLogout}
        title={collapsed ? 'Logout' : undefined}
      >
        <span className="sidebar-icon">
          <LogoutIcon />
        </span>
        <span className="sidebar-label">Logout</span>
      </button>
    </aside>
  )
}

export default Sidebar
