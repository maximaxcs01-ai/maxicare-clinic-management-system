import {
  Alert,
  Box,
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
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import { getOwnMedicalHistory } from '../services/patientRecordsApi'

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function PatientMedicalHistory() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('consultations')
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const pageSize = 10

  useEffect(() => {
    let active = true
    getOwnMedicalHistory()
      .then((response) => {
        if (active) setHistory(response.data.data)
      })
      .catch((error) => {
        if (active) {
          setNotice({
            severity: 'error',
            message:
              error.response?.data?.message ||
              'Unable to load your medical history.',
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const rows = history
    ? tab === 'consultations'
      ? history.consultations
      : tab === 'appointments'
        ? history.appointments
        : history.prescriptions
    : []
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const tabLabels = {
    consultations: 'Completed consultations',
    appointments: 'Appointments',
    prescriptions: 'Issued prescriptions',
  }

  return (
    <Box component="section" className="patient-page patient-history-page" sx={{ width: '100%', minWidth: 0 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Medical History</Typography>
        <Typography color="text.secondary">
          View your completed consultations, appointments, and issued prescriptions.
        </Typography>
      </Stack>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value) => {
            setPage(1)
            setTab(value)
          }}
          aria-label="Medical history sections"
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Consultations" value="consultations" />
          <Tab label="Appointments" value="appointments" />
          <Tab label="Prescriptions" value="prescriptions" />
        </Tabs>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  {tab === 'consultations'
                    ? 'Completed'
                    : tab === 'appointments'
                      ? 'Date'
                      : 'Issued'}
                </TableCell>
                <TableCell>
                  {tab === 'prescriptions' ? 'Medication Count' : 'Service'}
                </TableCell>
                <TableCell>
                  {tab === 'appointments' ? 'Appointment Status' : 'Doctor'}
                </TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!pageRows.length}
                colSpan={4}
                emptyMessage={`No ${tabLabels[tab].toLowerCase()} found.`}
              />
              {!loading &&
                pageRows.map((row) => {
                  const isConsultation = tab === 'consultations'
                  const isAppointment = tab === 'appointments'
                  const dateValue = isConsultation
                    ? row.completedAt
                    : isAppointment
                      ? row.startAt
                      : row.issuedAt
                  return (
                    <TableRow
                      key={row._id}
                      hover
                      sx={{
                        cursor:
                          isConsultation || tab === 'prescriptions'
                            ? 'pointer'
                            : 'default',
                      }}
                      onClick={() => {
                        if (isConsultation) {
                          navigate(`/patient/medical-history/${row._id}`)
                        } else if (tab === 'prescriptions') {
                          const consultationId =
                            row.consultationId?._id || row.consultationId
                          if (consultationId) {
                            navigate(
                              `/patient/medical-history/${consultationId}`,
                            )
                          }
                        }
                      }}
                    >
                      <TableCell>{formatDateTime(dateValue)}</TableCell>
                      <TableCell>
                        {tab === 'prescriptions'
                          ? row.medications?.length || 0
                          : row.serviceId?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {isAppointment
                          ? row.doctorId
                            ? `${row.doctorId.firstName} ${row.doctorId.lastName}`
                            : '—'
                          : tab === 'prescriptions'
                            ? row.doctorId
                              ? `Dr. ${row.doctorId.firstName} ${row.doctorId.lastName}`
                              : '—'
                            : row.doctorId
                              ? `${row.doctorId.firstName} ${row.doctorId.lastName}`
                              : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          status={
                            tab === 'consultations'
                              ? 'completed'
                              : row.status
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1}
          sx={{ p: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {rows.length} record(s)
          </Typography>
          <Pagination
            page={page}
            count={totalPages}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Stack>
      </Paper>
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

export default PatientMedicalHistory
