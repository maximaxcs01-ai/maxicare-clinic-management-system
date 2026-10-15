import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import {
  Button,
  Stack,
  TextField,
} from '@mui/material'
import { useState } from 'react'
import ConfirmDialog from './common/ConfirmDialog'
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

      <ConfirmDialog
        open={dialog.open}
        title={dialog.type === 'cancel'
          ? 'Cancel Consultation?'
          : 'Delete Consultation?'}
        message={dialog.type === 'cancel'
          ? 'This will stop the current consultation and return the patient to the waiting queue.'
          : 'This permanently deletes this eligible consultation record. This action cannot be undone.'}
        confirmLabel={dialog.type === 'cancel'
          ? 'Cancel Consultation'
          : 'Delete Consultation'}
        cancelLabel={dialog.type === 'cancel' ? 'Keep Consultation' : 'Cancel'}
        severity={dialog.type === 'cancel' ? 'warning' : 'error'}
        error={dialog.error}
        loading={dialog.loading}
        confirmDisabled={!dialog.reason.trim()}
        onCancel={closeDialog}
        onConfirm={submit}
        maxWidth="sm"
      >
        <Stack spacing={2} sx={{ mt: 2 }}>
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
        </Stack>
      </ConfirmDialog>
    </>
  )
}

export default ConsultationOperationalActions
