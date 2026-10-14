import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AuthPage from '../components/AuthPage'
import api from '../services/api'
import useAuth from '../hooks/useAuth'
import { takeAuthMessage } from '../utils/authStorage'
import { getRoleDestination } from '../utils/authRoutes'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(takeAuthMessage)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please provide email and password')
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/auth/login', {
        email,
        password,
      })

      login(response.data.token, response.data.user)

      navigate(getRoleDestination(response.data.user?.role))
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to log in. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPage>
      <div className="auth-heading">
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to your Maxicare Clinic account.</p>
      </div>

        {error && <div className="message error-message" role="alert">{error}</div>}
        {location.state?.message && (
          <div className="message success-message" role="status">
            {location.state.message}
          </div>
        )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
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
        </div>

        <div className="auth-login-options">
          <label className="auth-checkbox">
            <input type="checkbox" name="remember" defaultChecked />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button className="auth-submit-button" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-divider"><span>New to Maxicare Clinic?</span></div>
      <Link className="auth-secondary-button" to="/register">Create an Account</Link>
    </AuthPage>
  )
}

export default Login
