import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined'
import AuthPage from '../components/AuthPage'
import api from '../services/api'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const normalizedEmail = email.trim().toLowerCase()
  const emailError =
    touched && !emailPattern.test(normalizedEmail)
      ? 'Enter a valid email address.'
      : ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    setError('')

    if (!emailPattern.test(normalizedEmail) || loading) return

    try {
      setLoading(true)
      const response = await api.post('/auth/forgot-password', {
        email: normalizedEmail,
      })
      const cooldownUntil = Date.now() + 60000
      sessionStorage.setItem('passwordResetEmail', normalizedEmail)
      sessionStorage.setItem(
        'passwordResetOtpCooldownUntil',
        String(cooldownUntil),
      )
      sessionStorage.removeItem('passwordResetToken')
      navigate('/verify-reset-otp', {
        state: { email: normalizedEmail, message: response.data.message },
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to request a password reset. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPage>
      <div className="auth-heading">
        <span className="auth-icon-badge"><LockResetOutlinedIcon /></span>
        <h1>Forgot password?</h1>
        <p className="subtitle">
          Enter your account email and we&apos;ll send you a reset code.
        </p>
      </div>

        {error && <div className="message error-message" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="reset-email">Email address *</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched(true)}
              autoComplete="email"
              className={emailError ? 'input-error' : ''}
              aria-describedby={emailError ? 'reset-email-error' : undefined}
              disabled={loading}
              required
            />
            {emailError && (
              <p id="reset-email-error" className="field-error">
                {emailError}
              </p>
            )}
          </div>

          <button className="auth-submit-button" type="submit" disabled={loading}>
            {loading ? 'Sending code...' : 'Send Code'}
          </button>
        </form>

        <p className="auth-link">
          Remember your password? <Link to="/login">Back to sign in</Link>
        </p>
    </AuthPage>
  )
}

export default ForgotPassword
