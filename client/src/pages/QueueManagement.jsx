import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import useAuth from '../hooks/useAuth'
import {
  callNextQueueEntry,
  getMyQueue,
  getQueue,
  removeQueueEntry,
  returnQueueEntry,
  startConsultation,
} from '../services/appointmentApi'

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function QueueManagement() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isDoctor = user?.role === 'doctor'
  const [rows, setRows] = useState([])
  const [queueDate, setQueueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busyKey, setBusyKey] = useState('')
  const [notice, setNotice] = useState(null)
  const [removeDialog, setRemoveDialog] = useState({
    open: false,
    entry: null,
    reason: '',
    loading: false,
    error: '',
  })

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const response = await (isDoctor ? getMyQueue() : getQueue())
      setRows(response.data.data || [])
      setQueueDate(response.data.date || '')
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.response?.data?.message || 'Unable to load the queue.',
      })
    } finally {
      setLoading(false)
    }
  }, [isDoctor])

  useEffect(() => {
    loadQueue()
  }, [loadQueue, refreshKey])

  const firstWaitingEntryByDoctor = useMemo(() => {
    const firstWaiting = new Map()
    rows.forEach((entry) => {
      const doctorId = entry.doctorId?._id
      if (
        !firstWaiting.has(doctorId) &&
        entry.queueStatus === 'waiting' &&
        doctorId
      ) {
        firstWaiting.set(doctorId, entry._id)
      }
    })
    return firstWaiting
  }, [rows])

  const runQueueAction = async (key, action, successMessage) => {
    setBusyKey(key)
    try {
      await action()
      setNotice({ severity: 'success', message: successMessage })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.response?.data?.message || 'Unable to update the queue.',
      })
    } finally {
      setBusyKey('')
    }
  }

  const handleRemove = async () => {
    if (!removeDialog.entry || !removeDialog.reason.trim()) {
      setRemoveDialog((current) => ({
        ...current,
        error: 'A removal reason is required.',
      }))
      return
    }
    setRemoveDialog((current) => ({ ...current, loading: true, error: '' }))
    try {
      await removeQueueEntry(
        removeDialog.entry._id,
        removeDialog.reason.trim(),
      )
      setNotice({ severity: 'success', message: 'Patient removed from queue.' })
      setRemoveDialog({
        open: false,
        entry: null,
        reason: '',
        loading: false,
        error: '',
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setRemoveDialog((current) => ({
        ...current,
        loading: false,
        error:
          error.response?.data?.message || 'Unable to remove the queue entry.',
      }))
    }
  }

  const handleStartConsultation = async (entry) => {
    setBusyKey(entry._id)
    try {
      const response = await startConsultation(entry._id)
      navigate(`/doctor/consultations/${response.data.data._id}`)
    } catch (error) {
      setNotice({
        severity: 'error',
        message:
          error.response?.data?.message ||
          'Unable to start this consultation.',
      })
      setBusyKey('')
    }
  }

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ width: '100%', mb: 3 }}
      >
        <Box>
          <Typography variant="h4">{isDoctor ? 'My Queue' : 'Queue'}</Typography>
          <Typography color="text.secondary">
            {isDoctor
              ? 'View today’s patients waiting for your consultation.'
              : 'Manage today’s checked-in and walk-in patients.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {queueDate && (
            <Typography variant="body2" color="text.secondary">
              {queueDate} · Manila time
            </Typography>
          )}
          <Button onClick={() => setRefreshKey((current) => current + 1)}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Position</TableCell>
                <TableCell>Patient</TableCell>
                {!isDoctor && <TableCell>Doctor</TableCell>}
                <TableCell>Service</TableCell>
                <TableCell>Arrived</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!rows.length}
                colSpan={isDoctor ? 6 : 7}
                emptyMessage="No active patients in the queue today."
              />
              {!loading &&
                rows.map((entry) => {
                  const doctorId = entry.doctorId?._id
                  const isFirstWaiting =
                    firstWaitingEntryByDoctor.get(doctorId) === entry._id
                  return (
                    <TableRow key={entry._id} hover>
                      <TableCell>
                        <Typography fontWeight={700}>
                          {entry.queuePosition}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {entry.patientId
                            ? `${entry.patientId.firstName} ${entry.patientId.lastName}`
                            : 'Patient unavailable'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.patientId?.patientNumber || '—'}
                          {entry.patientId?.mobileNumber
                            ? ` · ${entry.patientId.mobileNumber}`
                            : ''}
                        </Typography>
                      </TableCell>
                      {!isDoctor && (
                        <TableCell>
                          {entry.doctorId
                            ? `Dr. ${entry.doctorId.firstName} ${entry.doctorId.lastName}`
                            : 'Doctor unavailable'}
                        </TableCell>
                      )}
                      <TableCell>{entry.serviceId?.name || '—'}</TableCell>
                      <TableCell>{formatTime(entry.joinedAt)}</TableCell>
                      <TableCell>
                        <StatusChip status={entry.queueStatus} />
                      </TableCell>
                      <TableCell align="right">
                        {isDoctor ? (
                          entry.queueStatus === 'called' && (
                            <Button
                              size="small"
                              variant="contained"
                              disabled={Boolean(busyKey)}
                              onClick={() => handleStartConsultation(entry)}
                            >
                              {busyKey === entry._id
                                ? 'Starting…'
                                : 'Start Consultation'}
                            </Button>
                          )
                        ) : (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="flex-end"
                            alignItems="center"
                          >
                            {isFirstWaiting && (
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<NotificationsActiveOutlinedIcon />}
                                disabled={Boolean(busyKey)}
                                onClick={() =>
                                  runQueueAction(
                                    `call-${doctorId}`,
                                    () => callNextQueueEntry(doctorId),
                                    'Next patient called.',
                                  )
                                }
                              >
                                Call next
                              </Button>
                            )}
                            {entry.queueStatus === 'called' && (
                              <Tooltip title="Return to waiting">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={Boolean(busyKey)}
                                    onClick={() =>
                                      runQueueAction(
                                        entry._id,
                                        () => returnQueueEntry(entry._id),
                                        'Patient returned to the waiting queue.',
                                      )
                                    }
                                  >
                                    <ReplayOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            <Tooltip title="Remove from queue">
                              <IconButton
                                size="small"
                                color="error"
                                disabled={Boolean(busyKey)}
                                onClick={() =>
                                  setRemoveDialog({
                                    open: true,
                                    entry,
                                    reason: '',
                                    loading: false,
                                    error: '',
                                  })
                                }
                              >
                                <CloseOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={removeDialog.open}
        onClose={
          removeDialog.loading
            ? undefined
            : () =>
                setRemoveDialog((current) => ({ ...current, open: false }))
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove patient from queue</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {removeDialog.error && (
              <Alert severity="error">{removeDialog.error}</Alert>
            )}
            <Typography variant="body2">
              Provide a reason for removing{' '}
              {removeDialog.entry?.patientId?.firstName || 'this patient'} from
              the active queue.
            </Typography>
            <TextField
              required
              multiline
              minRows={3}
              label="Reason"
              value={removeDialog.reason}
              inputProps={{ maxLength: 500 }}
              onChange={(event) =>
                setRemoveDialog((current) => ({
                  ...current,
                  reason: event.target.value,
                  error: '',
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            disabled={removeDialog.loading}
            onClick={() =>
              setRemoveDialog((current) => ({ ...current, open: false }))
            }
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={removeDialog.loading}
            onClick={handleRemove}
          >
            {removeDialog.loading ? 'Removing…' : 'Remove from Queue'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default QueueManagement
