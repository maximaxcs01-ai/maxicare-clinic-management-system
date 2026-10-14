import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'
import AuthPage from '../components/AuthPage'
import OtpInput from '../components/OtpInput'
import api from '../services/api'

const OTP_LENGTH = 6

function maskEmail(email) {
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return email
  return `${localPart.slice(0, 1)}${'*'.repeat(
    Math.max(3, localPart.length - 1),
  )}@${domain}`
}

function getInitialCooldown() {
  const cooldownUntil = Number(
    sessionStorage.getItem('passwordResetOtpCooldownUntil'),
  )
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
}

function VerifyResetOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const email =
    location.state?.email || sessionStorage.getItem('passwordResetEmail') || ''
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(getInitialCooldown)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return undefined

    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [countdown])

  const handleVerify = async (event) => {
    event.preventDefault()
    const otp = digits.join('')
    setError('')

    if (otp.length !== OTP_LENGTH) {
      setError('Enter the complete six-digit verification code.')
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/auth/verify-reset-otp', { email, otp })
      sessionStorage.setItem('passwordResetToken', response.data.resetToken)
      navigate('/reset-password', { replace: true })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to verify the code. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || resending) return

    try {
      setResending(true)
      setError('')
      const response = await api.post('/auth/resend-reset-otp', { email })
      const cooldownUntil = Date.now() + 60000
      sessionStorage.setItem(
        'passwordResetOtpCooldownUntil',
        String(cooldownUntil),
      )
      sessionStorage.removeItem('passwordResetToken')
      setCountdown(60)
      setDigits(Array(OTP_LENGTH).fill(''))
      setMessage(response.data.message)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to resend the code. Please try again.',
      )
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return (
      <AuthPage>
        <div className="auth-heading">
          <span className="auth-icon-badge"><MarkEmailReadOutlinedIcon /></span>
          <h1>Verify reset code</h1>
        </div>
          <div className="message error-message">
            Your password reset session is unavailable. Request a new code.
          </div>
          <p className="auth-link">
            <Link to="/forgot-password">Request a reset code</Link>
          </p>
      </AuthPage>
    )
  }

  return (
    <AuthPage className="auth-verify-panel">
        <div className="auth-heading">
          <span className="auth-icon-badge"><MarkEmailReadOutlinedIcon /></span>
          <h1>Verify your identity</h1>
          <p className="subtitle">
            Enter the six-digit code sent to <strong>{maskEmail(email)}</strong>.
          </p>
        </div>

        {error && <div className="message error-message" role="alert">{error}</div>}
        {message && <div className="message success-message" role="status">{message}</div>}

        <form onSubmit={handleVerify}>
          <p className="otp-instruction">Your code is valid for a limited time.</p>
          <OtpInput
            digits={digits}
            onChange={setDigits}
            disabled={loading || resending}
            label="Password reset digit"
          />

          <button className="auth-submit-button" type="submit" disabled={loading || resending}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button
            type="button"
            className="resend-button"
            onClick={handleResend}
            disabled={countdown > 0 || loading || resending}
          >
            {countdown > 0
              ? `Resend code in 00:${String(countdown).padStart(2, '0')}`
              : resending
                ? 'Sending new code...'
                : 'Resend code'}
          </button>
        </form>
    </AuthPage>
  )
}

export default VerifyResetOtp
