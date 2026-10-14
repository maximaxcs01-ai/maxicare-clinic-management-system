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
import { getConsultations } from '../services/appointmentApi'

const formatDateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function DoctorConsultations() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('in_progress')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    getConsultations({ status, page, limit: 10 })
      .then((response) => {
        if (!active) return
        setRows(response.data.data || [])
        setPagination(response.data.pagination)
      })
      .catch((error) => {
        if (active) {
          setNotice({
            severity: 'error',
            message:
              error.response?.data?.message ||
              'Unable to load consultations.',
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [status, page])

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Consultations</Typography>
        <Typography color="text.secondary">
          Review and document your active and completed consultations.
        </Typography>
      </Stack>

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Tabs
          value={status}
          onChange={(_, value) => {
            setLoading(true)
            setPage(1)
            setStatus(value)
          }}
          aria-label="Consultation status"
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Active" value="in_progress" />
          <Tab label="Completed" value="completed" />
        </Tabs>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Patient Number</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Started At</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!rows.length}
                colSpan={5}
                emptyMessage={
                  status === 'in_progress'
                    ? 'No active consultations.'
                    : 'No completed consultations.'
                }
              />
              {!loading &&
                rows.map((consultation) => (
                  <TableRow
                    key={consultation._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() =>
                      navigate(`/doctor/consultations/${consultation._id}`)
                    }
                  >
                    <TableCell>
                      {consultation.patientId
                        ? `${consultation.patientId.firstName} ${consultation.patientId.lastName}`
                        : 'Patient unavailable'}
                    </TableCell>
                    <TableCell>
                      {consultation.patientId?.patientNumber || '—'}
                    </TableCell>
                    <TableCell>
                      {consultation.serviceId?.name || 'Service unavailable'}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(consultation.startedAt)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={consultation.status} />
                    </TableCell>
                  </TableRow>
                ))}
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
            {pagination.total} consultation(s)
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

export default DoctorConsultations
