import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import ModulePlaceholder from './components/common/ModulePlaceholder'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import AuthProvider from './context/AuthProvider'
import useAuth from './hooks/useAuth'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import PatientForm from './pages/PatientForm'
import Patients from './pages/Patients'
import PatientAppointments from './pages/PatientAppointments'
import BookAppointment from './pages/BookAppointment'
import Profile from './pages/Profile'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import RoleDashboard from './pages/RoleDashboard'
import SetupAccount from './pages/SetupAccount'
import VerifyEmail from './pages/VerifyEmail'
import VerifyResetOtp from './pages/VerifyResetOtp'
import DoctorsManagement from './pages/admin/DoctorsManagement'
import ServicesManagement from './pages/admin/ServicesManagement'
import UsersManagement from './pages/admin/UsersManagement'
import DoctorSchedulePage from './pages/DoctorSchedulePage'
import ReceptionistDoctorsPage from './pages/receptionist/Doctors'
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

function LegacyPatientRoute({ action }) {
  const { user } = useAuth()
  const { id } = useParams()
  const roleHome = getRoleDestination(user?.role)
  const canManage = ['admin', 'receptionist'].includes(user?.role)

  if (action === 'add' && canManage) {
    return <Navigate to={`${roleHome}/patients/add`} replace />
  }

  if (action === 'edit' && canManage && id) {
    return <Navigate to={`${roleHome}/patients/edit/${id}`} replace />
  }

  if (['admin', 'receptionist', 'doctor'].includes(user?.role)) {
    return <Navigate to={`${roleHome}/patients`} replace />
  }

  return <Navigate to={roleHome} replace />
}

const placeholder = (title, description) => (
  <ModulePlaceholder title={title} description={description} />
)

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/setup-account" element={<SetupAccount />} />

      <Route
        element={
          <ProtectedRoute>
            <AuthenticatedLayout />
          </ProtectedRoute>
        }
      >
        <Route element={<RoleRoute allowedRoles={['patient']} />}>
          <Route path="/patient" element={<RoleDashboard />} />
          <Route
            path="/patient/appointments"
            element={<PatientAppointments />}
          />
          <Route
            path="/patient/appointments/book"
            element={<BookAppointment />}
          />
          <Route
            path="/patient/medical-history"
            element={placeholder(
              'Medical History',
              'Your medical history will be available in a later development phase.',
            )}
          />
          <Route
            path="/patient/prescriptions"
            element={placeholder(
              'Prescriptions',
              'Prescription records will be available in a later development phase.',
            )}
          />
          <Route path="/patient/profile" element={<Profile />} />
          <Route
            path="/patient/account-settings"
            element={placeholder('Account Settings')}
          />
        </Route>

        <Route element={<RoleRoute allowedRoles={['receptionist']} />}>
          <Route path="/receptionist" element={<RoleDashboard />} />
          <Route path="/receptionist/patients" element={<Patients />} />
          <Route path="/receptionist/patients/add" element={<PatientForm />} />
          <Route
            path="/receptionist/patients/edit/:id"
            element={<PatientForm />}
          />
          <Route
            path="/receptionist/appointments"
            element={placeholder('Appointments')}
          />
          <Route path="/receptionist/queue" element={placeholder('Queue')} />
          <Route
            path="/receptionist/doctors"
            element={<ReceptionistDoctorsPage />}
          />
          <Route
            path="/receptionist/doctors/:id/schedule"
            element={<DoctorSchedulePage readOnly />}
          />
          <Route path="/receptionist/profile" element={<Profile />} />
          <Route
            path="/receptionist/account-settings"
            element={placeholder('Account Settings')}
          />
        </Route>

        <Route element={<RoleRoute allowedRoles={['doctor']} />}>
          <Route path="/doctor" element={<RoleDashboard />} />
          <Route path="/doctor/schedule" element={<DoctorSchedulePage />} />
          <Route path="/doctor/patients" element={<Patients />} />
          <Route
            path="/doctor/consultations"
            element={placeholder('Consultations')}
          />
          <Route
            path="/doctor/prescriptions"
            element={placeholder('Prescriptions')}
          />
          <Route path="/doctor/profile" element={<Profile />} />
          <Route
            path="/doctor/account-settings"
            element={placeholder('Account Settings')}
          />
        </Route>

        <Route element={<RoleRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<RoleDashboard />} />
          <Route path="/admin/patients" element={<Patients />} />
          <Route path="/admin/patients/add" element={<PatientForm />} />
          <Route path="/admin/patients/edit/:id" element={<PatientForm />} />
          <Route path="/admin/doctors" element={<DoctorsManagement />} />
          <Route
            path="/admin/doctors/:id/schedule"
            element={<DoctorSchedulePage />}
          />
          <Route
            path="/admin/appointments"
            element={placeholder('Appointments')}
          />
          <Route path="/admin/services" element={<ServicesManagement />} />
          <Route path="/admin/users" element={<UsersManagement />} />
          <Route path="/admin/reports" element={placeholder('Reports')} />
          <Route path="/admin/profile" element={<Profile />} />
          <Route
            path="/admin/account-settings"
            element={placeholder('Account Settings')}
          />
        </Route>

        <Route path="/dashboard" element={<DefaultRoute />} />
        <Route path="/patients" element={<LegacyPatientRoute />} />
        <Route
          path="/patients/add"
          element={<LegacyPatientRoute action="add" />}
        />
        <Route
          path="/patients/edit/:id"
          element={<LegacyPatientRoute action="edit" />}
        />
      </Route>

      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
