import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import QueueOutlinedIcon from '@mui/icons-material/QueueOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
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
import { useEffect, useState } from 'react'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import TriageVitalsDialog from '../components/TriageVitalsDialog'
import useAuth from '../hooks/useAuth'
import {
  confirmAppointment,
  checkInAppointment,
  addAppointmentToQueue,
  getAppointments,
  rejectAppointment,
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

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const formatSlotTime = (timeStr) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(`2020-01-01T${timeStr}:00+08:00`))

function AppointmentsManagement() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [queueActionId, setQueueActionId] = useState('')
  const [triageAppointment, setTriageAppointment] = useState(null)

  // Confirm appointment modal
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    appointment: null,
    loading: false,
  })

  // Reject appointment modal
  const [rejectDialog, setRejectDialog] = useState({
    open: false,
    appointment: null,
    reason: '',
    loading: false,
    error: '',
  })

  // Staff reschedule modal
  const [rescheduleDialog, setRescheduleDialog] = useState({
    open: false,
    appointment: null,
    date: '',
    slot: '',
    reason: '',
    overrideReason: '',
    slots: [],
    slotsLoading: false,
    slotsError: '',
    loading: false,
    error: '',
  })

  // Detail / audit modal
  const [detailModal, setDetailModal] = useState({
    open: false,
    appointment: null,
  })

  const todayStr = getManilaToday()

  // Load appointments
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const params = { page, limit: 10 }
        if (search.trim()) params.search = search.trim()
        if (status) params.status = status
        if (date) params.date = date

        const response = await getAppointments(params)
        if (!Array.isArray(response.data?.data)) {
          throw new Error('The appointment response could not be read.')
        }
        if (active) {
          setRows(response.data.data)
          setPagination(
            response.data.pagination || { page: 1, totalPages: 1, total: 0 },
          )
          setNotice((current) =>
            current?.severity === 'error' ? null : current,
          )
        }
      } catch (err) {
        if (active) {
          setNotice({
            severity: 'error',
            message:
              err.response?.data?.message ||
              err.message ||
              'Unable to load appointments.',
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, search, status, date, refreshKey])

  // Confirm appointment action
  const handleOpenConfirm = (appointment) => {
    setConfirmDialog({
      open: true,
      appointment,
      loading: false,
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog.appointment) return
    setConfirmDialog((p) => ({ ...p, loading: true }))
    try {
      const response = await confirmAppointment(confirmDialog.appointment._id)
      setNotice({
        severity: 'success',
        message: response.data.message || 'Appointment confirmed successfully.',
      })
      setConfirmDialog({ open: false, appointment: null, loading: false })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setNotice({
        severity: 'error',
        message:
          err.response?.data?.message || 'Unable to confirm appointment.',
      })
      setConfirmDialog((p) => ({ ...p, loading: false }))
    }
  }

  const handleAppointmentQueueAction = async (appointment, action) => {
    setQueueActionId(appointment._id)
    try {
      const response =
        action === 'check-in'
          ? await checkInAppointment(appointment._id)
          : await addAppointmentToQueue(appointment._id)
      setNotice({
        severity: 'success',
        message:
          response.data.message ||
          (action === 'check-in'
            ? 'Appointment checked in successfully.'
            : 'Patient added to the queue.'),
      })
      setRefreshKey((current) => current + 1)
    } catch (err) {
      setNotice({
        severity: 'error',
        message:
          err.response?.data?.message ||
          (action === 'check-in'
            ? 'Unable to check in this appointment.'
            : 'Unable to add this patient to the queue.'),
      })
    } finally {
      setQueueActionId('')
    }
  }

  // Reject appointment action
  const handleOpenReject = (appointment) => {
    setRejectDialog({
      open: true,
      appointment,
      reason: '',
      loading: false,
      error: '',
    })
  }

  const handleRejectAction = async () => {
    if (!rejectDialog.appointment) return
    const trimmedReason = rejectDialog.reason.trim()
    if (!trimmedReason) {
      setRejectDialog((p) => ({
        ...p,
        error: 'A rejection reason is required.',
      }))
      return
    }

    setRejectDialog((p) => ({ ...p, loading: true, error: '' }))
    try {
      const response = await rejectAppointment(rejectDialog.appointment._id, {
        rejectionReason: trimmedReason,
      })
      setNotice({
        severity: 'success',
        message: response.data.message || 'Appointment rejected successfully.',
      })
      setRejectDialog({
        open: false,
        appointment: null,
        reason: '',
        loading: false,
        error: '',
      })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setRejectDialog((p) => ({
        ...p,
        loading: false,
        error:
          err.response?.data?.message || 'Unable to reject appointment.',
      }))
    }
  }

  // Staff Reschedule action
  const handleOpenReschedule = (appointment) => {
    setRescheduleDialog({
      open: true,
      appointment,
      date: '',
      slot: '',
      reason: '',
      overrideReason: '',
      slots: [],
      slotsLoading: false,
      slotsError: '',
      loading: false,
      error: '',
    })
  }

  const handleRescheduleDateChange = (newDate) => {
    setRescheduleDialog((prev) => ({
      ...prev,
      date: newDate,
      slot: '',
      slots: [],
      slotsError: '',
      slotsLoading: Boolean(newDate && prev.appointment),
      error: '',
    }))

    if (!newDate || !rescheduleDialog.appointment) return

    getAvailability({
      doctorId:
        rescheduleDialog.appointment.doctorId?._id ||
        rescheduleDialog.appointment.doctorId,
      serviceId:
        rescheduleDialog.appointment.serviceId?._id ||
        rescheduleDialog.appointment.serviceId,
      date: newDate,
    })
      .then((res) => {
        const availableSlots = (res.data.slots || []).filter((s) => s.available)
        setRescheduleDialog((prev) => ({
          ...prev,
          slots: availableSlots,
          slotsLoading: false,
        }))
      })
      .catch((err) => {
        setRescheduleDialog((prev) => ({
          ...prev,
          slots: [],
          slotsLoading: false,
          slotsError:
            err.response?.data?.message || 'Unable to load available slots.',
        }))
      })
  }

  const handleRescheduleAction = async () => {
    const { appointment, date: newDate, slot, reason, overrideReason } =
      rescheduleDialog
    if (!appointment || !newDate || !slot) return

    // Check if within 6 hours
    const currentDiff = new Date(appointment.startAt).getTime() - Date.now()
    const newSlotTime = new Date(`${newDate}T${slot}:00+08:00`).getTime()
    const newDiff = newSlotTime - Date.now()
    const needsOverride = currentDiff < SIX_HOURS_MS || newDiff < SIX_HOURS_MS

    if (needsOverride && !overrideReason.trim()) {
      setRescheduleDialog((prev) => ({
        ...prev,
        error:
          'An override reason is required to reschedule within 6 hours of the appointment time.',
      }))
      return
    }

    setRescheduleDialog((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const response = await rescheduleAppointment(appointment._id, {
        date: newDate,
        time: slot,
        reason,
        overrideReason: overrideReason.trim(),
      })
      setNotice({
        severity: 'success',
        message:
          response.data.message || 'Appointment rescheduled successfully.',
      })
      setRescheduleDialog({
        open: false,
        appointment: null,
        date: '',
        slot: '',
        reason: '',
        overrideReason: '',
        slots: [],
        slotsLoading: false,
        slotsError: '',
        loading: false,
        error: '',
      })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setRescheduleDialog((prev) => ({
        ...prev,
        loading: false,
        error:
          err.response?.data?.message ||
          'Unable to reschedule appointment. Slot may no longer be available.',
      }))
    }
  }

  return (
    <Box component="section" className={isAdmin ? 'admin-page admin-appointments-page' : user?.role === 'receptionist' ? 'receptionist-page' : undefined} sx={{ minWidth: 0 }}>
      {/* Responsive Header */}
      <Box
        className={isAdmin ? 'admin-page-header' : user?.role === 'receptionist' ? 'receptionist-page-header' : undefined}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'minmax(0, 1fr) auto',
          },
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4">Appointments</Typography>
          <Typography color="text.secondary">
            Manage clinic appointments.
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Paper
        className={isAdmin ? 'admin-filter-panel' : user?.role === 'receptionist' ? 'receptionist-filter-panel' : undefined}
        sx={{
          p: 2,
          mb: 3,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          label="Search Patient or Doctor"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          sx={{ minWidth: { xs: '100%', sm: 260 } }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="checked_in">Checked In</MenuItem>
            <MenuItem value="waiting">Waiting</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Filter by Date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPage(1)
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 170 }}
        />
        {(search || status || date) && (
          <Button
            size="small"
            onClick={() => {
              setSearch('')
              setStatus('')
              setDate('')
              setPage(1)
            }}
            sx={{ textTransform: 'none' }}
          >
            Reset Filters
          </Button>
        )}
      </Paper>

      {/* Appointments Table */}
      <Paper className={isAdmin ? 'admin-management-panel' : user?.role === 'receptionist' ? 'receptionist-management-panel' : undefined} sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Doctor</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Date & Time</TableCell>
                <TableCell>Booking Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!rows.length}
                colSpan={7}
                emptyMessage="No appointments found."
              />
              {!loading &&
                rows.map((row) => {
                  const isPending = row.status === 'pending'
                  const isConfirmed = row.status === 'confirmed'
                  const canReschedule = isPending || isConfirmed
                  const isScheduled = row.bookingType === 'scheduled'
                  const canCheckIn =
                    isScheduled &&
                    isConfirmed &&
                    new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Asia/Manila',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(new Date(row.startAt)) === todayStr
                  const canAddToQueue =
                    isScheduled && row.status === 'checked_in'
                  const canRecordVitals = ['checked_in', 'waiting'].includes(
                    row.status,
                  )

                  return (
                    <TableRow key={row._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.patientId
                            ? `${row.patientId.firstName} ${row.patientId.lastName}`
                            : 'Patient profile'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.patientId?.patientNumber || '—'}
                          {row.patientId?.mobileNumber
                            ? ` • ${row.patientId.mobileNumber}`
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {row.doctorId
                            ? `Dr. ${row.doctorId.firstName} ${row.doctorId.lastName}`
                            : 'Doctor unavailable'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.doctorId?.specialization || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {row.serviceId?.name || 'Service unavailable'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.serviceId?.durationMinutes} mins
                          {row.serviceId?.fee
                            ? ` • ₱${row.serviceId.fee.toLocaleString()}`
                            : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {formatDate(row.startAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(row.startAt)} – {formatTime(row.endAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.bookingType === 'walk_in' ? 'Walk-In' : 'Scheduled'}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={row.status} />
                        <Typography
                          variant="caption"
                          color={row.triage?.recordedAt ? 'success.main' : 'text.secondary'}
                          sx={{ display: 'block', mt: 0.75 }}
                        >
                          Vitals: {row.triage?.recordedAt ? '✓ Recorded' : 'Not recorded'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          sx={{ justifyContent: 'flex-end' }}
                        >
                          {isPending && (
                            <>
                              <Tooltip title="Confirm Appointment">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleOpenConfirm(row)}
                                >
                                  <CheckCircleOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject Appointment">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleOpenReject(row)}
                                >
                                  <CloseOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {canReschedule && (
                            <Tooltip title="Reschedule">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenReschedule(row)}
                              >
                                <EventRepeatOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canCheckIn && (
                            <Tooltip title="Check in patient">
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  disabled={Boolean(queueActionId)}
                                  onClick={() =>
                                    handleAppointmentQueueAction(
                                      row,
                                      'check-in',
                                    )
                                  }
                                >
                                  <HowToRegOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {canAddToQueue && (
                            <Tooltip title="Add checked-in patient to queue">
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  disabled={Boolean(queueActionId)}
                                  onClick={() =>
                                    handleAppointmentQueueAction(
                                      row,
                                      'queue',
                                    )
                                  }
                                >
                                  <QueueOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {canRecordVitals && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setTriageAppointment(row)}
                            >
                              {row.triage?.recordedAt
                                ? 'View / Update Vitals'
                                : 'Record Vitals'}
                            </Button>
                          )}
                          <Tooltip title="View Details & Audit Log">
                            <IconButton
                              size="small"
                              onClick={() =>
                                setDetailModal({ open: true, appointment: row })
                              }
                            >
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack
          className={isAdmin ? 'admin-pagination' : undefined}
          direction="row"
          sx={{
            p: 2,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {pagination.total} appointment(s)
          </Typography>
          <Pagination
            page={page}
            count={pagination.totalPages}
            onChange={(_, val) => setPage(val)}
            color="primary"
          />
        </Stack>
      </Paper>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title="Confirm Appointment"
        message={
          confirmDialog.appointment
            ? `Confirm booking for ${
                confirmDialog.appointment.patientId?.firstName || 'Patient'
              } ${
                confirmDialog.appointment.patientId?.lastName || ''
              } with Dr. ${
                confirmDialog.appointment.doctorId?.firstName || ''
              } ${confirmDialog.appointment.doctorId?.lastName || ''} on ${formatDate(
                confirmDialog.appointment.startAt,
              )} at ${formatTime(confirmDialog.appointment.startAt)}?`
            : 'Confirm appointment?'
        }
        confirmLabel="Confirm"
        loading={confirmDialog.loading}
        onCancel={() =>
          setConfirmDialog({ open: false, appointment: null, loading: false })
        }
        onConfirm={handleConfirmAction}
      />

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onClose={
          rejectDialog.loading
            ? undefined
            : () => setRejectDialog((p) => ({ ...p, open: false }))
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Appointment</DialogTitle>
        <DialogContent dividers>
          {rejectDialog.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rejectDialog.error}
            </Alert>
          )}
          {rejectDialog.appointment && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Rejecting this appointment will release the reserved slot back
                into availability for other patients.
              </Typography>
              <TextField
                label="Rejection Reason"
                required
                multiline
                rows={3}
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="Explain why this appointment is being rejected (required)..."
                inputProps={{ maxLength: 500 }}
                helperText={`${rejectDialog.reason.length}/500`}
                error={Boolean(rejectDialog.error && !rejectDialog.reason.trim())}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setRejectDialog((p) => ({ ...p, open: false }))}
            disabled={rejectDialog.loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectAction}
            disabled={rejectDialog.loading || !rejectDialog.reason.trim()}
          >
            {rejectDialog.loading ? 'Rejecting...' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Staff Reschedule Dialog */}
      <Dialog
        open={rescheduleDialog.open}
        onClose={
          rescheduleDialog.loading
            ? undefined
            : () => setRescheduleDialog((p) => ({ ...p, open: false }))
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Staff Reschedule Appointment</DialogTitle>
        <DialogContent dividers>
          {rescheduleDialog.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rescheduleDialog.error}
            </Alert>
          )}
          {rescheduleDialog.appointment && (() => {
            const currentDiff =
              new Date(rescheduleDialog.appointment.startAt).getTime() -
              Date.now()
            const newSlotTime =
              rescheduleDialog.date && rescheduleDialog.slot
                ? new Date(
                    `${rescheduleDialog.date}T${rescheduleDialog.slot}:00+08:00`,
                  ).getTime()
                : Infinity
            const newDiff = newSlotTime - Date.now()
            const isInside6Hours =
              currentDiff < SIX_HOURS_MS || newDiff < SIX_HOURS_MS

            return (
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
                    Appointment Details:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    Patient:{' '}
                    {rescheduleDialog.appointment.patientId?.firstName}{' '}
                    {rescheduleDialog.appointment.patientId?.lastName}
                  </Typography>
                  <Typography variant="body2">
                    Doctor: Dr.{' '}
                    {rescheduleDialog.appointment.doctorId?.firstName}{' '}
                    {rescheduleDialog.appointment.doctorId?.lastName} • Service:{' '}
                    {rescheduleDialog.appointment.serviceId?.name}
                  </Typography>
                  <Typography variant="body2">
                    Current Time:{' '}
                    {formatDate(rescheduleDialog.appointment.startAt)} at{' '}
                    {formatTime(rescheduleDialog.appointment.startAt)}
                  </Typography>
                </Box>

                {isInside6Hours && (
                  <Alert severity="warning">
                    This appointment is within 6 hours of the scheduled time. An
                    override reason is required to reschedule.
                  </Alert>
                )}

                <TextField
                  label="Select New Date"
                  type="date"
                  value={rescheduleDialog.date}
                  onChange={(e) => handleRescheduleDateChange(e.target.value)}
                  inputProps={{
                    min: todayStr,
                    max: addDays(todayStr, 60),
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />

                {rescheduleDialog.date && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Available 30-Minute Slots
                    </Typography>
                    {rescheduleDialog.slotsLoading ? (
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
                          Checking schedule...
                        </Typography>
                      </Box>
                    ) : rescheduleDialog.slotsError ? (
                      <Alert severity="error">
                        {rescheduleDialog.slotsError}
                      </Alert>
                    ) : rescheduleDialog.slots.length === 0 ? (
                      <Alert severity="info">
                        No available slots for this date.
                      </Alert>
                    ) : (
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {rescheduleDialog.slots.map((s) => (
                          <Button
                            key={s.time}
                            size="small"
                            variant={
                              rescheduleDialog.slot === s.time
                                ? 'contained'
                                : 'outlined'
                            }
                            startIcon={<AccessTimeOutlinedIcon />}
                            onClick={() =>
                              setRescheduleDialog((prev) => ({
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

                {isInside6Hours && (
                  <TextField
                    label="Override Reason (Required)"
                    required
                    multiline
                    rows={2}
                    value={rescheduleDialog.overrideReason}
                    onChange={(e) =>
                      setRescheduleDialog((prev) => ({
                        ...prev,
                        overrideReason: e.target.value,
                      }))
                    }
                    placeholder="State reason for overriding the 6-hour policy..."
                    inputProps={{ maxLength: 500 }}
                    helperText={`${rescheduleDialog.overrideReason.length}/500`}
                    error={Boolean(
                      rescheduleDialog.error &&
                        !rescheduleDialog.overrideReason.trim(),
                    )}
                    fullWidth
                  />
                )}

                <TextField
                  label="General Reschedule Reason (Optional)"
                  multiline
                  rows={2}
                  value={rescheduleDialog.reason}
                  onChange={(e) =>
                    setRescheduleDialog((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Additional notes..."
                  inputProps={{ maxLength: 500 }}
                  helperText={`${rescheduleDialog.reason.length}/500`}
                  fullWidth
                />
              </Stack>
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setRescheduleDialog((p) => ({ ...p, open: false }))}
            disabled={rescheduleDialog.loading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRescheduleAction}
            disabled={
              rescheduleDialog.loading ||
              !rescheduleDialog.date ||
              !rescheduleDialog.slot
            }
          >
            {rescheduleDialog.loading ? 'Saving...' : 'Confirm Reschedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details & Status History Dialog */}
      <Dialog
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, appointment: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Appointment Details</DialogTitle>
        <DialogContent dividers>
          {detailModal.appointment && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <StatusChip status={detailModal.appointment.status} />
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2">Patient</Typography>
                <Typography variant="body2">
                  {detailModal.appointment.patientId?.firstName}{' '}
                  {detailModal.appointment.patientId?.lastName} (
                  {detailModal.appointment.patientId?.patientNumber || 'No ID'})
                </Typography>
                {detailModal.appointment.patientId?.mobileNumber && (
                  <Typography variant="caption" color="text.secondary">
                    Mobile: {detailModal.appointment.patientId.mobileNumber}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle2">Doctor & Service</Typography>
                <Typography variant="body2">
                  Dr. {detailModal.appointment.doctorId?.firstName}{' '}
                  {detailModal.appointment.doctorId?.lastName} —{' '}
                  {detailModal.appointment.serviceId?.name}
                </Typography>
                <Typography variant="body2">
                  {formatDate(detailModal.appointment.startAt)} at{' '}
                  {formatTime(detailModal.appointment.startAt)} –{' '}
                  {formatTime(detailModal.appointment.endAt)}
                </Typography>
              </Box>

              {detailModal.appointment.reasonForVisit && (
                <Box>
                  <Typography variant="subtitle2">Reason for Visit</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {detailModal.appointment.reasonForVisit}
                  </Typography>
                </Box>
              )}

              {detailModal.appointment.rejectionReason && (
                <Box>
                  <Typography variant="subtitle2" color="error.main">
                    Rejection Reason
                  </Typography>
                  <Typography variant="body2">
                    {detailModal.appointment.rejectionReason}
                  </Typography>
                </Box>
              )}

              {detailModal.appointment.cancellationReason && (
                <Box>
                  <Typography variant="subtitle2" color="error.main">
                    Cancellation Reason
                  </Typography>
                  <Typography variant="body2">
                    {detailModal.appointment.cancellationReason}
                  </Typography>
                </Box>
              )}

              {detailModal.appointment.overrideReason && (
                <Box>
                  <Typography variant="subtitle2" color="warning.main">
                    Staff Override Reason
                  </Typography>
                  <Typography variant="body2">
                    {detailModal.appointment.overrideReason}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Status History / Audit Log
                </Typography>
                {Array.isArray(detailModal.appointment.statusHistory) &&
                detailModal.appointment.statusHistory.length ? (
                  <Stack spacing={1}>
                    {detailModal.appointment.statusHistory.map(
                      (item, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1.25,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            fontSize: '0.85rem',
                          }}
                        >
                          <Stack
                            direction="row"
                            sx={{
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <StatusChip status={item.status} />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {formatDateTime(item.changedAt)}
                            </Typography>
                          </Stack>
                          {item.role && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ mt: 0.5 }}
                            >
                              By: {item.role}{' '}
                              {item.changedBy?.firstName
                                ? `(${item.changedBy.firstName} ${item.changedBy.lastName})`
                                : ''}
                            </Typography>
                          )}
                          {item.reason && (
                            <Typography
                              variant="body2"
                              sx={{ mt: 0.5, fontStyle: 'italic' }}
                            >
                              &quot;{item.reason}&quot;
                            </Typography>
                          )}
                        </Box>
                      ),
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No status history recorded.
                  </Typography>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setDetailModal({ open: false, appointment: null })}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <TriageVitalsDialog
        key={`${triageAppointment?._id || 'closed'}-${triageAppointment?.triage?.recordedAt || ''}`}
        appointment={triageAppointment}
        open={Boolean(triageAppointment)}
        onClose={() => setTriageAppointment(null)}
        onSaved={(_, message) => {
          setTriageAppointment(null)
          setNotice({ severity: 'success', message })
          setRefreshKey((current) => current + 1)
        }}
      />

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

export default AppointmentsManagement
