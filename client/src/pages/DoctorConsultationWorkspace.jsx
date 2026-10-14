import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusChip from '../components/common/StatusChip'
import {
  completeConsultation,
  getConsultation,
  saveConsultationDraft,
} from '../services/appointmentApi'
import {
  createPrescription,
  getPrescriptionForConsultation,
} from '../services/prescriptionApi'

const VITAL_FIELDS = [
  ['systolic', 'Systolic BP', 'mmHg'],
  ['diastolic', 'Diastolic BP', 'mmHg'],
  ['temperature', 'Temperature', '°C'],
  ['pulse', 'Pulse', 'bpm'],
  ['respiratoryRate', 'Respiratory rate', '/min'],
  ['oxygenSaturation', 'Oxygen saturation', '%'],
  ['weight', 'Weight', 'kg'],
  ['height', 'Height', 'cm'],
]

const emptyDraft = () => ({
  chiefComplaint: '',
  symptoms: '',
  vitals: Object.fromEntries(VITAL_FIELDS.map(([field]) => [field, ''])),
  diagnosis: '',
  treatmentPlan: '',
  instructions: '',
  privateNotes: '',
})

const toDraft = (consultation) => ({
  chiefComplaint: consultation.chiefComplaint || '',
  symptoms: consultation.symptoms || '',
  vitals: Object.fromEntries(
    VITAL_FIELDS.map(([field]) => [
      field,
      consultation.vitals?.[field] ?? '',
    ]),
  ),
  diagnosis: consultation.diagnosis || '',
  treatmentPlan: consultation.treatmentPlan || '',
  instructions: consultation.instructions || '',
  privateNotes: consultation.privateNotes || '',
})

