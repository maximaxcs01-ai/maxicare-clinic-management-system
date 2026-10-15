import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AuthPage from '../components/AuthPage'
import useAuth from '../hooks/useAuth'
import api from '../services/api'
import { getRoleDestination } from '../utils/authRoutes'

function SetupPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const { user, login } = useAuth()
  const navigate = useNavigate()

  if (user?.mustChangePassword !== true) {
    return <Navigate to={getRoleDestination(user?.role)} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8 || newPassword.length > 16) {
      setError('Password must be 8 to 16 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      const response = await api.patch('/auth/complete-password-setup', {
        newPassword,
        confirmPassword,
      })
      login(response.data.token, response.data.user)
      navigate(getRoleDestination(response.data.user?.role), { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update your password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPage>
      <div className="auth-heading">
        <h1>Create your password</h1>
        <p className="subtitle">Replace your temporary password before continuing.</p>
      </div>
      {error && <div className="message error-message" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="newPassword">New password</label>
          <div className="password-input-wrap">
            <input id="newPassword" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={16} autoComplete="new-password" required />
            <button type="button" className="password-visibility-button" onClick={() => setShowNewPassword((visible) => !visible)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}>
              {showNewPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
            </button>
          </div>
          <small>Use 8 to 16 characters.</small>
        </div>
        <div className="auth-field">
          <label htmlFor="confirmPassword">Confirm new password</label>
          <div className="password-input-wrap">
            <input id="confirmPassword" type={showConfirmation ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={16} autoComplete="new-password" required />
            <button type="button" className="password-visibility-button" onClick={() => setShowConfirmation((visible) => !visible)} aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}>
              {showConfirmation ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
            </button>
          </div>
        </div>
        <button className="auth-submit-button" type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Password'}
        </button>
      </form>
    </AuthPage>
  )
}

export default SetupPassword
