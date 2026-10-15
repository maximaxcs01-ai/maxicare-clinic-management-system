import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import {
  Alert,
  Box,
  Button,
  Paper,
  Pagination,
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
import DoctorAvatar from '../../components/DoctorAvatar'
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
          setNotice('')
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
    <Box component="section" className="receptionist-page receptionist-doctors-page">
      <Stack className="receptionist-page-header" direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mb: 3, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4">Doctors</Typography>
          <Typography color="text.secondary">View doctor profiles and availability schedules.</Typography>
        </Box>
      </Stack>

      {notice && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <Paper className="receptionist-management-panel" sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
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
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <DoctorAvatar
                        imageUrl={doctor.profileImage?.url}
                        firstName={doctor.firstName}
                        lastName={doctor.lastName}
                        size={60}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={700}>{formatDoctorName(doctor)}</Typography>
                        <Typography variant="body2" color="text.secondary">{doctor.email}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{doctor.doctorNumber}</TableCell>
                  <TableCell>{doctor.specialization}</TableCell>
                  <TableCell>
                    {Array.isArray(doctor.serviceIds)
                      ? doctor.serviceIds.map((service) => service.name).join(', ') || '—'
                      : '—'}
                  </TableCell>
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

        <Stack direction="row" sx={{ pt: 2, justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">{pagination.total} doctor(s)</Typography>
          <Pagination
            page={page}
            count={pagination.totalPages || 1}
            onChange={(_, value) => setPage(value)}
            color="primary"
            size="small"
          />
        </Stack>
      </Paper>
    </Box>
  )
}

export default ReceptionistDoctorsPage
