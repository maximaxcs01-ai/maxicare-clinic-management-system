import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

function TriageVitalsDialog({ appointment, open, onClose, onSaved }) {
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

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {appointment?.triage?.recordedAt ? 'View / Update Vitals' : 'Record Vitals'}
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
          <Typography variant="h6">Vitals</Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {VITAL_FIELDS.map(([field, label, unit, min, max, step]) => (
              <TextField
                key={field}
                type="number"
                label={label}
                value={vitals[field]}
                disabled={saving}
                onChange={(event) =>
                  setVitals((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                slotProps={{
                  htmlInput: { min, max, step },
                  input: {
                    endAdornment: (
                      <Typography variant="caption" color="text.secondary">
                        {unit}
                      </Typography>
                    ),
                  },
                }}
              />
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Vitals'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TriageVitalsDialog
