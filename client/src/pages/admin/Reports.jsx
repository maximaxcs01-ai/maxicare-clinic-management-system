import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { getReports } from '../../services/dashboardApi'

const manilaDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

function ReportTable({ title, columns, rows, emptyMessage }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length ? (
              rows.map((row, index) => (
                <TableRow key={row.id || row.serviceId || row.doctorId || index}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key] ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Typography
                    color="text.secondary"
                    sx={{ py: 3, textAlign: 'center' }}
                  >
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  )
}

function Reports() {
  const [from, setFrom] = useState(() => manilaDate())
  const [to, setTo] = useState(() => manilaDate())
  const [range, setRange] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      getReports({ from, to })
        .then((response) => {
          if (active) {
            setReport(response.data.data)
            setRange({ from, to })
          }
        })
        .catch((requestError) => {
          if (active) {
            setError(
              requestError.response?.data?.message ||
                'Unable to load reports.',
            )
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [from, to])

  const totalAppointments = report?.appointmentSummary?.total || 0
  const statusRows = Object.entries(
    report?.appointmentSummary?.byStatus || {},
  ).map(([status, count]) => ({ status, count }))
  const bookingTypeRows = Object.entries(
    report?.appointmentSummary?.bookingTypes || {},
  ).map(([type, count]) => ({
    type: type === 'walk_in' ? 'Walk-In' : 'Scheduled',
    count,
  }))

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Reports</Typography>
        <Typography color="text.secondary">
          Review clinic activity for a Manila calendar date range.
        </Typography>
      </Stack>
      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
          spacing={2}
        >
          <TextField
            label="Date from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: to }}
          />
          <TextField
            label="Date to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: from }}
          />
          {range && (
            <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>
              Showing {range.from} through {range.to} (Asia/Manila)
            </Typography>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && report && (
        <Stack spacing={2.5}>
          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="h6">Appointment Summary</Typography>
            <Typography variant="h3" fontWeight={700} sx={{ my: 2 }}>
              {totalAppointments}
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Status breakdown
            </Typography>
            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              spacing={2}
              sx={{ mb: 2 }}
            >
              {statusRows.map(({ status, count }) => (
                <Typography key={status}>
                  <strong>{status.replaceAll('_', ' ')}:</strong> {count}
                </Typography>
              ))}
              {!statusRows.length && (
                <Typography color="text.secondary">No appointments</Typography>
              )}
            </Stack>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Booking type
            </Typography>
            <Stack direction="row" spacing={2}>
              {bookingTypeRows.map(({ type, count }) => (
                <Typography key={type}>
                  <strong>{type}:</strong> {count}
                </Typography>
              ))}
              {!bookingTypeRows.length && (
                <Typography color="text.secondary">No appointments</Typography>
              )}
            </Stack>
          </Paper>

          <ReportTable
            title="Service Utilization"
            columns={[
              { key: 'service', label: 'Service' },
              { key: 'appointmentCount', label: 'Appointments' },
              {
                key: 'completedConsultationCount',
                label: 'Completed Consultations',
              },
            ]}
            rows={report.serviceUtilization}
            emptyMessage="No service activity in this date range."
          />
          <ReportTable
            title="Doctor Activity"
            columns={[
              { key: 'doctor', label: 'Doctor' },
              { key: 'appointmentCount', label: 'Appointments' },
              {
                key: 'completedConsultationCount',
                label: 'Completed Consultations',
              },
            ]}
            rows={report.doctorActivity}
            emptyMessage="No doctor activity in this date range."
          />
          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Patient Activity
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={4}
            >
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  {report.patientActivity.newPatients}
                </Typography>
                <Typography color="text.secondary">
                  New patients during range
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  {report.patientActivity.patientsWithAppointments}
                </Typography>
                <Typography color="text.secondary">
                  Patients with appointments
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      )}
      {!loading && !report && !error && (
        <Alert severity="info">Choose a date range to load reports.</Alert>
      )}
    </Box>
  )
}

export default Reports
