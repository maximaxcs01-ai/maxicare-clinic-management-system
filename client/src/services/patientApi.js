import api from './api'

export const getPatients = (params) => api.get('/patients', { params })
export const searchWalkInPatients = (params) =>
  api.get('/patients/walk-in-search', { params })
export const deletePatient = (id) => api.delete(`/patients/${id}`)
export const getOwnPatient = () => api.get('/patients/me')
export const updateOwnPatient = (data) => api.put('/patients/me', data)
export const activatePatientPortal = (id) =>
  api.post(`/patients/${id}/portal-activation`)
export const resendPatientActivation = (id) =>
  api.post(`/patients/${id}/resend-activation-invitation`)