const toRequestBody = (draft) => ({
  ...draft,
  vitals: Object.fromEntries(
    VITAL_FIELDS.map(([field]) => [
      field,
      draft.vitals[field] === '' ? null : Number(draft.vitals[field]),
    ]),
  ),
})

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function DoctorConsultationWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [consultation, setConsultation] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [prescriptionLoading, setPrescriptionLoading] = useState(false)

  useEffect(() => {
    let active = true
    getConsultation(id)
      .then((response) => {
        if (!active) return
        setConsultation(response.data.data)
        setDraft(toDraft(response.data.data))
        setError('')
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load this consultation.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await saveConsultationDraft(
        id,
        toRequestBody(draft),
      )
      setConsultation(response.data.data)
      setDraft(toDraft(response.data.data))
      setNotice({ severity: 'success', message: response.data.message })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to save the consultation draft.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await completeConsultation(
        id,
        toRequestBody(draft),
      )
      setConsultation(response.data.data)
      setDraft(toDraft(response.data.data))
      setConfirmOpen(false)
      setNotice({ severity: 'success', message: response.data.message })
    } catch (requestError) {
      setConfirmOpen(false)
      setError(
        requestError.response?.data?.message ||
          'Unable to complete the consultation.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOpenPrescription = async () => {
    setPrescriptionLoading(true)
    try {
      let prescription
      try {
        const existing = await getPrescriptionForConsultation(id)
        prescription = existing.data.data
      } catch (requestError) {
        if (requestError.response?.status !== 404) throw requestError
        try {
          const created = await createPrescription(id)
          prescription = created.data.data
        } catch (createError) {
          if (createError.response?.status !== 409) throw createError
          const existing = await getPrescriptionForConsultation(id)
          prescription = existing.data.data
        }
      }
      navigate(`/doctor/prescriptions/${prescription._id}`)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to open a prescription for this consultation.',
      )
    } finally {
      setPrescriptionLoading(false)
    }
  }

  const readOnly = consultation?.status === 'completed'
  const consultationMatchesRoute =
    consultation && String(consultation._id) === id

  if (loading || (!consultationMatchesRoute && !error)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!consultationMatchesRoute) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => navigate('/doctor/consultations')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Consultations
        </Button>
      </Stack>
    )
  }

  const patient = consultation.patientId

  return (
    <Box component="section" className="doctor-page doctor-consultation-workspace" sx={{ width: '100%', minWidth: 0 }}>
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
        <Box>
          <Typography variant="h4">Consultation</Typography>
          <Typography color="text.secondary">
            Started {formatDateTime(consultation.startedAt)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <StatusChip status={consultation.status} />
          <Button
            disabled={prescriptionLoading}
            onClick={handleOpenPrescription}
          >
            {prescriptionLoading ? 'Opening…' : 'Prescription'}
          </Button>
          <Button
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={() => navigate('/doctor/consultations')}
          >
            Consultations
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack className="doctor-consultation-sections" spacing={2.5}>
        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Patient Information
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
              <strong>Patient:</strong>{' '}
              {patient
                ? `${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`
                : 'Patient unavailable'}
            </Typography>
            <Typography>
              <strong>Patient Number:</strong> {patient?.patientNumber || '—'}
            </Typography>
            <Typography>
              <strong>Service:</strong> {consultation.serviceId?.name || '—'}
            </Typography>
            <Typography>
              <strong>Appointment:</strong>{' '}
              {consultation.appointmentId?.bookingType === 'walk_in'
                ? 'Walk-In'
                : 'Scheduled'}
            </Typography>
            {patient?.dateOfBirth && (
              <Typography>
                <strong>Date of birth:</strong>{' '}
                {new Intl.DateTimeFormat('en-PH', {
                  dateStyle: 'medium',
                  timeZone: 'Asia/Manila',
                }).format(new Date(patient.dateOfBirth))}
              </Typography>
            )}
            {patient?.sex && (
              <Typography>
                <strong>Sex:</strong> {patient.sex}
              </Typography>
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Vitals
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            {VITAL_FIELDS.map(([field, label, unit]) => (
              <TextField
                key={field}
                type="number"
                label={label}
                value={draft.vitals[field]}
                disabled={readOnly || saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    vitals: {
                      ...current.vitals,
                      [field]: event.target.value,
                    },
                  }))
                }
                inputProps={{
                  min: 0,
                  step: field === 'temperature' || field === 'weight' || field === 'height' ? '0.1' : '1',
                }}
                InputProps={{
                  endAdornment: (
                    <Typography variant="caption" color="text.secondary">
                      {unit}
                    </Typography>
                  ),
                }}
              />
            ))}
          </Box>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Chief Complaint / Symptoms
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <TextField
              label="Chief complaint"
              multiline
              minRows={2}
              value={draft.chiefComplaint}
              disabled={readOnly || saving}
              onChange={(event) =>
                updateDraft('chiefComplaint', event.target.value)
              }
              fullWidth
            />
            <TextField
              label="Symptoms"
              multiline
              minRows={3}
              value={draft.symptoms}
              disabled={readOnly || saving}
              onChange={(event) => updateDraft('symptoms', event.target.value)}
              fullWidth
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Diagnosis
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            label="Diagnosis"
            multiline
            minRows={3}
            value={draft.diagnosis}
            disabled={readOnly || saving}
            onChange={(event) => updateDraft('diagnosis', event.target.value)}
            fullWidth
          />
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Treatment Plan
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            label="Treatment plan"
            multiline
            minRows={3}
            value={draft.treatmentPlan}
            disabled={readOnly || saving}
            onChange={(event) =>
              updateDraft('treatmentPlan', event.target.value)
            }
            fullWidth
          />
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Patient Instructions
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            label="Instructions"
            multiline
            minRows={3}
            value={draft.instructions}
            disabled={readOnly || saving}
            onChange={(event) => updateDraft('instructions', event.target.value)}
            fullWidth
          />
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Private Doctor Notes
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            label="Private notes (visible only to you)"
            multiline
            minRows={3}
            value={draft.privateNotes}
            disabled={readOnly || saving}
            onChange={(event) => updateDraft('privateNotes', event.target.value)}
            fullWidth
          />
        </Paper>
      </Stack>

      {!readOnly && (
        <Stack
          className="doctor-workspace-actions"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 3, justifyContent: 'space-between' }}
        >
          <Button variant="outlined" disabled={saving} onClick={handleSaveDraft}>
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => setConfirmOpen(true)}
          >
            Complete Consultation
          </Button>
        </Stack>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Complete consultation?"
        message="This will mark the consultation and appointment completed. The record will become read-only."
        confirmLabel="Complete"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleComplete}
      />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            onClose={() => setNotice(null)}
            variant="filled"
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

export default DoctorConsultationWorkspace
