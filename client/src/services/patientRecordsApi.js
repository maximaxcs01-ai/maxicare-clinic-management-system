import api from './api'

export const getOwnMedicalHistory = () => api.get('/records/me')
export const getOwnCompletedConsultation = (consultationId) =>
  api.get(`/records/me/consultations/${consultationId}`)
export const getDoctorPatients = (params) =>
  api.get('/records/patients', { params })
export const getDoctorPatientRecord = (patientId) =>
  api.get(`/records/patients/${patientId}`)
