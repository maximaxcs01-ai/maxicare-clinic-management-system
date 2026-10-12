import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import api from '../services/api'

function ResetPassword() {
  const email = sessionStorage.getItem('passwordResetEmail') || ''
  const resetToken = sessionStorage.getItem('passwordResetToken') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
      <main className="page-shell">
        <section className="auth-card">
          <h1>Reset password</h1>
          <div className="message error-message">
            Your password reset authorization is unavailable or expired.
          </div>
          <p className="auth-link">
            <Link to="/forgot-password">Request a new code</Link>
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <section className="auth-card">
        <h1>Reset password</h1>
        <p className="subtitle">Choose a new password for your account.</p>

        {error && <div className="message error-message">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="new-password">New Password *</label>
            <input
              id="new-password"
              type="password"
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
            {passwordError && <p className="field-error">{passwordError}</p>}
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-new-password">Confirm Password *</label>
            <input
              id="confirm-new-password"
              type="password"
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
            {confirmError && <p className="field-error">{confirmError}</p>}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Saving password...' : 'Save New Password'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default ResetPassword
