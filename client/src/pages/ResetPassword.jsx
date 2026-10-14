import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AuthPage from '../components/AuthPage'
import useAuth from '../hooks/useAuth'
import api from '../services/api'

function ResetPassword() {
  const email = sessionStorage.getItem('passwordResetEmail') || ''
  const resetToken = sessionStorage.getItem('passwordResetToken') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()

  const passwordError =
    touched.password && (newPassword.length < 8 || newPassword.length > 16)
      ? 'Password must be 8 to 16 characters.'
      : ''
  const confirmError =
    touched.confirm && confirmPassword !== newPassword
      ? 'Passwords do not match.'
      : ''

  const clearResetSession = () => {
    sessionStorage.removeItem('passwordResetEmail')
    sessionStorage.removeItem('passwordResetToken')
    sessionStorage.removeItem('passwordResetOtpCooldownUntil')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched({ password: true, confirm: true })
    setError('')

    if (
      newPassword.length < 8 ||
      newPassword.length > 16 ||
      newPassword !== confirmPassword ||
      loading
    ) {
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/auth/reset-password', {
        email,
        resetToken,
        newPassword,
        confirmPassword,
      })
      clearResetSession()
      logout()
      navigate('/login', {
        replace: true,
        state: { message: response.data.message },
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to reset your password. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (!email || !resetToken) {
    return (
      <AuthPage>
          <div className="auth-heading">
            <span className="auth-icon-badge"><LockResetOutlinedIcon /></span>
            <h1>Reset password</h1>
          </div>
          <div className="message error-message">
            Your password reset authorization is unavailable or expired.
          </div>
          <p className="auth-link">
            <Link to="/forgot-password">Request a new code</Link>
          </p>
      </AuthPage>
    )
  }

  return (
    <AuthPage>
        <div className="auth-heading">
          <span className="auth-icon-badge"><LockResetOutlinedIcon /></span>
          <h1>Create a new password</h1>
          <p className="subtitle">Choose a secure password for your account.</p>
        </div>

        {error && <div className="message error-message" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="new-password">New Password *</label>
            <div className="password-input-wrap">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                onBlur={() =>
                  setTouched((current) => ({ ...current, password: true }))
                }
                autoComplete="new-password"
                className={passwordError ? 'input-error' : ''}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="password-visibility-button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
              </button>
            </div>
            {passwordError && <p className="field-error">{passwordError}</p>}
            <p className="auth-hint">Use 8–16 characters.</p>
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-new-password">Confirm Password *</label>
            <div className="password-input-wrap">
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={() =>
                  setTouched((current) => ({ ...current, confirm: true }))
                }
                autoComplete="new-password"
                className={confirmError ? 'input-error' : ''}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="password-visibility-button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
              </button>
            </div>
            {confirmError && <p className="field-error">{confirmError}</p>}
          </div>

          <button className="auth-submit-button" type="submit" disabled={loading}>
            {loading ? 'Saving password...' : 'Save New Password'}
          </button>
        </form>
    </AuthPage>
  )
}

export default ResetPassword
