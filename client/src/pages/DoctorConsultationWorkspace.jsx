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
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import IssuePrescriptionDialog from '../components/IssuePrescriptionDialog'
import StatusChip from '../components/common/StatusChip'
import {
  completeConsultation,
  getConsultation,
  markNoPrescriptionNeeded,
  saveConsultationDraft,
} from '../services/appointmentApi'
import {
  createPrescription,
  getPrescriptionForConsultation,
  issuePrescription,
} from '../services/prescriptionApi'
import {
  consultationDraftToRequest,
  consultationToDraft,
  createEmptyConsultationDraft,
  savedConsultationMatchesRequest,
} from '../utils/consultationDraft'
import {
  issueLinkedPrescription,
  preparePrescriptionIssue,
} from '../utils/prescriptionIssueWorkflow'

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
  const [draft, setDraft] = useState(createEmptyConsultationDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const [noPrescriptionConfirmOpen, setNoPrescriptionConfirmOpen] = useState(false)
  const [prescriptionDecisionError, setPrescriptionDecisionError] = useState('')
  const [prescriptionLoading, setPrescriptionLoading] = useState(false)
  const [prescription, setPrescription] = useState(null)
  const [prescriptionAction, setPrescriptionAction] = useState(false)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const prescriptionActionRef = useRef(false)
  const issueRequestRef = useRef(false)
  const completionActionRef = useRef(false)
  const noPrescriptionActionRef = useRef(false)

  useEffect(() => {
    let active = true
    getConsultation(id)
      .then(async (response) => {
        if (!active) return
        setConsultation(response.data.data)
        setDraft(consultationToDraft(response.data.data))
        setError('')
        try {
          const prescriptionResponse = await getPrescriptionForConsultation(id)
          if (active) setPrescription(prescriptionResponse.data.data)
        } catch (requestError) {
          if (requestError.response?.status !== 404) throw requestError
          if (active) setPrescription(null)
        }
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

  const saveCurrentDraft = async (
    requestBody = consultationDraftToRequest(draft),
  ) => {
    setSaving(true)
    try {
      const response = await saveConsultationDraft(id, requestBody)
      const savedConsultation = response.data?.data
      if (!savedConsultationMatchesRequest(savedConsultation, requestBody)) {
        throw new Error('The saved consultation did not match the submitted draft.')
      }
      setConsultation(savedConsultation)
      setDraft(consultationToDraft(savedConsultation))
      return savedConsultation
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to save consultation. Please try again.',
      )
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    if (prescriptionActionRef.current || saving) return
    prescriptionActionRef.current = true
    setPrescriptionAction(true)
    setError('')
    try {
      const savedConsultation = await saveCurrentDraft()
      if (savedConsultation) {
        setNotice({
          severity: 'success',
          message: 'Consultation draft saved.',
        })
      }
    } catch {
      // saveCurrentDraft sets the visible error and preserves the local draft.
    } finally {
      prescriptionActionRef.current = false
      setPrescriptionAction(false)
    }
  }

  const handleComplete = async () => {
    if (completionActionRef.current || saving) return
    completionActionRef.current = true
    setSaving(true)
    setError('')
    setCompletionError('')
    try {
      const response = await completeConsultation(
        id,
        consultationDraftToRequest(draft),
      )
      setConsultation(response.data.data)
      setDraft(consultationToDraft(response.data.data))
      setConfirmOpen(false)
      setNotice({
        severity: 'success',
        message: 'Consultation completed successfully.',
      })
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        'Unable to complete the consultation.'
      setError(message)
      setCompletionError(message)
    } finally {
      setSaving(false)
      completionActionRef.current = false
    }
  }

  const handleOpenIssuePrescription = async () => {
    if (
      prescriptionActionRef.current ||
      saving ||
      prescriptionLoading
    ) return
    prescriptionActionRef.current = true
    setPrescriptionAction(true)
    setPrescriptionLoading(true)
    setError('')
    const requestBody = consultationDraftToRequest(draft)
    try {
      const prepared = await preparePrescriptionIssue({
        saveConsultation: () => saveCurrentDraft(requestBody),
        getPrescription: () => getPrescriptionForConsultation(id),
      })
      setConsultation(prepared.consultation)
      setPrescription(prepared.prescription)
      if (prepared.prescription?.status === 'issued') {
        setNotice({
          severity: 'info',
          message: 'This consultation already has an issued prescription.',
        })
      } else {
        setIssueDialogOpen(true)
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to prepare the prescription. Please try again.',
      )
    } finally {
      setPrescriptionLoading(false)
      prescriptionActionRef.current = false
      setPrescriptionAction(false)
    }
  }

  const handleIssuePrescription = async (payload) => {
    if (issueRequestRef.current) return
    issueRequestRef.current = true
    try {
      const issuedPrescription = await issueLinkedPrescription({
        consultationId: id,
        prescription,
        payload,
        createPrescription,
        getPrescription: () => getPrescriptionForConsultation(id),
        issuePrescription,
        onDraftCreated: setPrescription,
      })
      setPrescription(issuedPrescription)
      setIssueDialogOpen(false)
      setNotice({
        severity: 'success',
        message: 'Prescription issued successfully.',
      })
    } finally {
      issueRequestRef.current = false
    }
  }

  const handleNoPrescriptionNeeded = async () => {
    if (noPrescriptionActionRef.current || saving || prescriptionLoading) return
    noPrescriptionActionRef.current = true
    try {
      setPrescriptionLoading(true)
      setError('')
      setPrescriptionDecisionError('')
      const response = await markNoPrescriptionNeeded(id)
      setConsultation(response.data.data)
      setNoPrescriptionConfirmOpen(false)
      setNotice({
        severity: 'success',
        message: 'No prescription needed decision saved.',
      })
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        'Unable to save the prescription decision.'
      setError(message)
      setPrescriptionDecisionError(message)
    } finally {
      setPrescriptionLoading(false)
      noPrescriptionActionRef.current = false
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
  const prescriptionStatus =
    consultation.prescriptionDecision === 'none_required'
      ? 'none_required'
      : prescription?.status === 'issued'
        ? 'issued'
        : 'pending'
  const prescriptionResolved = prescriptionStatus !== 'pending'
  const triageRecorder = consultation.triageRecordedBy
  const triageRecorderName = triageRecorder
    ? [triageRecorder.firstName, triageRecorder.lastName].filter(Boolean).join(' ')
    : ''

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
          <Typography variant="h6" sx={{ mb: 1 }}>
            Vitals / Triage
          </Typography>
          {consultation.triageRecordedAt ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Triage completed by {triageRecorderName || 'clinic staff'} on{' '}
              {formatDateTime(consultation.triageRecordedAt)}
            </Typography>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              No pre-consultation triage was recorded. You may enter vitals below.
            </Alert>
          )}
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
            {VITAL_FIELDS.map(([field, label, unit]) =>
              consultation.triageRecordedAt ? (
                <Box
                  key={field}
                  sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography fontWeight={700}>
                    {draft.vitals[field] === ''
                      ? '—'
                      : `${draft.vitals[field]} ${unit}`}
                  </Typography>
                </Box>
              ) : (
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
                    step:
                      field === 'temperature' || field === 'weight' || field === 'height'
                        ? '0.1'
                        : '1',
                  }}
                  InputProps={{
                    endAdornment: (
                      <Typography variant="caption" color="text.secondary">
                        {unit}
                      </Typography>
                    ),
                  }}
                />
              ),
            )}
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

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Prescription</Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography fontWeight={700}>
            {prescriptionStatus === 'issued'
              ? 'Prescription Issued ✓'
              : prescriptionStatus === 'none_required'
                ? 'No Prescription Needed ✓'
                : 'Not decided'}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mt: 2 }}
          >
            {prescriptionStatus === 'pending' && !readOnly && (
              <>
                <Button
                  variant="outlined"
                  disabled={prescriptionAction || saving || prescriptionLoading}
                  onClick={handleOpenIssuePrescription}
                >
                  {saving
                    ? 'Saving…'
                    : prescriptionLoading
                      ? 'Preparing…'
                      : 'Issue Prescription'}
                </Button>
                <Button
                  disabled={prescriptionAction || saving || prescriptionLoading}
                  onClick={() => {
                    setPrescriptionDecisionError('')
                    setNoPrescriptionConfirmOpen(true)
                  }}
                >
                  No Prescription Needed
                </Button>
              </>
            )}
            {prescriptionStatus === 'issued' && (
              <Button
                variant="outlined"
                onClick={() =>
                  navigate(`/doctor/prescriptions/${prescription._id}`)
                }
              >
                View Prescription
              </Button>
            )}
          </Stack>
        </Paper>
      </Stack>

      {!readOnly && (
        <Stack
          className="doctor-workspace-actions"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 3, justifyContent: 'space-between' }}
        >
          <Button
            variant="outlined"
            disabled={saving || prescriptionAction}
            onClick={handleSaveDraft}
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button
            variant="contained"
            disabled={saving || !prescriptionResolved}
            onClick={() => setConfirmOpen(true)}
          >
            Complete Consultation
          </Button>
          {!prescriptionResolved && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: 'center' }}
            >
              Resolve the prescription step before completing this consultation.
            </Typography>
          )}
        </Stack>
      )}

      <IssuePrescriptionDialog
        open={issueDialogOpen}
        consultation={consultation}
        prescription={prescription}
        onClose={() => setIssueDialogOpen(false)}
        onIssue={handleIssuePrescription}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Complete Consultation?"
        message="Are you sure you want to complete this consultation? Once completed, the finalized clinical record can no longer be edited."
        confirmLabel="Complete Consultation"
        cancelLabel="Cancel"
        error={completionError}
        loading={saving}
        onCancel={() => {
          setConfirmOpen(false)
          setCompletionError('')
        }}
        onConfirm={handleComplete}
      />

      <ConfirmDialog
        open={noPrescriptionConfirmOpen}
        title="No Prescription Needed?"
        message="Confirm that this consultation does not require a prescription."
        confirmLabel="Confirm"
        error={prescriptionDecisionError}
        loading={prescriptionLoading}
        onCancel={() => {
          setNoPrescriptionConfirmOpen(false)
          setPrescriptionDecisionError('')
        }}
        onConfirm={handleNoPrescriptionNeeded}
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
