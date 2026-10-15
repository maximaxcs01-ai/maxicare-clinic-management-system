import api from './api'

export const getNotifications = (limit = 15) =>
  api.get('/notifications', { params: { limit } })
export const getUnreadNotificationCount = () =>
  api.get('/notifications/unread-count')
export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}/read`)
export const markAllNotificationsRead = () =>
  api.patch('/notifications/read-all')
