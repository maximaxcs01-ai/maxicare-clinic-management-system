import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'

function AuthenticatedLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setMobileSidebarOpen(false)
    navigate('/login')
  }

  return (
    <div
      className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggle={() => setSidebarCollapsed((current) => !current)}
        onClose={() => setMobileSidebarOpen(false)}
        onNavigate={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMobileSidebarOpen(true)}
          aria-controls="clinic-sidebar"
          aria-expanded={mobileSidebarOpen}
        >
          ☰
          <span className="visually-hidden">Open navigation</span>
        </button>
        <span>Clinic Management System</span>
      </header>

      <div className="protected-content">
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AuthenticatedLayout
