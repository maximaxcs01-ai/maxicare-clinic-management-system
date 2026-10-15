import api from './api'

export const getAccountSettings = () => api.get('/auth/account-settings')
export const updateInAppNotificationPreference = (inApp) =>
  api.patch('/auth/account-settings/notifications', { inApp })
export const changeAccountPassword = (data) =>
  api.patch('/auth/change-password', data)
export const signOutAllDevices = () => api.post('/auth/logout-all')
