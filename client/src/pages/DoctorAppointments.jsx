import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import { getDoctorAppointments } from '../services/appointmentApi'

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

function DoctorAppointments() {
  const [bucket, setBucket] = useState('today')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [appointments, setAppointments] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDoctorAppointments({
      bucket,
      page,
      limit: 10,
      ...(date ? { date } : {}),
    })
      .then((response) => {
        if (!active) return
        setAppointments(response.data.data || [])
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
  }, [bucket, date, page])

  const changeBucket = (event) => {
    setLoading(true)
    setPage(1)
    setBucket(event.target.value)
  }

  const changeDate = (event) => {
    setLoading(true)
    setPage(1)
    setDate(event.target.value)
  }

  return (
    <Box component="section" className="doctor-page doctor-appointments-page" sx={{ width: '100%', minWidth: 0 }}>
      <Stack className="doctor-page-header" spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Appointments</Typography>
        <Typography color="text.secondary">
          View your scheduled clinic appointments.
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        className="doctor-filter-panel"
        sx={{
          p: 2,
          mb: 3,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="doctor-appointment-period">Period</InputLabel>
          <Select
            labelId="doctor-appointment-period"
            label="Period"
            value={bucket}
            onChange={changeBucket}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="upcoming">Upcoming</MenuItem>
            <MenuItem value="history">History</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Filter by date"
          type="date"
          value={date}
          onChange={changeDate}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
        />
        {date && (
          <Typography
            component="button"
            type="button"
            variant="body2"
            color="primary"
            onClick={() => {
              setLoading(true)
              setDate('')
              setPage(1)
            }}
            sx={{
              border: 0,
              p: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Clear date
          </Typography>
        )}
      </Paper>

      <Paper className="doctor-management-panel" sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Patient Number</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!appointments.length}
                colSpan={6}
                emptyMessage="No appointments found for this period."
              />
              {!loading &&
                appointments.map((appointment) => (
                  <TableRow key={appointment._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {formatTime(appointment.startAt)} –{' '}
                        {formatTime(appointment.endAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(appointment.startAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {appointment.patientId
                        ? `${appointment.patientId.firstName} ${appointment.patientId.lastName}`
                        : 'Patient unavailable'}
                    </TableCell>
                    <TableCell>
                      {appointment.patientId?.patientNumber || '—'}
                    </TableCell>
                    <TableCell>
                      {appointment.serviceId?.name || 'Service unavailable'}
                    </TableCell>
                    <TableCell>
                      {appointment.bookingType === 'walk_in'
                        ? 'Walk-In'
                        : 'Scheduled'}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={appointment.status} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            p: 2,
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
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
    </Box>
  )
}

export default DoctorAppointments
