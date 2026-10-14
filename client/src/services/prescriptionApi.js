import api from './api'

export const getPrescriptions = (params) =>
  api.get('/prescriptions', { params })
export const createPrescription = (consultationId) =>
  api.post(`/prescriptions/consultation/${consultationId}`)
export const getPrescriptionForConsultation = (consultationId) =>
  api.get(`/prescriptions/consultation/${consultationId}`)
export const getPrescription = (id) => api.get(`/prescriptions/${id}`)
export const savePrescriptionDraft = (id, data) =>
  api.patch(`/prescriptions/${id}`, data)
export const issuePrescription = (id, data) =>
  api.post(`/prescriptions/${id}/issue`, data)
