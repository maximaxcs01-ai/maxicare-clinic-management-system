import {
  Alert,
  Box,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TableState from '../components/common/TableState'
import { getDoctorPatients } from '../services/patientRecordsApi'

function DoctorPatients() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
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
    const timer = window.setTimeout(() => {
      setLoading(true)
      getDoctorPatients({ search, page, limit: 10 })
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
                'Unable to load patient records.',
            })
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [search, page])

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Patients</Typography>
        <Typography color="text.secondary">
          View demographics and completed clinical history for your patients.
        </Typography>
      </Stack>
      <Paper sx={{ width: '100%', p: { xs: 2, sm: 2.5 } }}>
        <TextField
          size="small"
          fullWidth
          label="Search by patient number, name, or mobile"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          sx={{ mb: 2.5 }}
        />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Patient Number</TableCell>
                <TableCell>Date of Birth</TableCell>
                <TableCell>Sex</TableCell>
                <TableCell>Mobile</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState
                loading={loading}
                empty={!rows.length}
                colSpan={5}
                emptyMessage="No patients with an appointment assigned to you."
              />
              {!loading &&
                rows.map((patient) => (
                  <TableRow
                    key={patient._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() =>
                      navigate(`/doctor/patients/${patient._id}`)
                    }
                  >
                    <TableCell>
                      {patient.firstName} {patient.middleName}{' '}
                      {patient.lastName} {patient.suffix}
                    </TableCell>
                    <TableCell>{patient.patientNumber || '—'}</TableCell>
                    <TableCell>
                      {patient.dateOfBirth
                        ? new Intl.DateTimeFormat('en-PH', {
                            dateStyle: 'medium',
                            timeZone: 'Asia/Manila',
                          }).format(new Date(patient.dateOfBirth))
                        : '—'}
                    </TableCell>
                    <TableCell>{patient.sex || patient.gender || '—'}</TableCell>
                    <TableCell>
                      {patient.mobileNumber || patient.contactNumber || '—'}
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
          sx={{ pt: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {pagination.total} patient(s)
          </Typography>
          <Pagination
            page={page}
            count={pagination.totalPages}
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

export default DoctorPatients
