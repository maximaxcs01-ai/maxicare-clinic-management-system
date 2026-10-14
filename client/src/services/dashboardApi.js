import api from './api'

export const getDashboard = () => api.get('/dashboard')
export const getReports = (params) => api.get('/reports', { params })
