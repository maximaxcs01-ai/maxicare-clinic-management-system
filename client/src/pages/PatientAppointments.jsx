import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import AddIcon from '@mui/icons-material/Add'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import {
  cancelAppointment,
  getMyAppointments,
  rescheduleAppointment,
} from '../services/appointmentApi'
import { getAvailability } from '../services/scheduleApi'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const getManilaToday = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

const addDays = (dateStr, days) => {
  const next = new Date(`${dateStr}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const formatSlotTime = (timeStr) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(`2020-01-01T${timeStr}:00+08:00`))

function PatientAppointments() {
  const location = useLocation()
  const [bucket, setBucket] = useState('upcoming')
  const [page, setPage] = useState(1)
  const [appointments, setAppointments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Notification state
  const [notice, setNotice] = useState(null)

  // Cancellation modal state
  const [cancelModal, setCancelModal] = useState({
    open: false,
    appointment: null,
    reason: '',
    loading: false,
    error: '',
  })

  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    appointment: null,
    date: '',
    slot: '',
    reason: '',
    slots: [],
    slotsLoading: false,
    slotsError: '',
    submitting: false,
    error: '',
  })

  const todayStr = getManilaToday()

  useEffect(() => {
    let active = true
    setLoading(true)
    getMyAppointments({ bucket, page, limit: 10 })
      .then((response) => {
        if (!active) return
        setAppointments(response.data.data)
        setPagination(response.data.pagination)
        setError('')
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load your appointments.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [bucket, page, refreshKey])

  const changeBucket = (_, value) => {
    setLoading(true)
    setPage(1)
    setBucket(value)
  }

  // Open Cancel dialog
  const handleOpenCancel = (appointment) => {
    setCancelModal({
      open: true,
      appointment,
      reason: '',
      loading: false,
      error: '',
    })
  }

  const handleConfirmCancel = async () => {
    if (!cancelModal.appointment) return
    setCancelModal((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const response = await cancelAppointment(cancelModal.appointment._id, {
        cancellationReason: cancelModal.reason,
      })
      setNotice({
        severity: 'success',
        message: response.data.message || 'Appointment cancelled successfully.',
      })
      setCancelModal({
        open: false,
        appointment: null,
        reason: '',
        loading: false,
        error: '',
      })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setCancelModal((prev) => ({
        ...prev,
        loading: false,
        error:
          err.response?.data?.message ||
          'Unable to cancel appointment. Please try again.',
      }))
    }
  }

  // Open Reschedule dialog
  const handleOpenReschedule = (appointment) => {
    setRescheduleModal({
      open: true,
      appointment,
      date: '',
      slot: '',
      reason: '',
      slots: [],
      slotsLoading: false,
      slotsError: '',
      submitting: false,
      error: '',
    })
  }

  // Handle date change in reschedule modal
  const handleRescheduleDateChange = (date) => {
    setRescheduleModal((prev) => ({
      ...prev,
      date,
      slot: '',
      slots: [],
      slotsError: '',
      slotsLoading: Boolean(date && prev.appointment),
      error: '',
    }))

    if (!date || !rescheduleModal.appointment) return

    getAvailability({
      doctorId: rescheduleModal.appointment.doctorId?._id || rescheduleModal.appointment.doctorId,
      serviceId: rescheduleModal.appointment.serviceId?._id || rescheduleModal.appointment.serviceId,
      date,
    })
      .then((res) => {
        const availableSlots = (res.data.slots || []).filter((s) => s.available)
        setRescheduleModal((prev) => ({
          ...prev,
          slots: availableSlots,
          slotsLoading: false,
        }))
      })
      .catch((err) => {
        setRescheduleModal((prev) => ({
          ...prev,
          slots: [],
          slotsLoading: false,
          slotsError:
            err.response?.data?.message || 'Unable to load available slots.',
        }))
      })
  }

  const handleConfirmReschedule = async () => {
    const { appointment, date, slot, reason } = rescheduleModal
    if (!appointment || !date || !slot) return

    setRescheduleModal((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const response = await rescheduleAppointment(appointment._id, {
        date,
        time: slot,
        reason,
      })
      setNotice({
        severity: 'success',
        message:
          response.data.message || 'Appointment rescheduled successfully.',
      })
      setRescheduleModal({
        open: false,
        appointment: null,
        date: '',
        slot: '',
        reason: '',
        slots: [],
        slotsLoading: false,
        slotsError: '',
        submitting: false,
        error: '',
      })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setRescheduleModal((prev) => ({
        ...prev,
        submitting: false,
        error:
          err.response?.data?.message ||
          'Unable to reschedule appointment. The slot may no longer be available.',
      }))
    }
  }

  return (
    <Box component="section" sx={{ width: '100%' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={2}
        sx={{ width: '100%', mb: 3 }}
      >
        <Box>
          <Typography variant="h4">Appointments</Typography>
          <Typography color="text.secondary">
            View and manage your clinic appointments.
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/patient/appointments/book"
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            minWidth: { xs: '100%', sm: 190 },
            height: 44,
            borderRadius: 2,
            px: 2.25,
            fontWeight: 600,
          }}
        >
          Book Appointment
        </Button>
      </Stack>

      {location.state?.message && (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          {location.state.message} Status: Pending.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      <Paper
        sx={{
          width: '100%',
          p: { xs: 2, sm: 2.5 },
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={bucket}
          onChange={changeBucket}
          aria-label="Appointment history filter"
          sx={{ mb: 2 }}
        >
          <Tab label="Upcoming" value="upcoming" />
          <Tab label="History / Past" value="history" />
        </Tabs>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Doctor</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!appointments.length}
                colSpan={6}
                emptyMessage={
                  bucket === 'upcoming'
                    ? 'You have no upcoming appointments.'
                    : 'You have no appointment history yet.'
                }
              />
              {!loading &&
                appointments.map((appointment) => {
                  const isPendingOrConfirmed =
                    appointment.status === 'pending' ||
                    appointment.status === 'confirmed'
                  const diff =
                    new Date(appointment.startAt).getTime() - Date.now()
                  const isWithin6Hours = diff < SIX_HOURS_MS
                  const isPast = diff <= 0
                  const maxRescheduled =
                    (appointment.rescheduleCount || 0) >= 2
                  const canAct = isPendingOrConfirmed && !isPast

                  return (
                    <TableRow key={appointment._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {appointment.serviceId?.name || 'Service unavailable'}
                        </Typography>
                        {appointment.rescheduleCount > 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Rescheduled ({appointment.rescheduleCount}/2)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {appointment.doctorId
                          ? `Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
                          : 'Doctor unavailable'}
                      </TableCell>
                      <TableCell>{formatDate(appointment.startAt)}</TableCell>
                      <TableCell>
                        {formatTime(appointment.startAt)} –{' '}
                        {formatTime(appointment.endAt)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={appointment.status} />
                      </TableCell>
                      <TableCell align="right">
                        {canAct ? (
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Tooltip
                              title={
                                isWithin6Hours
                                  ? 'Appointments can only be changed at least 6 hours before the scheduled time.'
                                  : maxRescheduled
                                    ? 'Maximum 2 self-reschedules reached. Contact clinic for assistance.'
                                    : ''
                              }
                            >
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<EventRepeatOutlinedIcon />}
                                  disabled={isWithin6Hours || maxRescheduled}
                                  onClick={() => handleOpenReschedule(appointment)}
                                  sx={{ textTransform: 'none', fontWeight: 600 }}
                                >
                                  Reschedule
                                </Button>
                              </span>
                            </Tooltip>
                            <Tooltip
                              title={
                                isWithin6Hours
                                  ? 'Appointments can only be changed at least 6 hours before the scheduled time.'
                                  : ''
                              }
                            >
                              <span>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  startIcon={<HighlightOffOutlinedIcon />}
                                  disabled={isWithin6Hours}
                                  onClick={() => handleOpenCancel(appointment)}
                                  sx={{ textTransform: 'none', fontWeight: 600 }}
                                >
                                  Cancel
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ pt: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {pagination.total} appointment(s)
          </Typography>
          <Pagination
            page={page}
            count={pagination.totalPages}
            onChange={(_, value) => {
              setLoading(true)
              setPage(value)
            }}
            color="primary"
          />
        </Stack>
      </Paper>

      {/* Cancellation Dialog */}
      <Dialog
        open={cancelModal.open}
        onClose={
          cancelModal.loading
            ? undefined
            : () => setCancelModal((p) => ({ ...p, open: false }))
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancel Appointment</DialogTitle>
        <DialogContent dividers>
          {cancelModal.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cancelModal.error}
            </Alert>
          )}
          {cancelModal.appointment && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Are you sure you want to cancel your appointment with{' '}
                <strong>
                  Dr. {cancelModal.appointment.doctorId?.firstName}{' '}
                  {cancelModal.appointment.doctorId?.lastName}
                </strong>{' '}
                for{' '}
                <strong>{cancelModal.appointment.serviceId?.name}</strong> on{' '}
                <strong>{formatDate(cancelModal.appointment.startAt)}</strong> at{' '}
                <strong>{formatTime(cancelModal.appointment.startAt)}</strong>?
              </Typography>
              <Typography variant="caption" color="text.secondary">
                This slot will be released and made available for other patients.
              </Typography>
              <TextField
                label="Reason for cancellation (optional)"
                multiline
                rows={3}
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="Let us know why you are cancelling..."
                inputProps={{ maxLength: 500 }}
                helperText={`${cancelModal.reason.length}/500`}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setCancelModal((p) => ({ ...p, open: false }))}
            disabled={cancelModal.loading}
          >
            Keep Appointment
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmCancel}
            disabled={cancelModal.loading}
          >
            {cancelModal.loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog
        open={rescheduleModal.open}
        onClose={
          rescheduleModal.submitting
            ? undefined
            : () => setRescheduleModal((p) => ({ ...p, open: false }))
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reschedule Appointment</DialogTitle>
        <DialogContent dividers>
          {rescheduleModal.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rescheduleModal.error}
            </Alert>
          )}
          {rescheduleModal.appointment && (
            <Stack spacing={2.5}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Current Appointment:
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  Dr. {rescheduleModal.appointment.doctorId?.firstName}{' '}
                  {rescheduleModal.appointment.doctorId?.lastName} —{' '}
                  {rescheduleModal.appointment.serviceId?.name}
                </Typography>
                <Typography variant="body2">
                  {formatDate(rescheduleModal.appointment.startAt)} at{' '}
                  {formatTime(rescheduleModal.appointment.startAt)}
                </Typography>
                <Typography
                  variant="caption"
                  color="primary.main"
                  fontWeight={600}
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  {2 - (rescheduleModal.appointment.rescheduleCount || 0)}{' '}
                  self-reschedule(s) remaining
                </Typography>
              </Box>

              <TextField
                label="Select New Date"
                type="date"
                value={rescheduleModal.date}
                onChange={(e) => handleRescheduleDateChange(e.target.value)}
                inputProps={{
                  min: todayStr,
                  max: addDays(todayStr, 60),
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              {rescheduleModal.date && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Available 30-Minute Slots
                  </Typography>
                  {rescheduleModal.slotsLoading ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1,
                      }}
                    >
                      <CircularProgress size={20} />
                      <Typography variant="body2" color="text.secondary">
                        Checking doctor availability...
                      </Typography>
                    </Box>
                  ) : rescheduleModal.slotsError ? (
                    <Alert severity="error">
                      {rescheduleModal.slotsError}
                    </Alert>
                  ) : rescheduleModal.slots.length === 0 ? (
                    <Alert severity="info">
                      No available slots for this date. Please select another
                      date.
                    </Alert>
                  ) : (
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {rescheduleModal.slots.map((s) => (
                        <Button
                          key={s.time}
                          size="small"
                          variant={
                            rescheduleModal.slot === s.time
                              ? 'contained'
                              : 'outlined'
                          }
                          startIcon={<AccessTimeOutlinedIcon />}
                          onClick={() =>
                            setRescheduleModal((prev) => ({
                              ...prev,
                              slot: s.time,
                            }))
                          }
                          sx={{ minWidth: 90 }}
                        >
                          {formatSlotTime(s.time)}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              <TextField
                label="Reason for rescheduling (optional)"
                multiline
                rows={2}
                value={rescheduleModal.reason}
                onChange={(e) =>
                  setRescheduleModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="Provide a brief reason if desired..."
                inputProps={{ maxLength: 500 }}
                helperText={`${rescheduleModal.reason.length}/500`}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setRescheduleModal((p) => ({ ...p, open: false }))}
            disabled={rescheduleModal.submitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmReschedule}
            disabled={
              rescheduleModal.submitting ||
              !rescheduleModal.date ||
              !rescheduleModal.slot
            }
          >
            {rescheduleModal.submitting
              ? 'Rescheduling...'
              : 'Confirm Reschedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback */}
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
      >
        {notice && (
          <Alert
            severity={notice.severity}
            onClose={() => setNotice(null)}
            sx={{ width: '100%' }}
          >
            {notice.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  )
}

export default PatientAppointments
