function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

function Dashboard() {
  const user = getStoredUser()

  return (
    <section>
      <div className="page-heading-row">
        <h1>Dashboard</h1>
      </div>
      <div className="content-panel dashboard-panel">
        <h2>Clinic Management System</h2>
        <p className="welcome-message">
          Welcome, {user?.firstName || 'User'}
        </p>
      </div>
    </section>
  )
}

export default Dashboard
