import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import {
  addMedication,
  MEDICATION_FIELDS,
  prescriptionDraftToRequest,
  prescriptionToDraft,
  removeMedication,
} from '../utils/prescriptionForm'

const patientName = (patient) =>
  patient
    ? [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(' ')
    : 'Patient unavailable'

function IssuePrescriptionDialog({
  open,
  consultation,
  prescription,
  onClose,
  onIssue,
}) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [draft, setDraft] = useState(() => prescriptionToDraft(prescription))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submittingRef = useRef(false)
  const previousOpenRef = useRef(false)

  useEffect(() => {
    if (open && !previousOpenRef.current) {
      setDraft(prescriptionToDraft(prescription))
      setError('')
    }
    previousOpenRef.current = open
  }, [open, prescription])

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

  const handleIssue = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try {
      await onIssue(prescriptionDraftToRequest(draft))
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to issue this prescription.',
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="md"
      aria-labelledby="issue-prescription-title"
    >
      <DialogTitle id="issue-prescription-title">
        Issue Prescription
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Typography fontWeight={700}>
              Patient: {patientName(consultation?.patientId)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review the saved Consultation details before issuing medication.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            {[
              ['Diagnosis', consultation?.diagnosis],
              ['Treatment Plan', consultation?.treatmentPlan],
              ['Patient Instructions', consultation?.instructions],
            ].map(([label, value]) => (
              <Box
                key={label}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  gridColumn: label === 'Diagnosis' ? '1 / -1' : undefined,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                  {value?.trim() || 'Not yet provided'}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider />

          <Stack spacing={2}>
            {draft.medications.map((medication, index) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: { xs: 1.5, sm: 2 } }}
              >
                <Stack
                  direction="row"
                  sx={{
                    mb: 2,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography fontWeight={700}>
                    Medication {index + 1}
                  </Typography>
                  <Tooltip title="Remove medication">
                    <span>
                      <IconButton
                        color="error"
                        aria-label={`Remove medication ${index + 1}`}
                        disabled={submitting || draft.medications.length === 1}
                        onClick={() =>
                          setDraft((current) =>
                            removeMedication(current, index),
                          )
                        }
                      >
                        <DeleteOutlineOutlinedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 2,
                  }}
                >
                  {MEDICATION_FIELDS.map(([field, label, required]) => (
                    <TextField
                      key={field}
                      required={required}
                      label={label}
                      value={medication[field]}
                      disabled={submitting}
                      onChange={(event) =>
                        updateMedication(index, field, event.target.value)
                      }
                    />
                  ))}
                  <TextField
                    label="Medication Instructions"
                    value={medication.instructions}
                    disabled={submitting}
                    onChange={(event) =>
                      updateMedication(index, 'instructions', event.target.value)
                    }
                  />
                </Box>
              </Paper>
            ))}
          </Stack>

          <Button
            startIcon={<AddOutlinedIcon />}
            disabled={submitting || draft.medications.length >= 50}
            onClick={() =>
              setDraft((current) => addMedication(current))
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            Add Medication
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button disabled={submitting} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={submitting}
          onClick={handleIssue}
        >
          {submitting ? 'Issuing…' : 'Issue Prescription'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default IssuePrescriptionDialog
