import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert, Box, Button, FormControl, IconButton, InputLabel, MenuItem, Pagination,
  Paper, Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StatusChip from '../components/common/StatusChip'
import TableState from '../components/common/TableState'
import useAuth from '../hooks/useAuth'
import {
  activatePatientPortal,
  deletePatient,
  getPatients,
  resendPatientActivation,
} from '../services/patientApi'

function Patients() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [portalStatus, setPortalStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [activationConfirm, setActivationConfirm] = useState(null)
  const [activationLoading, setActivationLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const portalBase = `/${user.role}/patients`
  const canManage = ['admin', 'receptionist'].includes(user.role)
  const canDelete = user.role === 'admin'
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await getPatients({ page, limit: 10, search, portalStatus })
        if (active) { setRows(response.data.data); setPagination(response.data.pagination) }
      } catch (error) {
        if (active) setNotice({ severity: 'error', message: error.response?.data?.message || 'Unable to load patients.' })
      } finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [page, search, portalStatus, reload])

  const remove = async () => {
    try {
      setDeleting(true)
      const response = await deletePatient(confirm._id)
      setNotice({ severity: 'success', message: response.data.message })
      setConfirm(null); setReload((value) => value + 1)
    } catch (error) { setNotice({ severity: 'error', message: error.response?.data?.message || 'Unable to delete patient.' }) }
    finally { setDeleting(false) }
  }

  const activatePortal = async () => {
    try {
      setActivationLoading(true)
      const response = await activatePatientPortal(activationConfirm._id)
      setNotice({ severity: 'success', message: response.data.message })
      setActivationConfirm(null)
      setReload((value) => value + 1)
    } catch (error) {
      setNotice({
        severity: 'error',
        message:
          error.response?.data?.message ||
          'Unable to activate patient portal.',
      })
      setReload((value) => value + 1)
    } finally {
      setActivationLoading(false)
    }
  }

  const resendActivation = async (patient) => {
    try {
      setActivationLoading(true)
      const response = await resendPatientActivation(patient._id)
      setNotice({ severity: 'success', message: response.data.message })
    } catch (error) {
      setNotice({
        severity: 'error',
        message:
          error.response?.data?.message ||
          'Unable to resend patient activation invitation.',
      })
    } finally {
      setActivationLoading(false)
    }
  }

  return (
    <Box component="section" className={isAdmin ? 'admin-page admin-patients-page' : user.role === 'receptionist' ? 'receptionist-page' : undefined} sx={{ minWidth: 0 }}>
      <Box
        className={isAdmin ? 'admin-page-header' : user.role === 'receptionist' ? 'receptionist-page-header' : undefined}
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
          <Typography variant="h4">Patients</Typography>
          <Typography color="text.secondary">Manage patient records and portal access.</Typography>
        </Box>
        {canManage && (
          <Button
            component={RouterLink}
            to={`${portalBase}/add`}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              justifySelf: { xs: 'stretch', sm: 'end' },
              minWidth: { sm: 170 },
              height: 44,
              borderRadius: 2,
              px: 2.25,
              fontWeight: 600,
            }}
          >
            Register New Patient
          </Button>
        )}
      </Box>
      <Paper className={isAdmin ? 'admin-management-panel' : user.role === 'receptionist' ? 'receptionist-management-panel' : undefined} sx={{ border: 1, borderColor: 'divider' }}>
        <Stack className={isAdmin ? 'admin-filter-panel' : undefined} direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={isAdmin ? undefined : { p: 2.5, mb: 0 }}>
          <TextField size="small" fullWidth label="Search patient number, name, email, or mobile" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Portal status</InputLabel><Select label="Portal status" value={portalStatus} onChange={(e) => { setPortalStatus(e.target.value); setPage(1) }}><MenuItem value="">All statuses</MenuItem><MenuItem value="not_activated">Not activated</MenuItem><MenuItem value="invited">Invited</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive (legacy)</MenuItem></Select></FormControl>
          <Button
            variant="outlined"
            disabled={!search && !portalStatus}
            onClick={() => { setSearch(''); setPortalStatus(''); setPage(1) }}
          >
            Reset
          </Button>
        </Stack>
        <TableContainer><Table><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Patient No.</TableCell><TableCell>Contact</TableCell><TableCell>Email</TableCell><TableCell>Portal Status</TableCell>{canManage && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead><TableBody><TableState loading={loading} empty={!rows.length} colSpan={canManage ? 6 : 5} />{!loading && rows.map((patient) => <TableRow key={patient._id} hover><TableCell><Typography fontWeight={700}>{patient.firstName} {patient.middleName} {patient.lastName} {patient.suffix}</Typography></TableCell><TableCell>{patient.patientNumber || 'Number pending'}</TableCell><TableCell>{patient.mobileNumber || patient.contactNumber || '—'}</TableCell><TableCell>{patient.email}</TableCell><TableCell><StatusChip status={patient.portalStatus} /></TableCell>{canManage && <TableCell align="right"><Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>{!patient.userId && ['not_activated', 'inactive'].includes(patient.portalStatus) && patient.email && <Button size="small" disabled={activationLoading} onClick={() => setActivationConfirm(patient)}>Activate Portal</Button>}{patient.portalStatus === 'invited' && <Button size="small" disabled={activationLoading} onClick={() => resendActivation(patient)}>Resend Invitation</Button>}<Tooltip title="Edit"><IconButton component={RouterLink} to={`${portalBase}/edit/${patient._id}`}><EditOutlinedIcon /></IconButton></Tooltip>{canDelete && <Tooltip title="Delete"><IconButton color="error" onClick={() => setConfirm(patient)}><DeleteOutlineIcon /></IconButton></Tooltip>}</Stack></TableCell>}</TableRow>)}</TableBody></Table></TableContainer>
        <Stack className={isAdmin ? 'admin-pagination' : undefined} direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={isAdmin ? { justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } } : { p: 2, justifyContent: 'space-between', alignItems: 'center' }}><Typography variant="body2" color="text.secondary">{pagination.total} patient(s)</Typography><Pagination page={page} count={pagination.totalPages} onChange={(_, value) => setPage(value)} color="primary" /></Stack>
      </Paper>
      <ConfirmDialog open={Boolean(confirm)} title="Delete patient?" message={confirm ? `Delete ${confirm.firstName} ${confirm.lastName}? Portal-linked and protected records cannot be deleted.` : ''} loading={deleting} onCancel={() => setConfirm(null)} onConfirm={remove} />
      <ConfirmDialog
        open={Boolean(activationConfirm)}
        title="Activate patient portal?"
        message={
          activationConfirm
            ? `Link ${activationConfirm.firstName} ${activationConfirm.lastName}'s existing patient record to a patient portal account and send a secure setup invitation to ${activationConfirm.email}? No new patient record will be created.`
            : ''
        }
        confirmLabel="Send Invitation"
        loading={activationLoading}
        onCancel={() => setActivationConfirm(null)}
        onConfirm={activatePortal}
      />
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)}><Alert severity={notice?.severity || 'info'} onClose={() => setNotice(null)}>{notice?.message}</Alert></Snackbar>
    </Box>
  )
}

export default Patients
