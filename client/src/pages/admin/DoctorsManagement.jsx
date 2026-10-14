import AddIcon from '@mui/icons-material/Add'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
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
import ConfirmDialog from '../../components/common/ConfirmDialog'
import StatusChip from '../../components/common/StatusChip'
import TableState from '../../components/common/TableState'
import {
  createDoctor,
  deleteDoctor,
  getDoctors,
  resendDoctorInvitation,
  updateDoctor,
} from '../../services/doctorApi'
import { getServices } from '../../services/serviceApi'

const emptyForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  licenseNumber: '',
  specialization: '',
  serviceIds: [],
  status: 'active',
}

function DoctorsManagement() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [services, setServices] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true

    getServices({ limit: 100 })
      .then((response) => {
        if (active) setServices(response.data.data)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await getDoctors({ page, limit: 10, search, status })
        if (active) {
          setRows(response.data.data)
          setPagination(response.data.pagination)
        }
      } catch (error) {
        if (active) {
          setNotice({
            severity: 'error',
            message: error.response?.data?.message || 'Unable to load doctors.',
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, search, status, reload])

  const openForm = (doctor) => {
    setDialog(doctor || {})
    setForm(
      doctor
        ? {
            firstName: doctor.firstName,
            middleName: doctor.middleName || '',
            lastName: doctor.lastName,
            email: doctor.email,
            mobileNumber: doctor.mobileNumber,
            licenseNumber: doctor.licenseNumber,
            specialization: doctor.specialization,
            serviceIds: doctor.serviceIds.map((item) => item._id),
            status: doctor.status,
          }
        : emptyForm,
    )
  }

  const change = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value })

  const save = async () => {
    const required = [
      'firstName',
      'lastName',
      'email',
      'mobileNumber',
      'licenseNumber',
      'specialization',
    ]

    if (
      required.some((field) => !String(form[field] || '').trim()) ||
      !form.serviceIds.length
    ) {
      setNotice({
        severity: 'error',
        message: 'Complete all required fields.',
      })
      return
    }

    try {
      setSaving(true)
      const response = dialog?._id
        ? await updateDoctor(dialog._id, form)
        : await createDoctor(form)

      setNotice({ severity: 'success', message: response.data.message })
      setDialog(null)
      setReload((value) => value + 1)
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.response?.data?.message || 'Unable to save doctor.',
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      setSaving(true)
      const response = await deleteDoctor(confirm._id)
      setNotice({ severity: 'success', message: response.data.message })
      setConfirm(null)
      setReload((value) => value + 1)
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.response?.data?.message || 'Unable to delete doctor.',
      })
    } finally {
      setSaving(false)
    }
  }

  const resendInvitation = async (doctorId) => {
    try {
      const response = await resendDoctorInvitation(doctorId)
      setNotice({
        severity: 'success',
        message: response.data.message || 'Invitation sent successfully.',
      })
      setReload((value) => value + 1)
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.response?.data?.message || 'Unable to resend invitation.',
      })
    }
  }

  return (
    <Box component="section" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'minmax(0, 1fr) auto',
          },
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4">Doctors</Typography>
          <Typography color="text.secondary">
            Manage doctor profiles and linked portal accounts.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openForm()}
          sx={{
            justifySelf: { xs: 'stretch', sm: 'end' },
            minWidth: { sm: 170 },
            height: 44,
            borderRadius: 2,
            px: 2.25,
            fontWeight: 600,
          }}
        >
          Add Doctor
        </Button>
      </Box>

      <Paper sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 2.5 }}
        >
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

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <MenuItem value="">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Doctor</TableCell>
                <TableCell>Specialization</TableCell>
                <TableCell>PRC / License</TableCell>
                <TableCell>Services</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableState loading={loading} empty={!rows.length} colSpan={6} />
              {!loading &&
                rows.map((doctor) => (
                  <TableRow key={doctor._id} hover>
                    <TableCell>
                      <Typography fontWeight={700}>
                        {doctor.firstName} {doctor.middleName} {doctor.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {doctor.doctorNumber} · {doctor.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{doctor.specialization}</TableCell>
                    <TableCell>{doctor.licenseNumber}</TableCell>
                    <TableCell>
                      {doctor.serviceIds.map((item) => item.name).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={doctor.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <Tooltip title="Manage Schedule">
                          <IconButton
                            color="primary"
                            aria-label="Manage schedule"
                            onClick={() => navigate(`/admin/doctors/${doctor._id}/schedule`)}
                          >
                            <CalendarMonthOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                        {doctor.userId?.passwordSetupRequired === true && (
                          <Tooltip title="Resend setup invitation">
                            <IconButton
                              color="secondary"
                              aria-label="Resend setup invitation"
                              onClick={() => resendInvitation(doctor._id)}
                            >
                              <AddIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton
                            aria-label="Edit doctor"
                            onClick={() => openForm(doctor)}
                          >
                            <EditOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            color="error"
                            aria-label="Delete doctor"
                            onClick={() => setConfirm(doctor)}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ pt: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {pagination.total} doctor(s)
          </Typography>
          <Pagination
            page={page}
            count={pagination.totalPages}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Stack>
      </Paper>

      <Dialog open={Boolean(dialog)} onClose={() => !saving && setDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>{dialog?._id ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                label="First Name"
                value={form.firstName}
                onChange={change('firstName')}
                fullWidth
              />
              <TextField
                label="Middle Name"
                value={form.middleName}
                onChange={change('middleName')}
                fullWidth
              />
              <TextField
                required
                label="Last Name"
                value={form.lastName}
                onChange={change('lastName')}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                type="email"
                label="Email"
                value={form.email}
                onChange={change('email')}
                fullWidth
              />
              <TextField
                required
                label="Mobile Number"
                value={form.mobileNumber}
                onChange={change('mobileNumber')}
                inputProps={{ maxLength: 11 }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                label="License Number"
                value={form.licenseNumber}
                onChange={change('licenseNumber')}
                fullWidth
              />
              <TextField
                required
                label="Specialization"
                value={form.specialization}
                onChange={change('specialization')}
                fullWidth
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel id="doctor-services-label">Services</InputLabel>
              <Select
                labelId="doctor-services-label"
                multiple
                value={form.serviceIds}
                label="Services"
                onChange={(event) =>
                  setForm({
                    ...form,
                    serviceIds:
                      typeof event.target.value === 'string'
                        ? event.target.value.split(',')
                        : event.target.value,
                  })
                }
                renderValue={(selected) =>
                  selected
                    .map(
                      (id) =>
                        services.find((service) => service._id === id)?.name || '',
                    )
                    .filter(Boolean)
                    .join(', ')
                }
              >
                {services.map((service) => (
                  <MenuItem key={service._id} value={service._id}>
                    <Checkbox checked={form.serviceIds.includes(service._id)} />
                    <ListItemText primary={service.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="doctor-status-label">Status</InputLabel>
              <Select
                labelId="doctor-status-label"
                value={form.status}
                label="Status"
                onChange={change('status')}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : dialog?._id ? 'Save Changes' : 'Add Doctor'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete doctor"
        message={`Remove ${confirm?.firstName || ''} ${confirm?.lastName || ''} from the system? This will also remove the linked portal account.`}
        confirmText="Delete"
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        loading={saving}
      />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotice(null)}
          severity={notice?.severity || 'info'}
          variant="filled"
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default DoctorsManagement
