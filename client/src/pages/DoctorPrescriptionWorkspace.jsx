import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusChip from '../components/common/StatusChip'
import {
  getPrescription,
  issuePrescription,
  savePrescriptionDraft,
} from '../services/prescriptionApi'

const newMedication = () => ({
  medicationName: '',
  dosage: '',
  frequency: '',
  route: '',
  duration: '',
  quantity: '',
  instructions: '',
})

const medicationFields = [
  ['medicationName', 'Medication Name', true],
  ['dosage', 'Dosage', true],
  ['frequency', 'Frequency', true],
  ['route', 'Route', false],
  ['duration', 'Duration', true],
  ['quantity', 'Quantity', false],
]

const toDraft = (prescription) => ({
  generalInstructions: prescription.generalInstructions || '',
  medications: prescription.medications?.length
    ? prescription.medications.map((medication) => ({
        medicationName: medication.medicationName || '',
        dosage: medication.dosage || '',
        frequency: medication.frequency || '',
        route: medication.route || '',
        duration: medication.duration || '',
        quantity: medication.quantity || '',
        instructions: medication.instructions || '',
      }))
    : [newMedication()],
})

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function DoctorPrescriptionWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState(null)
  const [draft, setDraft] = useState({
    generalInstructions: '',
    medications: [newMedication()],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false)

  useEffect(() => {
    let active = true
    getPrescription(id)
      .then((response) => {
        if (!active) return
        setPrescription(response.data.data)
        setDraft(toDraft(response.data.data))
        setError('')
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load this prescription.',
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

  const readOnly = prescription?.status === 'issued'
  const currentPrescription = prescription && String(prescription._id) === id

  const updateMedication = (index, field, value) => {
    setDraft((current) => ({
      ...current,
      medications: current.medications.map((medication, rowIndex) =>
        rowIndex === index
          ? { ...medication, [field]: value }
          : medication,
      ),
    }))
  }

  const persistDraft = async (shouldIssue) => {
    setSaving(true)
    setError('')
    try {
      const request = shouldIssue ? issuePrescription : savePrescriptionDraft
      const medications = draft.medications.filter((medication) =>
        Object.values(medication).some((value) => value.trim())
      )
      const response = await request(id, {
        ...draft,
        medications,
      })
      setPrescription(response.data.data)
      setDraft(toDraft(response.data.data))
      setIssueConfirmOpen(false)
      setNotice({
        severity: 'success',
        message: response.data.message,
      })
    } catch (requestError) {
      setIssueConfirmOpen(false)
      setError(
        requestError.response?.data?.message ||
          (shouldIssue
            ? 'Unable to issue this prescription.'
            : 'Unable to save this prescription.'),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading || (!currentPrescription && !error)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!currentPrescription) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{error}</Alert>
        <Button
          onClick={() => navigate('/doctor/prescriptions')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Prescriptions
        </Button>
      </Stack>
    )
  }

  const patient = prescription.patientId
  const consultation = prescription.consultationId

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4">Prescription</Typography>
          <Typography color="text.secondary">
            Created {formatDate(prescription.createdAt)}
            {prescription.issuedAt
              ? ` · Issued ${formatDate(prescription.issuedAt)}`
              : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <StatusChip status={prescription.status} />
          <Button onClick={() => navigate('/doctor/prescriptions')}>
            Prescriptions
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={2.5}>
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
              <strong>Service:</strong> {prescription.serviceId?.name || '—'}
            </Typography>
            <Typography>
              <strong>Appointment:</strong>{' '}
              {prescription.appointmentId?.bookingType === 'walk_in'
                ? 'Walk-In'
                : 'Scheduled'}
            </Typography>
          </Box>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Diagnosis / Treatment Context
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <TextField
              label="Diagnosis"
              value={consultation?.diagnosis || ''}
              multiline
              minRows={2}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="Treatment plan"
              value={consultation?.treatmentPlan || ''}
              multiline
              minRows={2}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="Patient instructions"
              value={consultation?.instructions || ''}
              multiline
              minRows={2}
              InputProps={{ readOnly: true }}
              fullWidth
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Medications</Typography>
            {!readOnly && (
              <Button
                startIcon={<AddOutlinedIcon />}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    medications: [...current.medications, newMedication()],
                  }))
                }
              >
                Add Medication
              </Button>
            )}
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            {draft.medications.map((medication, index) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: { xs: 1.5, sm: 2 } }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography fontWeight={600}>
                    Medication {index + 1}
                  </Typography>
                  {!readOnly && (
                    <Tooltip title="Remove medication">
                      <IconButton
                        color="error"
                        aria-label={`Remove medication ${index + 1}`}
                        disabled={saving}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            medications: current.medications.filter(
                              (_, rowIndex) => rowIndex !== index,
                            ),
                          }))
                        }
                      >
                        <DeleteOutlineOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 2,
                  }}
                >
                  {medicationFields.map(([field, label, required]) => (
                    <TextField
                      key={field}
                      required={required}
                      label={label}
                      value={medication[field]}
                      disabled={readOnly || saving}
                      onChange={(event) =>
                        updateMedication(index, field, event.target.value)
                      }
                    />
                  ))}
                  <TextField
                    label="Instructions"
                    value={medication.instructions}
                    disabled={readOnly || saving}
                    onChange={(event) =>
                      updateMedication(index, 'instructions', event.target.value)
                    }
                  />
                </Box>
              </Paper>
            ))}
            {!draft.medications.length && (
              <Alert severity="info">Add at least one medication to issue.</Alert>
            )}
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            General Instructions
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
            label="General instructions"
            value={draft.generalInstructions}
            disabled={readOnly || saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                generalInstructions: event.target.value,
              }))
            }
            multiline
            minRows={3}
            fullWidth
          />
        </Paper>
      </Stack>

      {!readOnly && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="flex-end"
          spacing={1.5}
          sx={{ mt: 3 }}
        >
          <Button
            disabled={saving}
            onClick={() => persistDraft(false)}
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => setIssueConfirmOpen(true)}
          >
            Issue Prescription
          </Button>
        </Stack>
      )}

      <ConfirmDialog
        open={issueConfirmOpen}
        title="Issue prescription?"
        message="Once issued, this prescription becomes read-only and cannot be edited or deleted."
        confirmLabel="Issue Prescription"
        loading={saving}
        onCancel={() => setIssueConfirmOpen(false)}
        onConfirm={() => persistDraft(true)}
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

export default DoctorPrescriptionWorkspace
