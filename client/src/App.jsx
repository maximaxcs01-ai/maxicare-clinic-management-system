import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import PatientForm from './pages/PatientForm'
import Patients from './pages/Patients'
import Register from './pages/Register'
import './App.css'

function DefaultRoute() {
  const token = localStorage.getItem('token')

  return <Navigate to={token ? '/dashboard' : '/login'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/add" element={<PatientForm />} />
          <Route path="/patients/edit/:id" element={<PatientForm />} />
        </Route>
        <Route path="*" element={<DefaultRoute />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
