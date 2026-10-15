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
import DoctorAvatar from '../../components/DoctorAvatar'
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
  const [specializations, setSpecializations] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState(null)
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([getServices({ limit: 100 }), getDoctors({ limit: 100 })])
      .then(([serviceResponse, doctorResponse]) => {
        if (!active) return
        const serviceData = serviceResponse.data?.data
        const doctorData = doctorResponse.data?.data
        if (!Array.isArray(serviceData) || !Array.isArray(doctorData)) {
          throw new Error('The doctor or service response could not be read.')
        }
        setServices(serviceData)
        setSpecializations(
          [...new Set(
            doctorData
              .map((doctor) => doctor.specialization)
              .filter(Boolean),
          )].sort((left, right) => left.localeCompare(right)),
        )
      })
      .catch((error) => {
        if (active) {
          setLookupError(
            error.response?.data?.message ||
              error.message ||
              'Unable to load doctor management options.',
          )
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await getDoctors({
          page,
          limit: 10,
          search,
          status,
          specialization,
        })
        if (active) {
          setRows(response.data.data)
          setPagination(response.data.pagination)
          setNotice((current) =>
            current?.severity === 'error' ? null : current,
          )
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
  }, [page, search, status, specialization, reload])

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
            serviceIds: Array.isArray(doctor.serviceIds)
              ? doctor.serviceIds.map((item) => item._id)
              : [],
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
    <Box component="section" className="admin-page admin-doctors-page" sx={{ minWidth: 0 }}>
      <Box
        className="admin-page-header"
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
          <Typography variant="h4">Doctors Management</Typography>
          <Typography color="text.secondary">
            Manage doctor profiles, specialization, schedules, and availability.
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

      {lookupError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {lookupError}
        </Alert>
      )}

      <Paper className="admin-management-panel" sx={{ border: 1, borderColor: 'divider' }}>
        <Stack
          className="admin-filter-panel"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 0 }}
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

          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Specialization</InputLabel>
            <Select
              label="Specialization"
              value={specialization}
              onChange={(event) => {
                setSpecialization(event.target.value)
                setPage(1)
              }}
            >
              <MenuItem value="">All specializations</MenuItem>
              {specializations.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </Select>
          </FormControl>

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
                <TableCell>Email</TableCell>
                <TableCell>Contact</TableCell>
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
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <DoctorAvatar
                          className="admin-doctor-avatar"
                          imageUrl={doctor.profileImage?.url}
                          firstName={doctor.firstName}
                          lastName={doctor.lastName}
                          size={42}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700}>
                            {doctor.firstName} {doctor.middleName} {doctor.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {doctor.doctorNumber}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{doctor.specialization}</TableCell>
                    <TableCell>{doctor.email}</TableCell>
                    <TableCell>{doctor.mobileNumber || '—'}</TableCell>
                    <TableCell>
                      <StatusChip status={doctor.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'flex-end' }}
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
          className="admin-pagination"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
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
            {dialog?._id && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <DoctorAvatar
                  imageUrl={dialog.profileImage?.url}
                  firstName={dialog.firstName}
                  lastName={dialog.lastName}
                  size={52}
                />
                <Box>
                  <Typography fontWeight={700}>
                    {dialog.firstName} {dialog.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Doctor profile photo
                  </Typography>
                </Box>
              </Stack>
            )}
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
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
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
