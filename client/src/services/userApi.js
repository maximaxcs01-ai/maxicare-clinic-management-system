import api from './api'

export const getUsers = (params) => api.get('/users', { params })
export const createUser = (data) => api.post('/users', data)
export const reissueTemporaryPassword = (id) => api.post(`/users/${id}/reissue-temporary-password`)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const updateUserStatus = (id, status) => api.patch(`/users/${id}/status`, { status })
export const updateUserRole = (id, role) => api.patch(`/users/${id}/role`, { role })
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const updateOwnProfileImage = (file) => {
  const formData = new FormData()
  formData.append('profileImage', file)
  return api.patch('/users/me/profile-image', formData)
}
