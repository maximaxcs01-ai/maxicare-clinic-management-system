import api from './api'

export const getDoctors = (params) => api.get('/doctors', { params })
export const createDoctor = (data) => api.post('/doctors', data)
export const updateDoctor = (id, data) => api.put(`/doctors/${id}`, data)
export const deleteDoctor = (id) => api.delete(`/doctors/${id}`)
export const resendDoctorInvitation = (id) => api.post(`/doctors/${id}/resend-invitation`)
