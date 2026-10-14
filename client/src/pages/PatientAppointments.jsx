import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
  Box,
  Button,
  Pagination,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import { getMyAppointments } from '../services/appointmentApi'

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

function PatientAppointments() {
  const location = useLocation()
  const [bucket, setBucket] = useState('upcoming')
  const [page, setPage] = useState(1)
  const [appointments, setAppointments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
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
  }, [bucket, page])

  const changeBucket = (_, value) => {
    setLoading(true)
    setPage(1)
    setBucket(value)
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

      <Paper sx={{ width: '100%', p: { xs: 2, sm: 2.5 }, border: 1, borderColor: 'divider' }}>
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
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!appointments.length}
                colSpan={5}
                emptyMessage={
                  bucket === 'upcoming'
                    ? 'You have no upcoming appointments.'
                    : 'You have no appointment history yet.'
                }
              />
              {!loading &&
                appointments.map((appointment) => (
                  <TableRow key={appointment._id} hover>
                    <TableCell>
                      {appointment.serviceId?.name || 'Service unavailable'}
                    </TableCell>
                    <TableCell>
                      {appointment.doctorId
                        ? `Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
                        : 'Doctor unavailable'}
                    </TableCell>
                    <TableCell>{formatDate(appointment.startAt)}</TableCell>
                    <TableCell>
                      {formatTime(appointment.startAt)} – {formatTime(appointment.endAt)}
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
    </Box>
  )
}

export default PatientAppointments
