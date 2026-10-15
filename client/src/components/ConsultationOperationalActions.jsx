import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
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
import {
  cancelConsultation,
  deleteConsultation,
} from '../services/appointmentApi'

const emptyDialog = { open: false, reason: '', error: '', loading: false }

function ConsultationOperationalActions({
  consultation,
  canCancel = false,
  allowDelete = false,
  onCompleted,
  compact = false,
}) {
  const [dialog, setDialog] = useState({ type: '', ...emptyDialog })
  const canDelete =
    allowDelete &&
    consultation?.canDelete &&
    ['cancelled', 'in_progress'].includes(consultation.status)

  const openDialog = (type) =>
    setDialog({ type, open: true, reason: '', error: '', loading: false })

  const closeDialog = () => {
    if (!dialog.loading) setDialog({ type: '', ...emptyDialog })
  }

  const submit = async () => {
    const reason = dialog.reason.trim()
    if (!reason) {
      setDialog((current) => ({
        ...current,
        error: 'A reason is required.',
      }))
      return
    }

    setDialog((current) => ({ ...current, loading: true, error: '' }))
    try {
      const response =
        dialog.type === 'cancel'
          ? await cancelConsultation(consultation._id, reason)
          : await deleteConsultation(consultation._id, reason)
      setDialog({ type: '', ...emptyDialog })
      onCompleted?.(
        response.data.message ||
          (dialog.type === 'cancel'
            ? 'Consultation cancelled and patient returned to waiting.'
            : 'Consultation deleted.'),
      )
    } catch (error) {
      setDialog((current) => ({
        ...current,
        loading: false,
        error:
          error.response?.data?.message ||
          'Unable to complete this consultation action.',
      }))
    }
  }

  if (!consultation) return null

  return (
    <>
      <Stack
        direction={compact ? 'column' : 'row'}
        spacing={1}
        alignItems={compact ? 'stretch' : 'center'}
      >
        {canCancel && consultation.status === 'in_progress' && (
          <Button
            size="medium"
            color="warning"
            variant="outlined"
            startIcon={<BlockOutlinedIcon />}
            onClick={() => openDialog('cancel')}
            sx={{
              minHeight: 40,
              px: 1.75,
              borderRadius: 2,
              fontWeight: 650,
              whiteSpace: 'nowrap',
            }}
          >
            Cancel Consultation
          </Button>
        )}
        {canDelete && (
          <Button
            size="medium"
            color="error"
            variant="outlined"
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={() => openDialog('delete')}
            sx={{
              minHeight: 40,
              px: 1.75,
              borderRadius: 2,
              fontWeight: 650,
              whiteSpace: 'nowrap',
            }}
          >
            Delete Consultation
          </Button>
        )}
      </Stack>

      <Dialog
        open={dialog.open}
        onClose={closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dialog.type === 'cancel'
            ? 'Cancel consultation?'
            : 'Delete consultation?'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={dialog.type === 'cancel' ? 'warning' : 'error'}>
              {dialog.type === 'cancel'
                ? 'This will stop the current consultation and return the patient to the waiting queue.'
                : 'This permanently removes this eligible consultation record. The appointment and patient record will remain.'}
            </Alert>
            <TextField
              label="Reason"
              required
              autoFocus
              multiline
              minRows={2}
              maxRows={5}
              value={dialog.reason}
              onChange={(event) =>
                setDialog((current) => ({
                  ...current,
                  reason: event.target.value,
                  error: '',
                }))
              }
              inputProps={{ maxLength: 500 }}
              helperText={`${dialog.reason.length}/500`}
              error={Boolean(dialog.error)}
              disabled={dialog.loading}
            />
            {dialog.error && <Alert severity="error">{dialog.error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={dialog.loading}>
            {dialog.type === 'cancel' ? 'Keep Consultation' : 'Cancel'}
          </Button>
          <Button
            color={dialog.type === 'cancel' ? 'warning' : 'error'}
            variant="contained"
            onClick={submit}
            disabled={dialog.loading || !dialog.reason.trim()}
          >
            {dialog.loading
              ? 'Please wait...'
              : dialog.type === 'cancel'
                ? 'Cancel Consultation'
                : 'Delete Consultation'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ConsultationOperationalActions
