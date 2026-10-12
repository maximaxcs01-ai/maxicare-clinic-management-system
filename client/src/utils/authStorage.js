const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const AUTH_MESSAGE_KEY = 'authMessage'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function setAuthMessage(message) {
  sessionStorage.setItem(AUTH_MESSAGE_KEY, message)
}

export function takeAuthMessage() {
  const message = sessionStorage.getItem(AUTH_MESSAGE_KEY) || ''
  sessionStorage.removeItem(AUTH_MESSAGE_KEY)
  return message
}
