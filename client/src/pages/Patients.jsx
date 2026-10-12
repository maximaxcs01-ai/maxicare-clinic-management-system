import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

function formatDate(date) {
  return new Date(date).toLocaleDateString()
}

function formatAddress(address) {
  if (typeof address === 'string') {
    return address
  }

  if (!address || typeof address !== 'object') {
    return '—'
  }

  const barangay = address.barangay
    ? /^(brgy\.?|barangay)/i.test(address.barangay)
      ? address.barangay
      : `Brgy. ${address.barangay}`
    : ''

  return [address.street, barangay, address.city, address.province]
    .filter(Boolean)
    .join(', ')
}

function Patients() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadPatients = async () => {
      try {
        const response = await api.get('/patients')

        if (active) {
          setPatients(response.data.patients)
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load patients.',
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadPatients()

    return () => {
      active = false
    }
  }, [])

  const handleDelete = async (patient) => {
    const confirmed = window.confirm(
      `Delete ${patient.firstName} ${patient.lastName}?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      await api.delete(`/patients/${patient._id}`)
      setPatients((currentPatients) =>
        currentPatients.filter((item) => item._id !== patient._id),
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Unable to delete patient.',
      )
    }
  }

  return (
    <section>
      <div className="page-heading-row">
        <h1>Patients</h1>
        <Link to="/patients/add" className="button primary-button">
          Add Patient
        </Link>
      </div>

      {error && <div className="message error-message">{error}</div>}

      <div className="content-panel">
        {loading ? (
          <p className="state-message">Loading patients...</p>
        ) : patients.length === 0 ? (
          <p className="state-message">No patients found.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Contact Number</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient._id}>
                    <td>
                      {patient.firstName} {patient.lastName}
                    </td>
                    <td>{formatDate(patient.dateOfBirth)}</td>
                    <td>{patient.gender}</td>
                    <td>{patient.contactNumber}</td>
                    <td>{patient.email}</td>
                    <td>{formatAddress(patient.address)}</td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/patients/edit/${patient._id}`}
                          className="button edit-button"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="button delete-button"
                          onClick={() => handleDelete(patient)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default Patients
