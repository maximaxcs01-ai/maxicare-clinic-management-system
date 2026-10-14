import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
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

  const { consultation, prescription } = currentRecord
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
    <Box component="section" className="patient-page patient-record-page" sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4">Consultation Record</Typography>
          <Typography color="text.secondary">
            Completed {formatDateTime(consultation.completedAt)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <StatusChip status="completed" />
          <Button
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
                  Vitals
                </Typography>
                <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2}>
                  {vitals.map(([key, value]) => (
                    <Typography key={key}>
                      <strong>{key.replaceAll(/([A-Z])/g, ' $1')}:</strong>{' '}
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
              {prescription.generalInstructions && (
                <Box>
                  <Typography fontWeight={700}>General instructions</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {prescription.generalInstructions}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}

export default PatientMedicalRecord
