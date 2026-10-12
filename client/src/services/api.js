import axios from 'axios'
import { clearSession, setAuthMessage } from '../utils/authStorage'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || ''
    const authorization =
      error.config?.headers?.Authorization ||
      error.config?.headers?.get?.('Authorization')
    const inactive = status === 403 && message === 'Your account is inactive'

    if (authorization && (status === 401 || inactive)) {
      clearSession()
      setAuthMessage(
        inactive
          ? 'Your account is inactive.'
          : 'Your session has expired. Please log in again.',
      )
      window.dispatchEvent(new Event('auth:logout'))
    }

    return Promise.reject(error)
  },
)

export default api
