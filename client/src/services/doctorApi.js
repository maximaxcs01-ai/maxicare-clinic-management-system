import api from './api'

export const getDoctors = (params) => api.get('/doctors', { params })
export const getMyDoctor = () => api.get('/doctors/me')
export const updateMyProfileImage = (file) => {
  const formData = new FormData()
  formData.append('profileImage', file)
  return api.patch('/doctors/me/profile-image', formData)
}
export const createDoctor = (data) => api.post('/doctors', data)
export const updateDoctor = (id, data) => api.put(`/doctors/${id}`, data)
export const deleteDoctor = (id) => api.delete(`/doctors/${id}`)
export const resendDoctorInvitation = (id) => api.post(`/doctors/${id}/resend-invitation`)
