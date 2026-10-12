import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

function FieldError({ message }) {
  return message ? <p className="field-error">{message}</p> : null
}

function Register() {
  const [formData, setFormData] = useState(initialForm)
  const [touched, setTouched] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    ['password', 'Password *', 'password', 'new-password'],
    ['confirmPassword', 'Confirm Password *', 'password', 'new-password'],
  ]

  return (
    <main className="page-shell">
      <section className="auth-card register-card">
        <h1>Create an Account</h1>
        <p className="subtitle">Register as a clinic patient</p>

        {error && <div className="message error-message">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {fields.map(([name, label, type, autoComplete]) => (
            <div className="auth-field" key={name}>
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
              <FieldError message={fieldErrors[name]} />
            </div>
          ))}

          <button type="submit" disabled={loading}>
            {loading ? 'Sending verification code...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  )
}

export default Register
