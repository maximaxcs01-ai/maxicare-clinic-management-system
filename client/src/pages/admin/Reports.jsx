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
    <Paper className="admin-report-panel">
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
    <Box component="section" className="admin-page admin-reports-page" sx={{ width: '100%', minWidth: 0 }}>
      <Box className="admin-page-header">
        <Box>
        <Typography variant="h4">Reports &amp; Analytics</Typography>
        <Typography color="text.secondary">
          Review clinic activity for a Manila calendar date range.
        </Typography>
        </Box>
      </Box>
      <Paper className="admin-filter-panel">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', sm: 'flex-end' } }}
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
          <Box className="admin-report-summary-grid">
            {[
              ['Total Appointments', totalAppointments],
              ['Walk-Ins', report.appointmentSummary?.bookingTypes?.walk_in || 0],
              ['Services Used', report.serviceUtilization.length],
              ['Doctor Activity', report.doctorActivity.length],
            ].map(([label, value]) => (
              <Paper key={label} className="admin-report-metric">
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="h4">{value}</Typography>
              </Paper>
            ))}
          </Box>

          <Box className="admin-reports-grid">
            <Paper className="admin-report-panel">
              <Typography variant="h6">Appointment Overview</Typography>
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                {statusRows.map(({ status, count }) => (
                  <Stack key={status} direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography sx={{ textTransform: 'capitalize' }}>{status.replaceAll('_', ' ')}</Typography>
                    <Typography fontWeight={750}>{count}</Typography>
                  </Stack>
                ))}
                {!statusRows.length && <Typography color="text.secondary">No appointments</Typography>}
              </Stack>
            </Paper>
            <Paper className="admin-report-panel">
              <Typography variant="h6">Scheduled vs Walk-In</Typography>
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                {bookingTypeRows.map(({ type, count }) => (
                  <Stack key={type} direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography>{type}</Typography>
                    <Typography fontWeight={750}>{count}</Typography>
                  </Stack>
                ))}
                {!bookingTypeRows.length && <Typography color="text.secondary">No appointments</Typography>}
              </Stack>
            </Paper>
          </Box>

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
          <Paper className="admin-report-panel">
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
