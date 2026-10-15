import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import QueueOutlinedIcon from '@mui/icons-material/QueueOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import useAuth from '../hooks/useAuth'
import {
  getMyQueue,
  getAppointments,
  getQueue,
  startConsultation,
} from '../services/appointmentApi'
import { getDashboard, getReports } from '../services/dashboardApi'

const roleCopy = {
  patient: 'Your appointments and care records, in one place.',
  receptionist: 'Today’s clinic operations at a glance.',
  doctor: 'Your appointments and clinical workload today.',
  admin: 'Clinic-wide activity and operational overview.',
}

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const manilaDateKey = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const getGreeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat('en-PH', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Manila',
    }).format(new Date()),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const patientActions = [
  { label: 'Book Appointment', caption: 'Choose a service and available schedule.', to: '/patient/appointments/book', icon: CalendarMonthOutlinedIcon },
  { label: 'Medical History', caption: 'Review your completed consultations.', to: '/patient/medical-history', icon: HistoryEduOutlinedIcon },
  { label: 'Prescriptions', caption: 'View prescriptions issued by your doctors.', to: '/patient/prescriptions', icon: ReceiptLongOutlinedIcon },
]

function PatientDashboard({ user, dashboard, loading, error }) {
  const appointment = dashboard?.nextAppointment

  return (
    <Box component="section" className="patient-page patient-dashboard">
      <Box className="patient-dashboard-heading">
        <Typography component="h1" variant="h4">
          {getGreeting()}, {user?.firstName || 'there'} <span aria-hidden="true">👋</span>
        </Typography>
        <Typography color="text.secondary">
          Here is an overview of your upcoming care and health records.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Paper className="patient-next-appointment">
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              gap={3}
              sx={{
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'center' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography className="patient-card-eyebrow">Next Appointment</Typography>
                {appointment ? (
                  <>
                    <Typography variant="h5" fontWeight={700}>
                      {appointment.serviceId?.name || 'Clinic Appointment'}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {appointment.doctorId
                        ? `Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
                        : 'Doctor to be confirmed'}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="h5" fontWeight={700}>No upcoming appointment</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Book a visit when you are ready.
                    </Typography>
                  </>
                )}
              </Box>
              {appointment && (
                <Stack className="patient-appointment-meta" spacing={1}>
                  <Typography fontWeight={700}>{formatDateTime(appointment.startAt)}</Typography>
                  <StatusChip status={appointment.status} />
                </Stack>
              )}
              <Button
                component={RouterLink}
                to={appointment ? '/patient/appointments' : '/patient/appointments/book'}
                variant={appointment ? 'outlined' : 'contained'}
                endIcon={<ArrowForwardOutlinedIcon />}
              >
                {appointment ? 'View Details' : 'Book Appointment'}
              </Button>
            </Stack>
          </Paper>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Quick Actions</Typography>
            <Grid container spacing={2}>
              {patientActions.map(({ label, caption, to, icon: Icon }) => (
                <Grid key={to} size={{ xs: 12, sm: 4 }}>
                  <Paper component={RouterLink} to={to} className="patient-quick-action">
                    <span className="patient-quick-action-icon"><Icon /></span>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700}>{label}</Typography>
                      <Typography variant="body2" color="text.secondary">{caption}</Typography>
                    </Box>
                    <ArrowForwardOutlinedIcon className="patient-action-arrow" />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Paper className="patient-brand-message">
            <Typography variant="overline">Maxicare Clinic</Typography>
            <Typography variant="h5">Living your best life</Typography>
            <Typography>
              Your appointments, clinical records, and prescriptions are available in one secure place.
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  )
}

function DoctorDashboard({ user, dashboard, loading, error }) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [starting, setStarting] = useState(false)
  const activeConsultation = dashboard?.activeConsultation
  const upcomingAppointments = dashboard?.upcomingAppointments || []
  const nextAppointment = upcomingAppointments[0]
  const todayKey = manilaDateKey(new Date())
  const todayAppointments = upcomingAppointments.filter(
    (appointment) => manilaDateKey(appointment.startAt) === todayKey,
  )
  const nextQueueEntry =
    queue.find((entry) => entry.queueStatus === 'called') || queue[0]
  const patient = activeConsultation?.patientId || nextQueueEntry?.patientId
  const patientInitials = `${patient?.firstName?.[0] || ''}${patient?.lastName?.[0] || ''}`

  useEffect(() => {
    let active = true
    getMyQueue()
      .then((response) => {
        if (!active) return
        setQueue(response.data.data || [])
        setQueueError('')
      })
      .catch((requestError) => {
        if (!active) return
        setQueueError(
          requestError.response?.data?.message || 'Unable to load your queue.',
        )
      })
      .finally(() => {
        if (active) setQueueLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleStartConsultation = async () => {
    setStarting(true)
    setQueueError('')
    try {
      const response = await startConsultation(nextQueueEntry._id)
      navigate(`/doctor/consultations/${response.data.data._id}`)
    } catch (requestError) {
      setQueueError(
        requestError.response?.data?.message ||
          'Unable to start this consultation.',
      )
      setStarting(false)
    }
  }

  return (
    <Box component="section" className="doctor-page doctor-dashboard">
      <Box className="doctor-page-header">
        <Box>
          <Typography color="text.secondary" fontWeight={600}>{getGreeting()},</Typography>
          <Typography component="h1" variant="h4">
            Dr. {user?.firstName || 'Doctor'}
          </Typography>
          <Typography color="text.secondary">
            Today&apos;s appointments and clinical workload.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <Box className="doctor-metric-grid">
            {[
              ["Today's Appointments", dashboard?.todayAppointments],
              ['Waiting Now', dashboard?.waitingCalledQueueCount],
              ['Completed Today', dashboard?.completedConsultationsToday],
              ['Next Appointment', nextAppointment ? formatDateTime(nextAppointment.startAt) : 'None'],
            ].map(([title, value]) => (
              <Paper key={title} className="doctor-metric-card">
                  <Typography variant="body2" color="text.secondary">{title}</Typography>
                  <Typography variant="h5" fontWeight={750}>{value ?? '—'}</Typography>
              </Paper>
            ))}
          </Box>

          <Box className="doctor-dashboard-grid">
            <Paper className="doctor-dashboard-panel doctor-current-patient">
              <Typography variant="h6">
                {activeConsultation ? 'Current Patient' : 'Next Patient'}
              </Typography>
              {activeConsultation ? (
                <Stack direction="row" spacing={2} sx={{ mt: 2.5, alignItems: 'center' }}>
                  <Avatar className="doctor-patient-avatar">{patientInitials || 'P'}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={750}>
                      {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient unavailable'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {patient?.patientNumber || 'Patient number unavailable'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {activeConsultation.serviceId?.name || 'Consultation'}
                    </Typography>
                  </Box>
                  <Button
                    component={RouterLink}
                    to={`/doctor/consultations/${activeConsultation._id}`}
                    variant="contained"
                    endIcon={<ArrowForwardOutlinedIcon />}
                  >
                    Continue
                  </Button>
                </Stack>
              ) : nextQueueEntry ? (
                <Stack direction="row" spacing={2} sx={{ mt: 2.5, alignItems: 'center' }}>
                  <Avatar className="doctor-patient-avatar">{patientInitials || 'P'}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={750}>
                      {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient unavailable'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {patient?.patientNumber || 'Patient number unavailable'} ·{' '}
                      {nextQueueEntry.serviceId?.name || 'Service unavailable'}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                      <Typography variant="body2">
                        Joined {formatTime(nextQueueEntry.joinedAt)}
                      </Typography>
                      <StatusChip status={nextQueueEntry.queueStatus} />
                    </Stack>
                  </Box>
                  {nextQueueEntry.queueStatus === 'called' ? (
                    <Button
                      variant="contained"
                      disabled={starting}
                      onClick={handleStartConsultation}
                      endIcon={<ArrowForwardOutlinedIcon />}
                    >
                      {starting ? 'Starting…' : 'Start Consultation'}
                    </Button>
                  ) : (
                    <Button component={RouterLink} to="/doctor/queue" variant="outlined">
                      View Queue
                    </Button>
                  )}
                </Stack>
              ) : (
                <Box className="doctor-empty-state">
                  <Typography fontWeight={650}>
                    {queueLoading ? 'Loading your queue…' : 'No patient is waiting'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {queueError || 'Your assigned queue is currently clear.'}
                  </Typography>
                </Box>
              )}
              {queueError && nextQueueEntry && (
                <Alert severity="error" sx={{ mt: 2 }}>{queueError}</Alert>
              )}
            </Paper>

            <Paper className="doctor-dashboard-panel">
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Today&apos;s Remaining Schedule</Typography>
                <Button component={RouterLink} to="/doctor/appointments" size="small">View all</Button>
              </Stack>
              {todayAppointments.length ? (
                <Stack className="doctor-schedule-list" divider={<Box className="doctor-list-divider" />}>
                  {todayAppointments.map((appointment) => (
                    <Stack key={appointment._id} direction="row" gap={2} sx={{ justifyContent: 'space-between' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={650}>
                          {appointment.patientId
                            ? `${appointment.patientId.firstName} ${appointment.patientId.lastName}`
                            : 'Patient unavailable'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(appointment.startAt)} · {appointment.serviceId?.name || 'Service'}
                        </Typography>
                      </Box>
                      <StatusChip status={appointment.status} />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Box className="doctor-empty-state"><Typography color="text.secondary">No remaining appointments today.</Typography></Box>
              )}
            </Paper>
          </Box>
        </>
      )}
    </Box>
  )
}

function AdminDashboard({ dashboard, loading, error }) {
  const [report, setReport] = useState(null)
  const [recentAppointments, setRecentAppointments] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState('')

  useEffect(() => {
    let active = true
    const today = manilaDateKey(new Date())
    Promise.all([
      getReports({ from: today, to: today }),
      getAppointments({ date: today, page: 1, limit: 5 }),
    ])
      .then(([reportResponse, appointmentResponse]) => {
        if (!active) return
        setReport(reportResponse.data.data)
        setRecentAppointments(
          Array.isArray(appointmentResponse.data.data)
            ? appointmentResponse.data.data
            : [],
        )
        setInsightsError('')
      })
      .catch((requestError) => {
        if (!active) return
        setInsightsError(
          requestError.response?.data?.message ||
            'Unable to load today’s clinic overview.',
        )
      })
      .finally(() => {
        if (active) setInsightsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const statusRows = Object.entries(
    report?.appointmentSummary?.byStatus ||
      dashboard?.appointmentStatusSummary ||
      {},
  )
  const bookingTypes = report?.appointmentSummary?.bookingTypes || {}

  return (
    <Box component="section" className="admin-page admin-dashboard">
      <Box className="admin-page-header">
        <Box>
          <Typography component="h1" variant="h4">Welcome back, Admin!</Typography>
          <Typography color="text.secondary">
            Clinic operations and activity at a glance.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            component={RouterLink}
            to="/admin/walk-ins"
            variant="contained"
            startIcon={<PersonAddAltOutlinedIcon />}
          >
            Walk-In Patient
          </Button>
          <Button
            component={RouterLink}
            to="/admin/queue"
            variant="outlined"
            startIcon={<QueueOutlinedIcon />}
          >
            View Queue
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box className="admin-summary-grid">
            {[
              ['Total Patients', dashboard?.totalPatients, '/admin/patients'],
              ['Active Doctors', dashboard?.activeDoctors, '/admin/doctors'],
              ["Today's Appointments", dashboard?.todayAppointments, '/admin/appointments'],
              ['Walk-Ins Today', dashboard?.walkInsToday, '/admin/walk-ins'],
            ].map(([title, value, to]) => (
              <Paper key={title} component={RouterLink} to={to} className="admin-summary-card">
                <Typography variant="body2" color="text.secondary">{title}</Typography>
                <Typography variant="h4">{value ?? '—'}</Typography>
              </Paper>
            ))}
          </Box>

          {insightsError && <Alert severity="warning" sx={{ mt: 2.5 }}>{insightsError}</Alert>}
          <Box className="admin-dashboard-grid">
            <Paper className="admin-dashboard-panel">
              <Typography variant="h6">Appointment Overview</Typography>
              <Typography variant="body2" color="text.secondary">
                Today’s appointments by current status.
              </Typography>
              {insightsLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : statusRows.length ? (
                <Box className="admin-status-grid">
                  {statusRows.map(([status, count]) => (
                    <Box key={status} className="admin-status-item">
                      <StatusChip status={status} />
                      <Typography fontWeight={750}>{count}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography color="text.secondary" sx={{ py: 4 }}>
                  No appointments today.
                </Typography>
              )}
            </Paper>

            <Paper className="admin-dashboard-panel">
              <Typography variant="h6">Scheduled vs Walk-In</Typography>
              <Typography variant="body2" color="text.secondary">
                Real booking totals for today.
              </Typography>
              <Box className="admin-booking-summary">
                <Box>
                  <Typography variant="h4" fontWeight={750}>
                    {bookingTypes.scheduled ?? 0}
                  </Typography>
                  <Typography color="text.secondary">Scheduled</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="h4" fontWeight={750}>
                    {bookingTypes.walk_in ?? 0}
                  </Typography>
                  <Typography color="text.secondary">Walk-In</Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          <Paper className="admin-management-panel admin-recent-appointments">
            <Stack direction="row" sx={{ p: 2.5, justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6">Recent Appointments</Typography>
                <Typography variant="body2" color="text.secondary">Latest appointments scheduled today.</Typography>
              </Box>
              <Button component={RouterLink} to="/admin/appointments">View All</Button>
            </Stack>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {insightsLoading ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                  ) : recentAppointments.length ? (
                    recentAppointments.map((appointment) => (
                      <TableRow key={appointment._id} hover>
                        <TableCell>{formatDateTime(appointment.startAt)}</TableCell>
                        <TableCell>
                          {appointment.patientId
                            ? `${appointment.patientId.firstName} ${appointment.patientId.lastName}`
                            : 'Patient unavailable'}
                        </TableCell>
                        <TableCell>
                          {appointment.doctorId
                            ? `Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`
                            : 'Doctor unavailable'}
                        </TableCell>
                        <TableCell>{appointment.serviceId?.name || 'Service unavailable'}</TableCell>
                        <TableCell><StatusChip status={appointment.status} /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No appointments today.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  )
}

function MetricCard({ title, value, subtitle, to, gridItem = true }) {
  const content = (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        ...(to && {
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
        }),
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
          {value ?? '—'}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
  const card = (
    to ? (
      <Box component={RouterLink} to={to} sx={{ display: 'block', height: '100%', textDecoration: 'none' }}>
        {content}
      </Box>
    ) : content
  )

  return gridItem ? (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      {card}
    </Grid>
  ) : card
}

function ReceptionistDashboard({ user, dashboard, loading, error }) {
  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')

  useEffect(() => {
    let active = true
    getQueue()
      .then((response) => {
        if (active) {
          setQueue(response.data.data || [])
          setQueueError('')
        }
      })
      .catch((requestError) => {
        if (active) {
          setQueueError(
            requestError.response?.data?.message ||
              'Unable to load today’s queue.',
          )
        }
      })
      .finally(() => {
        if (active) setQueueLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const statusCounts = dashboard?.today?.statusCounts || {}
  const waitingCount = queue.filter(
    (entry) => entry.queueStatus === 'waiting',
  ).length
  const activeQueueCount = dashboard?.activeQueueCount
  const dashboardStatusValue = (status) =>
    dashboard ? statusCounts[status] ?? 0 : '—'

  return (
    <Box
      component="section"
      className="receptionist-page receptionist-dashboard"
    >
      <Box className="receptionist-page-header receptionist-dashboard-header">
        <Box>
          <Typography component="h1" variant="h4">
            {getGreeting()}, {user?.firstName || 'there'}!
          </Typography>
          <Typography color="text.secondary">
            Today’s clinic operations at a glance.
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/receptionist/walk-ins"
          variant="contained"
        >
          Walk-In Patient
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box className="receptionist-summary-grid">
              <MetricCard
                title="Today’s Appointments"
                value={dashboard?.today?.appointments ?? '—'}
                to="/receptionist/appointments"
                gridItem={false}
              />
              <MetricCard
                title="Walk-Ins Today"
                value={dashboard?.walkInsToday ?? '—'}
                to="/receptionist/walk-ins"
                gridItem={false}
              />
              <MetricCard
                title="Waiting"
                value={queueLoading || queueError ? '—' : waitingCount}
                to="/receptionist/queue"
                gridItem={false}
              />
              <MetricCard
                title="Active Queue"
                value={activeQueueCount ?? '—'}
                to="/receptionist/queue"
                gridItem={false}
              />
          </Box>

          <Paper className="receptionist-status-summary" sx={{ mt: 2 }}>
            {[
              ['Pending', dashboardStatusValue('pending')],
              ['Confirmed', dashboardStatusValue('confirmed')],
              ['Checked In', dashboardStatusValue('checked_in')],
              ['In Consultation', dashboardStatusValue('in_consultation')],
            ].map(([label, count]) => (
              <Box key={label} className="receptionist-status-summary-item">
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography fontWeight={700}>{count ?? 0}</Typography>
              </Box>
            ))}
          </Paper>

          <Paper className="receptionist-management-panel receptionist-queue-preview" sx={{ mt: 3 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{
                p: 2.5,
                pb: 2,
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', sm: 'center' },
              }}
            >
              <Box>
                <Typography variant="h6">Today’s Queue</Typography>
                <Typography variant="body2" color="text.secondary">
                  {queueLoading
                    ? 'Loading queue…'
                    : queueError
                    ? 'Queue information is unavailable.'
                    : `${queue.length} active queue ${queue.length === 1 ? 'entry' : 'entries'}`}
                </Typography>
              </Box>
              <Button component={RouterLink} to="/receptionist/queue">
                View Queue
              </Button>
            </Stack>
            {queueError && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>{queueError}</Alert>}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Position</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Joined</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : queueError ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Queue information could not be loaded.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : queue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No active queue entries right now.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    queue.map((entry) => (
                      <TableRow key={entry._id} hover>
                        <TableCell>{entry.queuePosition}</TableCell>
                        <TableCell>
                          {entry.patientId
                            ? `${entry.patientId.firstName} ${entry.patientId.lastName}`
                            : 'Patient profile'}
                        </TableCell>
                        <TableCell>
                          {entry.doctorId
                            ? `Dr. ${entry.doctorId.firstName} ${entry.doctorId.lastName}`
                            : '—'}
                        </TableCell>
                        <TableCell>{entry.serviceId?.name || '—'}</TableCell>
                        <TableCell>{formatDateTime(entry.joinedAt)}</TableCell>
                        <TableCell><StatusChip status={entry.queueStatus} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            className="receptionist-quick-links"
          >
            <Button component={RouterLink} to="/receptionist/appointments" variant="outlined">
              Appointments
            </Button>
            <Button component={RouterLink} to="/receptionist/walk-ins" variant="outlined">
              Walk-Ins
            </Button>
            <Button component={RouterLink} to="/receptionist/queue" variant="outlined">
              Queue
            </Button>
          </Stack>
        </>
      )}
    </Box>
  )
}

function RoleDashboard() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDashboard()
      .then((response) => {
        if (active) {
          setDashboard(response.data.data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load dashboard.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.role])

  const role = user?.role
  const statusCounts = dashboard?.today?.statusCounts
  const adminStatuses = dashboard?.appointmentStatusSummary

  let metrics = []
  let quickLinks = []
  if (role === 'patient' && dashboard) {
    metrics = [
      {
        title: 'Next Appointment',
        value: dashboard.nextAppointment
          ? formatDateTime(dashboard.nextAppointment.startAt)
          : 'None',
        subtitle: dashboard.nextAppointment
          ? `${dashboard.nextAppointment.serviceId?.name || 'Appointment'} · ${dashboard.nextAppointment.doctorId ? `Dr. ${dashboard.nextAppointment.doctorId.firstName} ${dashboard.nextAppointment.doctorId.lastName}` : 'Doctor TBD'}`
          : 'No upcoming visits scheduled',
        to: '/patient/appointments',
      },
      {
        title: 'Upcoming Appointments',
        value: dashboard.upcomingCount,
        to: '/patient/appointments',
      },
      {
        title: 'Recent Completed Visits',
        value: dashboard.recentConsultations.length,
        subtitle: 'Recent clinical history',
        to: '/patient/medical-history',
      },
      {
        title: 'Issued Prescriptions',
        value: dashboard.issuedPrescriptionCount,
        to: '/patient/medical-history',
      },
    ]
    quickLinks = [
      { label: 'Book Appointment', to: '/patient/appointments/book' },
      { label: 'Medical History', to: '/patient/medical-history' },
    ]
  } else if (role === 'receptionist' && dashboard) {
    metrics = [
      { title: "Today's Appointments", value: dashboard.today.appointments },
      { title: 'Pending', value: statusCounts.pending },
      { title: 'Confirmed', value: statusCounts.confirmed },
      { title: 'Checked In', value: statusCounts.checked_in },
      { title: 'Waiting', value: statusCounts.waiting },
      { title: "Walk-Ins Today", value: dashboard.walkInsToday },
      { title: 'Active Queue', value: dashboard.activeQueueCount },
    ]
    quickLinks = [
      { label: 'Appointments', to: '/receptionist/appointments' },
      { label: 'Walk-Ins', to: '/receptionist/walk-ins' },
      { label: 'Queue', to: '/receptionist/queue' },
    ]
  } else if (role === 'doctor' && dashboard) {
    metrics = [
      { title: "Today's Appointments", value: dashboard.todayAppointments },
      { title: 'Waiting / Called Queue', value: dashboard.waitingCalledQueueCount, to: '/doctor/queue' },
      {
        title: 'Active Consultation',
        value: dashboard.activeConsultation
          ? `${dashboard.activeConsultation.patientId?.firstName || 'Patient'} ${dashboard.activeConsultation.patientId?.lastName || ''}`.trim()
          : 'None',
        subtitle: dashboard.activeConsultation?.serviceId?.name,
        to: '/doctor/consultations',
      },
      {
        title: 'Completed Today',
        value: dashboard.completedConsultationsToday,
        to: '/doctor/consultations',
      },
      {
        title: 'Upcoming Appointments',
        value: dashboard.upcomingCount,
        subtitle: 'Next appointments',
        to: '/doctor/appointments',
      },
    ]
    quickLinks = [
      { label: 'Appointments', to: '/doctor/appointments' },
      { label: 'My Queue', to: '/doctor/queue' },
      { label: 'Consultations', to: '/doctor/consultations' },
    ]
  } else if (role === 'admin' && dashboard) {
    metrics = [
      { title: 'Total Patients', value: dashboard.totalPatients, to: '/admin/patients' },
      { title: 'Active Doctors', value: dashboard.activeDoctors, to: '/admin/doctors' },
      { title: 'Active Services', value: dashboard.activeServices, to: '/admin/services' },
      { title: "Today's Appointments", value: dashboard.todayAppointments, to: '/admin/appointments' },
      { title: "Walk-Ins Today", value: dashboard.walkInsToday, to: '/admin/walk-ins' },
      { title: 'Active Queue', value: dashboard.activeQueue, to: '/admin/queue' },
      { title: 'Consultations Completed Today', value: dashboard.completedConsultationsToday },
    ]
  }

  if (role === 'patient') {
    return (
      <PatientDashboard
        user={user}
        dashboard={dashboard}
        loading={loading}
        error={error}
      />
    )
  }

  if (role === 'doctor') {
    return (
      <DoctorDashboard
        user={user}
        dashboard={dashboard}
        loading={loading}
        error={error}
      />
    )
  }

  if (role === 'receptionist') {
    return (
      <ReceptionistDashboard
        user={user}
        dashboard={dashboard}
        loading={loading}
        error={error}
      />
    )
  }

  if (role === 'admin') {
    return (
      <AdminDashboard
        dashboard={dashboard}
        loading={loading}
        error={error}
      />
    )
  }

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Typography component="h1" variant="h4">
        Hello, {user?.firstName || 'there'}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {roleCopy[role] || 'Clinic dashboard'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={2.5}>
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </Grid>

          {role === 'patient' && dashboard?.nextAppointment && (
            <Paper sx={{ p: 2.5, mt: 3 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography fontWeight={700}>Next visit status</Typography>
                <StatusChip status={dashboard.nextAppointment.status} />
              </Stack>
            </Paper>
          )}

          {role === 'patient' && dashboard?.recentConsultations.length > 0 && (
            <Paper sx={{ p: 2.5, mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Recent Completed Consultations
              </Typography>
              <Stack spacing={1.5}>
                {dashboard.recentConsultations.map((consultation) => (
                  <Stack
                    key={consultation._id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={600}>
                        {consultation.serviceId?.name || 'Consultation'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {consultation.diagnosis || 'Diagnosis not recorded'}
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      {formatDateTime(consultation.completedAt)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Button
                component={RouterLink}
                to="/patient/medical-history"
                sx={{ mt: 1 }}
              >
                View Medical History
              </Button>
            </Paper>
          )}

          {role === 'doctor' && dashboard?.upcomingAppointments.length > 0 && (
            <Paper sx={{ p: 2.5, mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Upcoming Appointments
              </Typography>
              <Stack spacing={1.5}>
                {dashboard.upcomingAppointments.map((appointment) => (
                  <Stack
                    key={appointment._id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={600}>
                        {appointment.patientId?.firstName}{' '}
                        {appointment.patientId?.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {appointment.serviceId?.name || 'Appointment'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2">
                        {formatDateTime(appointment.startAt)}
                      </Typography>
                      <StatusChip status={appointment.status} />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          {role === 'admin' && (
            <Paper sx={{ p: 2.5, mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Today’s Appointment Status
              </Typography>
              <Grid container spacing={1.5}>
                {Object.entries(adminStatuses || {}).map(([status, count]) => (
                  <Grid key={status} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <StatusChip status={status} />
                      <Typography fontWeight={700}>{count}</Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
              <Button
                component={RouterLink}
                to="/admin/reports"
                sx={{ mt: 2 }}
              >
                View Reports
              </Button>
            </Paper>
          )}

          {quickLinks.length > 0 && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ mt: 3 }}
            >
              {quickLinks.map((link) => (
                <Button
                  key={link.to}
                  component={RouterLink}
                  to={link.to}
                  variant="contained"
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}

export default RoleDashboard
