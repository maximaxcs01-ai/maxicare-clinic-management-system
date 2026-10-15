import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined'
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AuthPage from '../components/AuthPage'
import api from '../services/api'

const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  password: '',
  confirmPassword: '',
}

const namePattern = /^[\p{L}\s'-]+$/u
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mobileNumberPattern = /^09\d{9}$/

function validateField(name, value, formData) {
  const trimmedValue = typeof value === 'string' ? value.trim() : ''

  if (['firstName', 'lastName'].includes(name)) {
    if (!trimmedValue) return 'This field is required.'
    if (
      trimmedValue.length < 2 ||
      trimmedValue.length > 50 ||
      !namePattern.test(trimmedValue)
    ) {
      return 'Use 2–50 letters, spaces, hyphens, or apostrophes.'
    }
  }

  if (
    name === 'middleName' &&
    trimmedValue &&
    (trimmedValue.length < 2 ||
      trimmedValue.length > 50 ||
      !namePattern.test(trimmedValue))
  ) {
    return 'Use 2–50 letters, spaces, hyphens, or apostrophes.'
  }

  if (name === 'email') {
    if (!trimmedValue) return 'Email is required.'
    if (!emailPattern.test(trimmedValue)) return 'Enter a valid email address.'
  }

  if (name === 'mobileNumber') {
    if (!trimmedValue) return 'Mobile number is required.'
    if (!mobileNumberPattern.test(trimmedValue)) {
      return 'Use an 11-digit number starting with 09.'
    }
  }

  if (name === 'password') {
    if (!value) return 'Password is required.'
    if (value.length < 8 || value.length > 16) {
      return 'Password must be 8–16 characters.'
    }
  }

  if (name === 'confirmPassword') {
    if (!value) return 'Please confirm your password.'
    if (value !== formData.password) return 'Passwords do not match.'
  }

  return ''
}

function FieldFeedback({ message, valid }) {
  if (message) return <p className="field-error">{message}</p>
  return valid ? <p className="field-valid">Looks good.</p> : null
}

function Register() {
  const [formData, setFormData] = useState(initialForm)
  const [touched, setTouched] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const navigate = useNavigate()

  const handleChange = (event) => {
    const { name } = event.target
    const value =
      name === 'mobileNumber'
        ? event.target.value.replace(/\D/g, '').slice(0, 11)
        : event.target.value
    const nextForm = { ...formData, [name]: value }

    setFormData(nextForm)

    if (touched[name]) {
      setFieldErrors((current) => ({
        ...current,
        [name]: validateField(name, value, nextForm),
      }))
    }

    if (name === 'password' && touched.confirmPassword) {
      setFieldErrors((current) => ({
        ...current,
        confirmPassword: validateField(
          'confirmPassword',
          nextForm.confirmPassword,
          nextForm,
        ),
      }))
    }
  }

  const handleBlur = (event) => {
    const { name, value } = event.target
    setTouched((current) => ({ ...current, [name]: true }))
    setFieldErrors((current) => ({
      ...current,
      [name]: validateField(name, value, formData),
    }))
  }

  const validateForm = () => {
    const errors = Object.keys(formData).reduce((result, name) => {
      const message = validateField(name, formData[name], formData)
      return message ? { ...result, [name]: message } : result
    }, {})

    setTouched(
      Object.keys(formData).reduce(
        (result, name) => ({ ...result, [name]: true }),
        {},
      ),
    )
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const formIsValid = Object.keys(formData).every(
    (name) => !validateField(name, formData[name], formData),
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading || !validateForm()) return

    setError('')

    try {
      setLoading(true)
      const response = await api.post('/auth/register', formData)
      const email = response.data.email || formData.email.trim().toLowerCase()
      const cooldownUntil = Date.now() + 60000

      sessionStorage.setItem('pendingVerificationEmail', email)
      sessionStorage.setItem('otpCooldownUntil', String(cooldownUntil))
      navigate('/verify-email', { state: { email } })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to register. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    ['firstName', 'First Name *', 'text', 'given-name'],
    ['middleName', 'Middle Name', 'text', 'additional-name'],
    ['lastName', 'Last Name *', 'text', 'family-name'],
    ['email', 'Email *', 'email', 'email'],
    ['mobileNumber', 'Mobile Number *', 'tel', 'tel'],
  ]
  const passwordValid =
    formData.password.length >= 8 && formData.password.length <= 16
  const passwordFeedback = touched.password || formData.password
    ? passwordValid
      ? 'valid'
      : 'invalid'
    : 'neutral'

  return (
    <AuthPage wide className="auth-register-panel">
      <div className="auth-heading">
        <h1>Create your account</h1>
        <p className="subtitle">Create your patient account to book and manage clinic visits.</p>
      </div>

        {error && <div className="message error-message" role="alert">{error}</div>}

        <form className="auth-form register-form-grid" onSubmit={handleSubmit} noValidate>
          {fields.map(([name, label, type, autoComplete]) => (
            <div className={`auth-field auth-field-${name}`} key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                name={name}
                type={type}
                value={formData[name]}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete={autoComplete}
                inputMode={name === 'mobileNumber' ? 'numeric' : undefined}
                aria-invalid={Boolean(fieldErrors[name])}
                className={fieldErrors[name] ? 'input-error' : ''}
              />
              <FieldFeedback
                message={fieldErrors[name]}
                valid={Boolean(touched[name] && formData[name] && !fieldErrors[name])}
              />
            </div>
          ))}

          <div className="auth-field auth-field-password">
            <label htmlFor="password">Password *</label>
            <div className="password-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="password-requirements"
                className={fieldErrors.password ? 'input-error' : ''}
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
            <div id="password-requirements" className="password-requirements">
              <span className="password-requirements-title">Password requirements</span>
              <p className={`password-requirement password-requirement-${passwordFeedback}`}>
                {passwordFeedback === 'valid' ? (
                  <CheckCircleOutlinedIcon />
                ) : passwordFeedback === 'invalid' ? (
                  <HighlightOffOutlinedIcon />
                ) : (
                  <RadioButtonUncheckedOutlinedIcon />
                )}
                8–16 characters
              </p>
            </div>
          </div>

          <div className="auth-field auth-field-confirmPassword">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <div className="password-input-wrap">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby="confirm-password-feedback"
                className={fieldErrors.confirmPassword ? 'input-error' : ''}
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
            <p
              id="confirm-password-feedback"
              className={`password-match-feedback${formData.confirmPassword ? formData.confirmPassword === formData.password ? ' is-valid' : ' is-invalid' : ''}`}
              aria-live="polite"
            >
              {formData.confirmPassword
                ? formData.confirmPassword === formData.password
                  ? 'Passwords match.'
                  : 'Passwords do not match.'
                : ''}
            </p>
          </div>

          <button className="auth-submit-button register-submit" type="submit" disabled={loading || !formIsValid}>
            {loading ? 'Sending verification code...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
    </AuthPage>
  )
}

export default Register
