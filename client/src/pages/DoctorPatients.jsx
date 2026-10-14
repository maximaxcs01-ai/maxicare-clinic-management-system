import {
  Alert,
  Avatar,
  Box,
  Button,
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

const emptyPagination = { page: 1, totalPages: 1, total: 0 }

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDifference = today.getMonth() - birthDate.getMonth()
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1
  }
  return age
}

function DoctorPatients() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getDoctorPatients({ search, page, limit: 10 })
        .then((response) => {
          if (!active) return
          const payload = response.data?.data
          if (!payload || !Array.isArray(payload.data)) {
            setRows([])
            setPagination(emptyPagination)
            setNotice({
              severity: 'error',
              message: 'The patient records response could not be read.',
            })
            return
          }
          setRows(payload.data)
          setPagination(payload.pagination || emptyPagination)
          setNotice(null)
        })
        .catch((error) => {
          if (active) {
            setRows([])
            setPagination(emptyPagination)
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
    <Box
      component="section"
      className="doctor-page doctor-patients-page"
      sx={{ width: '100%', minWidth: 0 }}
    >
      <Stack className="doctor-page-header" spacing={0.5}>
        <Typography variant="h4">Patients</Typography>
        <Typography color="text.secondary">
          View your assigned patient records.
        </Typography>
      </Stack>

      <Paper
        className="doctor-management-panel"
        sx={{ width: '100%', p: { xs: 2, sm: 2.5 } }}
      >
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
                <TableCell>Age / Sex</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell align="right">Action</TableCell>
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
                Array.isArray(rows) &&
                rows.map((patient) => {
                  const age = getAge(patient.dateOfBirth)
                  return (
                    <TableRow
                      key={patient._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() =>
                        navigate(`/doctor/patients/${patient._id}`)
                      }
                    >
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: 'center' }}
                        >
                          <Avatar className="doctor-patient-list-avatar">
                            {patient.firstName?.[0]}
                            {patient.lastName?.[0]}
                          </Avatar>
                          <Box>
                            <Typography fontWeight={700}>
                              {patient.firstName} {patient.middleName}{' '}
                              {patient.lastName} {patient.suffix}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Assigned patient record
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{patient.patientNumber || '—'}</TableCell>
                      <TableCell>
                        {age === null ? 'Age not recorded' : `${age} years`}
                        {' · '}
                        {patient.sex || patient.gender || 'Not recorded'}
                      </TableCell>
                      <TableCell>
                        {patient.mobileNumber || patient.contactNumber || '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/doctor/patients/${patient._id}`)
                          }}
                        >
                          View Record
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ pt: 2, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <Typography variant="body2" color="text.secondary">
            {pagination.total} patient(s)
          </Typography>
          <Pagination
            page={pagination.page || page}
            count={Math.max(pagination.totalPages || 1, 1)}
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
