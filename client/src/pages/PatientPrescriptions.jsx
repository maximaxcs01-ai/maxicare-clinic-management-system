import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined'
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { getOwnMedicalHistory } from '../services/patientRecordsApi'

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getOwnMedicalHistory()
      .then((response) => {
        if (active) setPrescriptions(response.data.data?.prescriptions || [])
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load your prescriptions.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <Box component="section" className="patient-page patient-prescriptions-page">
      <Box className="patient-page-heading">
        <Typography component="h1" variant="h4">Prescriptions</Typography>
        <Typography color="text.secondary">
          Review prescriptions issued during your completed consultations.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : prescriptions.length === 0 ? (
        <Paper className="patient-empty-state">
          <MedicationOutlinedIcon color="primary" />
          <Typography variant="h6">No issued prescriptions</Typography>
          <Typography color="text.secondary">
            Prescriptions issued by your doctor will appear here.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {prescriptions.map((prescription) => {
            const doctor = prescription.doctorId
            const service = prescription.serviceId || prescription.appointmentId?.serviceId
            const consultation =
              prescription.consultationId &&
              typeof prescription.consultationId === 'object'
                ? prescription.consultationId
                : null
            return (
              <Paper key={prescription._id} className="prescription-card">
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                >
                  <Box>
                    <Typography variant="h6">Issued Prescription</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {doctor
                        ? `Dr. ${doctor.firstName} ${doctor.lastName}`
                        : 'Prescribing doctor'}
                      {service?.name ? ` · ${service.name}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {prescription.issuedAt
                      ? formatDate(prescription.issuedAt)
                      : 'Issue date unavailable'}
                  </Typography>
                </Stack>
                <Divider />
                <Box sx={{ py: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    Consultation Summary
                  </Typography>
                  <Stack spacing={1}>
                    {[
                      ['Diagnosis', consultation?.diagnosis],
                      ['Treatment plan', consultation?.treatmentPlan],
                      ['Patient instructions', consultation?.instructions],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography variant="body2" fontWeight={700}>
                          {label}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                          {value?.trim() || 'Not yet provided'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Stack spacing={1.25}>
                  {(prescription.medications || []).map((medication, index) => (
                    <Box key={medication._id || `${prescription._id}-${index}`} className="medication-row">
                      <Typography fontWeight={700}>{medication.medicationName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[medication.dosage, medication.frequency, medication.route, medication.duration]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                      {medication.quantity != null && (
                        <Typography variant="body2">Quantity: {medication.quantity}</Typography>
                      )}
                      {medication.instructions && (
                        <Typography variant="body2">{medication.instructions}</Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
                {!consultation?.instructions &&
                  prescription.generalInstructions && (
                  <Box className="prescription-instructions">
                    <Typography variant="caption" color="text.secondary">
                      Legacy prescription instructions
                    </Typography>
                    <Typography variant="body2">{prescription.generalInstructions}</Typography>
                  </Box>
                  )}
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

export default PatientPrescriptions
