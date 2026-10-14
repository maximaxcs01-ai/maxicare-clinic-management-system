import api from './api'

export const getMyAppointments = (params) =>
  api.get('/appointments/my', { params })
export const createAppointment = (data) => api.post('/appointments', data)
export const getMyAppointment = (id) => api.get(`/appointments/${id}`)
