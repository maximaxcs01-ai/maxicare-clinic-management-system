import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

function ProtectedRoute({ children, allowPasswordSetup = false }) {
  const { token, user, loading } = useAuth()

  if (loading) {
    return <p className="state-message">Checking your session...</p>
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (user?.mustChangePassword === true && !allowPasswordSetup) {
    return <Navigate to="/setup-password" replace />
  }

  return children
}

export default ProtectedRoute
