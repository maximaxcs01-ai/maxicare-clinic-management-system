import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import {
  Alert,
  Button,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import ConfirmDialog from './common/ConfirmDialog'
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
      <ConfirmDialog
        open={open}
        title="Delete Appointment?"
        message="This permanently removes this eligible operational appointment and its safe linked records. This action cannot be undone."
        confirmLabel="Delete Appointment"
        severity="error"
        loading={loading}
        confirmDisabled={!reason.trim()}
        onCancel={close}
        onConfirm={submit}
      >
        <Stack spacing={2} sx={{ mt: 2 }}>
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
      </ConfirmDialog>
    </>
  )
}

export default AppointmentDeletionAction
