import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  storeSession,
} from '../utils/authStorage'
import AuthContext from './authContext'

function AuthProvider({ children }) {
  const initialToken = getStoredToken()
  const [token, setToken] = useState(initialToken)
  const [user, setUser] = useState(getStoredUser)
  const [loading, setLoading] = useState(Boolean(initialToken))

  const logout = useCallback(() => {
    clearSession()
    setToken(null)
    setUser(null)
    setLoading(false)
  }, [])

  const login = useCallback((nextToken, nextUser) => {
    storeSession(nextToken, nextUser)
    setToken(nextToken)
    setUser(nextUser)
    setLoading(true)
  }, [])

  const updateUser = useCallback(
    (updates) => {
      setUser((currentUser) => {
        if (!currentUser) return currentUser
        const nextUser = { ...currentUser, ...updates }
        if (token) storeSession(token, nextUser)
        return nextUser
      })
    },
    [token],
  )

  useEffect(() => {
    window.addEventListener('auth:logout', logout)
    return () => window.removeEventListener('auth:logout', logout)
  }, [logout])

  useEffect(() => {
    if (!token) return undefined

    let active = true

    const validateSession = async () => {
      try {
        const response = await api.get('/auth/me')
        if (!active) return

        let currentUser = response.data.user
        if (currentUser.role === 'doctor') {
          try {
            const doctorResponse = await api.get('/doctors/me')
            currentUser = {
              ...currentUser,
              profileImage: doctorResponse.data.data?.profileImage,
            }
          } catch (doctorRequestError) {
            const status = doctorRequestError.response?.status
            if (status === 401 || status === 403) throw doctorRequestError
          }
        }

        if (!active) return
        storeSession(token, currentUser)
        setUser(currentUser)
      } catch (requestError) {
        const status = requestError.response?.status
        if (active && (status === 401 || status === 403)) logout()
      } finally {
        if (active) setLoading(false)
      }
    }

    validateSession()
    return () => {
      active = false
    }
  }, [logout, token])

  const value = useMemo(
    () => ({ token, user, loading, login, logout, updateUser }),
    [token, user, loading, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
