import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  const cooldownUntil = Number(sessionStorage.getItem('otpCooldownUntil'))
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
}

function VerifyEmail() {
  const location = useLocation()
  const email =
    location.state?.email ||
    sessionStorage.getItem('pendingVerificationEmail') ||
    ''
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [countdown, setCountdown] = useState(getInitialCooldown)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [verified, setVerified] = useState(false)

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

    if (otp.length !== OTP_LENGTH) {
      setError('Enter the complete six-digit verification code.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setMessage('')
      const response = await api.post('/auth/verify-email', { email, otp })
      setVerified(true)
      setMessage(response.data.message || 'Email verified successfully.')
      sessionStorage.removeItem('pendingVerificationEmail')
      sessionStorage.removeItem('otpCooldownUntil')
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
      const response = await api.post('/auth/resend-otp', { email })
      const cooldownUntil = Date.now() + 60000
      sessionStorage.setItem('otpCooldownUntil', String(cooldownUntil))
      setCountdown(60)
      setDigits(Array(OTP_LENGTH).fill(''))
      setMessage(response.data.message || 'A new code has been sent.')
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
          <h1>Verify your email</h1>
        </div>
          <div className="message error-message">
            Your verification session is unavailable. Register again to receive
            a new code.
          </div>
          <p className="auth-link">
            <Link to="/register">Return to registration</Link>
          </p>
      </AuthPage>
    )
  }

  return (
    <AuthPage className="auth-verify-panel">
        <div className="auth-heading">
          <span className="auth-icon-badge"><MarkEmailReadOutlinedIcon /></span>
          <h1>Verify your email</h1>
          <p className="subtitle">
            Enter the six-digit code we sent to <strong>{maskEmail(email)}</strong>.
          </p>
        </div>

        {error && <div className="message error-message" role="alert">{error}</div>}
        {message && <div className="message success-message" role="status">{message}</div>}

        {verified ? (
          <p className="auth-link">
            Verification is complete. <Link to="/login">Proceed to Login</Link>
          </p>
        ) : (
          <form onSubmit={handleVerify}>
            <p className="otp-instruction">Your code is valid for a limited time.</p>
            <OtpInput
              digits={digits}
              onChange={setDigits}
              disabled={loading}
            />

            <button className="auth-submit-button" type="submit" disabled={loading || resending}>
              {loading ? 'Verifying...' : 'Verify Email'}
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
        )}
    </AuthPage>
  )
}

export default VerifyEmail
