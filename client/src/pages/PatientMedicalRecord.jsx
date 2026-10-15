import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import { getOwnCompletedConsultation } from '../services/patientRecordsApi'

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const formatPatientName = (patient) =>
  [patient?.firstName, patient?.middleName, patient?.lastName, patient?.suffix]
    .filter(Boolean)
    .join(' ')

const vitalLabels = {
  systolic: 'Systolic blood pressure',
  diastolic: 'Diastolic blood pressure',
  temperature: 'Temperature (°C)',
  pulse: 'Pulse (bpm)',
  respiratoryRate: 'Respiratory rate',
  oxygenSaturation: 'Oxygen saturation (%)',
  weight: 'Weight (kg)',
  height: 'Height (cm)',
}

function PatientMedicalRecord() {
  const { consultationId } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getOwnCompletedConsultation(consultationId)
      .then((response) => {
        if (active) {
          setRecord({
            id: consultationId,
            data: response.data.data,
          })
        }
      })
      .catch((requestError) => {
        if (active) {
          setError({
            id: consultationId,
            message:
              requestError.response?.data?.message ||
              'Unable to load this medical record.',
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [consultationId])

  const currentRecord =
    record?.id === consultationId ? record.data : null
  const currentError = error?.id === consultationId ? error.message : ''

  if (loading || (!currentRecord && !currentError)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (currentError || !currentRecord) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          {currentError || 'Medical record not found.'}
        </Alert>
        <Button
          onClick={() => navigate('/patient/medical-history')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Medical History
        </Button>
      </Stack>
    )
  }

  const { patient, consultation, prescription } = currentRecord
  const details = [
    ['Chief complaint', consultation.chiefComplaint],
    ['Symptoms', consultation.symptoms],
    ['Diagnosis', consultation.diagnosis],
    ['Treatment plan', consultation.treatmentPlan],
    ['Patient instructions', consultation.instructions],
  ]
  const vitals = Object.entries(consultation.vitals || {}).filter(
    ([, value]) => value !== null && value !== undefined,
  )

  return (
    <Box component="section" className="patient-page patient-record-page visit-summary" sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="overline" color="primary" fontWeight={700}>
            Maxicare Clinic
          </Typography>
          <Typography variant="h4">Visit Summary</Typography>
          <Stack direction="row" alignItems="center" spacing={0.75} color="success.main">
            <CheckCircleOutlinedIcon fontSize="small" />
            <Typography fontWeight={700}>Consultation Completed</Typography>
          </Stack>
          <Typography color="text.secondary" variant="body2">
            Completed on {formatDateTime(consultation.completedAt)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <StatusChip status="completed" />
          <Button
            className="visit-summary-print"
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => window.print()}
          >
            Print Summary
          </Button>
          <Button
            className="visit-summary-back"
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={() => navigate('/patient/medical-history')}
          >
            Medical History
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2.5}>
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Patient
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            <Typography>
              <strong>Name:</strong> {formatPatientName(patient) || '—'}
            </Typography>
            <Typography>
              <strong>Patient number:</strong> {patient?.patientNumber || '—'}
            </Typography>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Visit
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            <Typography>
              <strong>Service:</strong> {consultation.serviceId?.name || '—'}
            </Typography>
            <Typography>
              <strong>Doctor:</strong>{' '}
              {consultation.doctorId
                ? `Dr. ${consultation.doctorId.firstName} ${consultation.doctorId.lastName}`
                : '—'}
            </Typography>
            {consultation.doctorId?.specialization && (
              <Typography>
                <strong>Specialization:</strong>{' '}
                {consultation.doctorId.specialization}
              </Typography>
            )}
            <Typography>
              <strong>Visit date:</strong>{' '}
              {formatDateTime(consultation.appointmentId?.startAt || consultation.completedAt)}
            </Typography>
            <Typography>
              <strong>Appointment type:</strong>{' '}
              {consultation.appointmentId?.bookingType === 'walk_in'
                ? 'Walk-In'
                : 'Scheduled'}
            </Typography>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Consultation
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            {details.map(([label, value]) => (
              <Box key={label}>
                <Typography fontWeight={700}>{label}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                  {value || 'Not recorded'}
                </Typography>
              </Box>
            ))}
            {vitals.length > 0 && (
              <Box>
                <Typography fontWeight={700} sx={{ mb: 1 }}>
                  Triage vitals
                </Typography>
                <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2}>
                  {vitals.map(([key, value]) => (
                    <Typography key={key}>
                      <strong>{vitalLabels[key] || key}:</strong>{' '}
                      {value}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>

        {prescription && (
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">Issued Prescription</Typography>
              <StatusChip status={prescription.status} />
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              <Typography color="text.secondary">
                Issued {formatDateTime(prescription.issuedAt)}
              </Typography>
              {prescription.medications.map((medication, index) => (
                <Paper key={medication._id || index} variant="outlined" sx={{ p: 2 }}>
                  <Typography fontWeight={700}>
                    {medication.medicationName}
                  </Typography>
                  <Typography>
                    {medication.dosage} · {medication.frequency} ·{' '}
                    {medication.duration}
                  </Typography>
                  {medication.route && (
                    <Typography>Route: {medication.route}</Typography>
                  )}
                  {medication.quantity && (
                    <Typography>Quantity: {medication.quantity}</Typography>
                  )}
                  {medication.instructions && (
                    <Typography sx={{ mt: 1 }}>
                      {medication.instructions}
                    </Typography>
                  )}
                </Paper>
              ))}
              {!consultation.instructions &&
                prescription.generalInstructions && (
                  <Box>
                    <Typography fontWeight={700}>
                      Legacy prescription instructions
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {prescription.generalInstructions}
                    </Typography>
                  </Box>
                )}
            </Stack>
          </Paper>
        )}
        {!prescription && consultation.prescriptionDecision === 'none_required' && (
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Prescription
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Alert severity="info">No prescription was needed for this visit.</Alert>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}

export default PatientMedicalRecord
