import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthProvider from './context/AuthProvider'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import PatientForm from './pages/PatientForm'
import Patients from './pages/Patients'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import VerifyResetOtp from './pages/VerifyResetOtp'
import ResetPassword from './pages/ResetPassword'
import useAuth from './hooks/useAuth'
import { getRoleDestination } from './utils/authRoutes'
import './App.css'

function DefaultRoute() {
  const { token, user, loading } = useAuth()

  if (loading) {
    return <p className="state-message">Checking your session...</p>
  }

  return (
    <Navigate
      to={token ? getRoleDestination(user?.role) : '/login'}
      replace
    />
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            element={
              <ProtectedRoute>
                <AuthenticatedLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patient" element={<Dashboard />} />
            <Route path="/receptionist" element={<Dashboard />} />
            <Route path="/doctor" element={<Dashboard />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/add" element={<PatientForm />} />
            <Route path="/patients/edit/:id" element={<PatientForm />} />
          </Route>
          <Route path="*" element={<DefaultRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
