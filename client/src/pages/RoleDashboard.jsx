import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import useAuth from '../hooks/useAuth'
import { getDashboard } from '../services/dashboardApi'

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

function MetricCard({ title, value, subtitle, to }) {
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
  return (
    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
      {to ? (
        <Box component={RouterLink} to={to} sx={{ textDecoration: 'none' }}>
          {content}
        </Box>
      ) : (
        content
      )}
    </Grid>
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
        if (active) setDashboard(response.data.data)
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
              <Stack direction="row" spacing={1} alignItems="center">
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
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1}
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
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1}
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
                    <Stack direction="row" spacing={1} alignItems="center">
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
                    <Stack direction="row" spacing={1} alignItems="center">
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
