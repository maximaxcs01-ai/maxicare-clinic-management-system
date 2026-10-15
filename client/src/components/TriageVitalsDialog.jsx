import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { saveAppointmentTriage } from '../services/appointmentApi'
import {
  VITAL_FIELDS,
  emptyVitals,
  toVitalsForm,
  toVitalsRequest,
} from '../utils/vitals'

const formatRecordedAt = (value) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(value))
    : 'Not recorded'

function TriageVitalsDialog({ appointment, open, onClose, onSaved, readOnly = false }) {
  const [vitals, setVitals] = useState(() =>
    appointment ? toVitalsForm(appointment.triage?.vitals) : emptyVitals(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!appointment?._id) return
    try {
      setSaving(true)
      setError('')
      const response = await saveAppointmentTriage(appointment._id, {
        vitals: toVitalsRequest(vitals),
      })
      onSaved(response.data.data, response.data.message)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Unable to save vitals.',
      )
    } finally {
      setSaving(false)
    }
  }

  const patient = appointment?.patientId
  const recordedBy = appointment?.triage?.recordedBy
  const recordedByName = recordedBy
    ? [recordedBy.firstName, recordedBy.lastName].filter(Boolean).join(' ')
    : 'Clinic staff'
  const recordedVitals = appointment?.triage?.vitals || {}
  const readOnlyValues = [
    [
      'Blood Pressure',
      recordedVitals.systolic == null && recordedVitals.diastolic == null
        ? 'Not recorded'
        : `${recordedVitals.systolic ?? '—'} / ${recordedVitals.diastolic ?? '—'} mmHg`,
    ],
    ...VITAL_FIELDS.filter(([field]) => !['systolic', 'diastolic'].includes(field)).map(
      ([field, label, unit]) => [
        label,
        recordedVitals[field] == null
          ? 'Not recorded'
          : `${recordedVitals[field]} ${unit}`,
      ],
    ),
  ]

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {readOnly
          ? 'Patient Vitals'
          : appointment?.triage?.recordedAt
            ? 'View / Update Vitals'
            : 'Record Vitals'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Typography variant="overline" color="text.secondary">Patient</Typography>
            <Typography fontWeight={700}>
              {patient
                ? [patient.firstName, patient.middleName, patient.lastName]
                    .filter(Boolean)
                    .join(' ')
                : 'Patient unavailable'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {patient?.patientNumber || 'No patient number'}
            </Typography>
          </Box>
          {readOnly ? (
            <>
              {appointment?.triage?.recordedAt ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">Recorded by</Typography>
                    <Typography fontWeight={600}>{recordedByName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="overline" color="text.secondary">Recorded at</Typography>
                    <Typography fontWeight={600}>{formatRecordedAt(appointment.triage.recordedAt)}</Typography>
                  </Box>
                </Stack>
              ) : (
                <Alert severity="info">No vitals have been recorded for this patient.</Alert>
              )}
              <Typography variant="h6">Vitals</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                {readOnlyValues.map(([label, value]) => (
                  <Paper key={label} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography fontWeight={700}>{value}</Typography>
                  </Paper>
                ))}
              </Box>
            </>
          ) : (
            <>
              <Typography variant="h6">Vitals</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                {VITAL_FIELDS.map(([field, label, unit, min, max, step]) => (
                  <TextField
                    key={field}
                    type="number"
                    label={label}
                    value={vitals[field]}
                    disabled={saving}
                    onChange={(event) => setVitals((current) => ({ ...current, [field]: event.target.value }))}
                    slotProps={{
                      htmlInput: { min, max, step },
                      input: { endAdornment: <Typography variant="caption" color="text.secondary">{unit}</Typography> },
                    }}
                  />
                ))}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>{readOnly ? 'Close' : 'Cancel'}</Button>
        {!readOnly && (
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Vitals'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default TriageVitalsDialog
