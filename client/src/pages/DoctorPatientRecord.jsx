import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
import {
  Alert,
  Avatar,
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
import { getDoctorPatientRecord } from '../services/patientRecordsApi'

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1
  }
  return age
}

function DoctorPatientRecord() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getDoctorPatientRecord(patientId)
      .then((response) => {
        if (active) {
          setRecord({
            id: patientId,
            data: response.data.data,
          })
        }
      })
      .catch((requestError) => {
        if (active) {
          setError({
            id: patientId,
            message:
              requestError.response?.data?.message ||
              'Unable to load this patient record.',
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [patientId])

  const currentRecord = record?.id === patientId ? record.data : null
  const currentError = error?.id === patientId ? error.message : ''

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
          {currentError || 'Patient record not found.'}
        </Alert>
        <Button
          onClick={() => navigate('/doctor/patients')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Patients
        </Button>
      </Stack>
    )
  }

  const { patient, consultations, prescriptions } = currentRecord
  const patientAge = getAge(patient.dateOfBirth)
  const prescriptionsByConsultation = new Map(
    prescriptions.map((prescription) => [
      String(prescription.consultationId?._id || prescription.consultationId),
      prescription,
    ]),
  )

  return (
    <Box component="section" className="doctor-page doctor-patient-record" sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        className="doctor-page-header"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          mb: 3,
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
        }}
      >
        <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
          <Avatar className="doctor-record-avatar">
            {patient.firstName?.[0]}
            {patient.lastName?.[0]}
          </Avatar>
          <Box>
            <Typography variant="h4">
              {patient.firstName} {patient.middleName} {patient.lastName}
            </Typography>
            <Typography color="text.secondary">
              Patient {patient.patientNumber || 'record'} ·{' '}
              {patientAge === null ? 'Age not recorded' : `${patientAge} years`} ·{' '}
              {patient.sex || patient.gender || 'Sex not recorded'}
            </Typography>
          </Box>
        </Stack>
        <Button
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/doctor/patients')}
        >
          Patients
        </Button>
      </Stack>

      <Stack spacing={2.5}>
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Demographics
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            <Typography>
              <strong>Patient Number:</strong> {patient.patientNumber || '—'}
            </Typography>
            <Typography>
              <strong>Date of Birth:</strong>{' '}
              {patient.dateOfBirth
                ? new Intl.DateTimeFormat('en-PH', {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Manila',
                  }).format(new Date(patient.dateOfBirth))
                : '—'}
            </Typography>
            <Typography>
              <strong>Sex:</strong> {patient.sex || patient.gender || '—'}
            </Typography>
            <Typography>
              <strong>Mobile:</strong>{' '}
              {patient.mobileNumber || patient.contactNumber || '—'}
            </Typography>
            <Typography>
              <strong>Email:</strong> {patient.email || '—'}
            </Typography>
          </Box>
        </Paper>

        <Box>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Completed Clinical History
          </Typography>
          {consultations.length ? (
            <Stack spacing={2}>
              {consultations.map((consultation) => {
                const prescription = prescriptionsByConsultation.get(
                  String(consultation._id),
                )
                return (
                  <Paper
                    key={consultation._id}
                    sx={{ p: { xs: 2, sm: 3 } }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{
                        mb: 2,
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                      }}
                    >
                      <Box>
                        <Typography variant="h6">
                          {consultation.serviceId?.name || 'Consultation'}
                        </Typography>
                        <Typography color="text.secondary">
                          {formatDateTime(consultation.completedAt)} ·{' '}
                          {consultation.doctorId
                            ? `Dr. ${consultation.doctorId.firstName} ${consultation.doctorId.lastName}`
                            : 'Doctor unavailable'}
                        </Typography>
                      </Box>
                      <StatusChip status="completed" />
                    </Stack>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={1.5}>
                      {[
                        ['Chief complaint', consultation.chiefComplaint],
                        ['Symptoms', consultation.symptoms],
                        ['Diagnosis', consultation.diagnosis],
                        ['Treatment plan', consultation.treatmentPlan],
                        ['Patient instructions', consultation.instructions],
                      ].map(([label, value]) => (
                        <Box key={label}>
                          <Typography fontWeight={700}>{label}</Typography>
                          <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                            {value || 'Not recorded'}
                          </Typography>
                        </Box>
                      ))}
                      {consultation.privateNotes && (
                        <Box>
                          <Typography fontWeight={700}>
                            Your private notes
                          </Typography>
                          <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                            {consultation.privateNotes}
                          </Typography>
                        </Box>
                      )}
                      {prescription && (
                        <Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ mb: 1, alignItems: 'center' }}
                          >
                            <Typography fontWeight={700}>
                              Issued prescription
                            </Typography>
                            <StatusChip status="issued" />
                          </Stack>
                          <Stack spacing={1}>
                            {prescription.medications.map((medication) => (
                              <Typography key={medication._id}>
                                {medication.medicationName} — {medication.dosage},{' '}
                                {medication.frequency}, {medication.duration}
                                {medication.instructions
                                  ? ` · ${medication.instructions}`
                                  : ''}
                              </Typography>
                            ))}
                            {prescription.generalInstructions && (
                              <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                {prescription.generalInstructions}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          ) : (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">
                No completed consultations are available.
              </Typography>
            </Paper>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

export default DoctorPatientRecord
