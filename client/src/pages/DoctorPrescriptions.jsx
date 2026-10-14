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
import { getPrescriptions } from '../services/prescriptionApi'

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

function DoctorPrescriptions() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('draft')
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
    getPrescriptions({ status, page, limit: 10 })
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
              'Unable to load prescriptions.',
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
    <Box component="section" className="doctor-page doctor-prescriptions-page" sx={{ width: '100%', minWidth: 0 }}>
      <Stack className="doctor-page-header" spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Prescriptions</Typography>
        <Typography color="text.secondary">
          Manage prescriptions linked to your consultations.
        </Typography>
      </Stack>

      <Paper className="doctor-management-panel" sx={{ width: '100%', overflow: 'hidden' }}>
        <Tabs
          value={status}
          onChange={(_, value) => {
            setLoading(true)
            setPage(1)
            setStatus(value)
          }}
          aria-label="Prescription status"
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Drafts" value="draft" />
          <Tab label="Issued" value="issued" />
        </Tabs>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Patient Number</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Medication Count</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>{status === 'issued' ? 'Issued' : 'Created'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!rows.length}
                colSpan={6}
                emptyMessage={
                  status === 'draft'
                    ? 'No prescription drafts.'
                    : 'No issued prescriptions.'
                }
              />
              {!loading &&
                rows.map((prescription) => (
                  <TableRow
                    key={prescription._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() =>
                      navigate(`/doctor/prescriptions/${prescription._id}`)
                    }
                  >
                    <TableCell>
                      {prescription.patientId
                        ? `${prescription.patientId.firstName} ${prescription.patientId.lastName}`
                        : 'Patient unavailable'}
                    </TableCell>
                    <TableCell>
                      {prescription.patientId?.patientNumber || '—'}
                    </TableCell>
                    <TableCell>
                      {prescription.serviceId?.name || '—'}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {prescription.appointmentId?.bookingType === 'walk_in'
                          ? 'Walk-In'
                          : 'Scheduled'}
                      </Typography>
                    </TableCell>
                    <TableCell>{prescription.medications?.length || 0}</TableCell>
                    <TableCell>
                      <StatusChip status={prescription.status} />
                    </TableCell>
                    <TableCell>
                      {formatDate(
                        prescription.issuedAt || prescription.createdAt,
                      )}
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
            {pagination.total} prescription(s)
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

export default DoctorPrescriptions
