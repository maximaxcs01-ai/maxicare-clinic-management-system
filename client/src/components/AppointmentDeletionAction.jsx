import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import { deleteAppointment } from '../services/appointmentApi'

function AppointmentDeletionAction({
  appointment,
  onCompleted,
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const close = () => {
    if (loading) return
    setOpen(false)
    setReason('')
    setError('')
  }

  const submit = async () => {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('A deletion reason is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await deleteAppointment(appointment._id, trimmedReason)
      setOpen(false)
      setReason('')
      onCompleted?.(response.data.message || 'Appointment deleted.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to delete this appointment.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (!appointment?.canDeleteAppointment) return null

  return (
    <>
      <Button
        color="error"
        variant="outlined"
        startIcon={<DeleteOutlineOutlinedIcon />}
        onClick={() => setOpen(true)}
      >
        Delete Appointment
      </Button>
      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>Delete appointment?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="error">
              This permanently removes this eligible appointment and its
              non-final operational records.
            </Alert>
            <TextField
              label="Reason"
              required
              autoFocus
              multiline
              minRows={2}
              maxRows={5}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setError('')
              }}
              inputProps={{ maxLength: 500 }}
              helperText={`${reason.length}/500`}
              disabled={loading}
              error={Boolean(error)}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={submit}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Deleting...' : 'Delete Appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default AppointmentDeletionAction
