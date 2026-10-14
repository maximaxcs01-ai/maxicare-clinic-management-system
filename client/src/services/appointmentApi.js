import api from './api'

export const getMyAppointments = (params) =>
  api.get('/appointments/my', { params })
export const createAppointment = (data) => api.post('/appointments', data)
export const getMyAppointment = (id) => api.get(`/appointments/${id}`)

export const getAppointments = (params) => api.get('/appointments', { params })
export const getAppointment = (id) => api.get(`/appointments/${id}`)
export const confirmAppointment = (id) =>
  api.patch(`/appointments/${id}/confirm`)
export const rejectAppointment = (id, data) =>
  api.patch(`/appointments/${id}/reject`, data)
export const cancelAppointment = (id, data) =>
  api.patch(`/appointments/${id}/cancel`, data)
export const rescheduleAppointment = (id, data) =>
  api.patch(`/appointments/${id}/reschedule`, data)
