import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import {
  Alert,
  Box,
  Button,
  Paper,
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
import { useNavigate } from 'react-router-dom'
import StatusChip from '../../components/common/StatusChip'
import TableState from '../../components/common/TableState'
import { getDoctors } from '../../services/doctorApi'

function ReceptionistDoctorsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await getDoctors({ page, limit: 10, search })
        if (active) {
          setRows(response.data.data)
          setPagination(response.data.pagination)
        }
      } catch (error) {
        if (active) {
          setNotice(error.response?.data?.message || 'Unable to load doctors.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, search])

  const formatDoctorName = (doctor) => [doctor.firstName, doctor.middleName, doctor.lastName].filter(Boolean).join(' ')

  return (
    <Box component="section">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Doctors</Typography>
          <Typography color="text.secondary">Review doctor profiles and availability schedules.</Typography>
        </Box>
      </Stack>

      {notice && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
          <TextField
            size="small"
            fullWidth
            label="Search doctors"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </Stack>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Doctor</TableCell>
                <TableCell>Doctor Number</TableCell>
                <TableCell>Specialization</TableCell>
                <TableCell>Services</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Schedule</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState loading={loading} empty={!rows.length} colSpan={6} />
              {!loading && rows.map((doctor) => (
                <TableRow key={doctor._id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{formatDoctorName(doctor)}</Typography>
                    <Typography variant="body2" color="text.secondary">{doctor.email}</Typography>
                  </TableCell>
                  <TableCell>{doctor.doctorNumber}</TableCell>
                  <TableCell>{doctor.specialization}</TableCell>
                  <TableCell>{doctor.serviceIds.map((service) => service.name).join(', ') || '—'}</TableCell>
                  <TableCell><StatusChip status={doctor.status} /></TableCell>
                  <TableCell align="right">
                    <Tooltip title="View schedule">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CalendarMonthOutlinedIcon />}
                        onClick={() => navigate(`/receptionist/doctors/${doctor._id}/schedule`)}
                      >
                        View
                      </Button>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">{pagination.total} doctor(s)</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </Button>
            <Button variant="outlined" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}>
              Next
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}

export default ReceptionistDoctorsPage
