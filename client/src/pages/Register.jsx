import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
}

function Register() {
  const [formData, setFormData] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const hasEmptyField = Object.values(formData).some(
      (value) => !value.trim(),
    )

    if (hasEmptyField) {
      setError('Please fill in all fields')
      return
    }

    try {
      setLoading(true)
      const response = await api.post('/auth/register', formData)
      setSuccess(response.data.message || 'Registration successful')
      setFormData(initialForm)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to register. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="auth-card">
        <h1>Create an Account</h1>
        <p className="subtitle">Register as a clinic patient</p>

        {error && <div className="message error-message">{error}</div>}
        {success && (
          <div className="message success-message">
            {success}. You can now <Link to="/login">log in</Link>.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
            autoComplete="given-name"
            required
          />

          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            autoComplete="family-name"
            required
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            minLength="6"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
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
