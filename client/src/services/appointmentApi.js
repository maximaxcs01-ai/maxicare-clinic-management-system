import api from './api'

export const getMyAppointments = (params) =>
  api.get('/appointments/my', { params })
export const createAppointment = (data) => api.post('/appointments', data)
export const getMyAppointment = (id) => api.get(`/appointments/${id}`)

export const getAppointments = (params) => api.get('/appointments', { params })
export const getDoctorAppointments = (params) =>
  api.get('/appointments/doctor/my', { params })
export const getAppointment = (id) => api.get(`/appointments/${id}`)
export const confirmAppointment = (id) =>
  api.patch(`/appointments/${id}/confirm`)
export const rejectAppointment = (id, data) =>
  api.patch(`/appointments/${id}/reject`, data)
export const cancelAppointment = (id, data) =>
  api.patch(`/appointments/${id}/cancel`, data)
export const rescheduleAppointment = (id, data) =>
  api.patch(`/appointments/${id}/reschedule`, data)
export const checkInAppointment = (id) =>
  api.patch(`/appointments/${id}/check-in`)
export const addAppointmentToQueue = (id) =>
  api.post(`/appointments/${id}/queue`)
export const saveAppointmentTriage = (id, data) =>
  api.patch(`/appointments/${id}/triage`, data)

export const getWalkInDoctor = (serviceId) =>
  api.get('/walk-ins/next-doctor', { params: { serviceId } })
export const createWalkIn = (data) => api.post('/walk-ins', data)
export const getQueue = () => api.get('/queue')
export const getMyQueue = () => api.get('/queue/my')
export const callNextQueueEntry = (doctorId) =>
  api.post(`/queue/doctors/${doctorId}/call-next`)
export const returnQueueEntry = (id) => api.patch(`/queue/${id}/return`)
export const removeQueueEntry = (id, reason) =>
  api.patch(`/queue/${id}/remove`, { reason })
export const startConsultation = (queueEntryId) =>
  api.post(`/consultations/queue/${queueEntryId}/start`)
export const getConsultations = (params) =>
  api.get('/consultations', { params })
export const getConsultation = (id) => api.get(`/consultations/${id}`)
export const saveConsultationDraft = (id, data) =>
  api.patch(`/consultations/${id}`, data)
export const completeConsultation = (id, data) =>
  api.post(`/consultations/${id}/complete`, data)
export const markNoPrescriptionNeeded = (id) =>
  api.patch(`/consultations/${id}/prescription-decision`, {
    decision: 'none_required',
  })
