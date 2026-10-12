import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { getRoleDestination } from '../utils/authRoutes'

function RoleRoute({ allowedRoles }) {
  const { user } = useAuth()

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to={getRoleDestination(user?.role)} replace />
  }

  return <Outlet />
}

export default RoleRoute
