import api from './api'

export const getDoctorSchedule = (doctorId) => api.get(`/doctors/${doctorId}/schedule`)
export const saveDoctorSchedule = (doctorId, data) => api.put(`/doctors/${doctorId}/schedule`, data)
export const getMyDoctor = () => api.get('/doctors/me')
export const getAvailability = (params) => api.get('/availability', { params })
