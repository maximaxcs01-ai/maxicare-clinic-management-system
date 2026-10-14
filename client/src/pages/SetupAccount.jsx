import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'

function SetupAccount() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [emailLabel, setEmailLabel] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(() => Boolean(token))
  const [error, setError] = useState(() =>
    token ? '' : 'This account setup link is invalid or has expired.',
  )
  const [touched, setTouched] = useState({ password: false, confirm: false })

  useEffect(() => {
    if (!token) {
      return
    }

    let active = true

    const validateToken = async () => {
      try {
        const response = await api.get('/auth/account-setup/validate', {
          params: { token },
        })

        if (!active) return

        setEmailLabel(response.data.email || '')
        setError('')
      } catch (requestError) {
        if (!active) return
        setError(
          requestError.response?.data?.message ||
            'This account setup link is invalid or has expired.',
        )
      } finally {
        if (active) setValidating(false)
      }
    }

    validateToken()

    return () => {
      active = false
    }
  }, [token])

  const passwordError = useMemo(
    () =>
      touched.password && (newPassword.length < 8 || newPassword.length > 16)
        ? 'Password must be 8 to 16 characters.'
        : '',
    [newPassword, touched.password],
  )

  const confirmError = useMemo(
    () =>
      touched.confirm && confirmPassword !== newPassword
        ? 'Passwords do not match.'
        : '',
    [confirmPassword, newPassword, touched.confirm],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched({ password: true, confirm: true })
    setError('')

    if (
      !token ||
      newPassword.length < 8 ||
      newPassword.length > 16 ||
      newPassword !== confirmPassword ||
      loading
    ) {
      return
    }

    try {
      setLoading(true)
      await api.post('/auth/account-setup', {
        token,
        newPassword,
        confirmPassword,
      })

      navigate('/login', {
        replace: true,
        state: { message: 'Password set successfully. You can now log in.' },
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to complete your account setup. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <main className="page-shell">
        <section className="auth-card">
          <h1>Account setup</h1>
          <p className="subtitle">Verifying your invitation link...</p>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page-shell">
        <section className="auth-card">
          <h1>Account setup</h1>
          <div className="message error-message">{error}</div>
          <p className="auth-link">
            <Link to="/login">Return to login</Link>
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <section className="auth-card">
        <h1>Set up your account</h1>
        <p className="subtitle">
          Create a password for {emailLabel || 'your clinic account'}.
        </p>

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
            {loading ? 'Setting up account...' : 'Create Password'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default SetupAccount
