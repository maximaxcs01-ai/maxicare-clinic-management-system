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
import { deletePatient, getPatients } from '../services/patientApi'

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
  const [notice, setNotice] = useState(null)
  const portalBase = `/${user.role}/patients`
  const canManage = ['admin', 'receptionist'].includes(user.role)
  const canDelete = user.role === 'admin'

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
          <Typography variant="h4">Patients</Typography>
          <Typography color="text.secondary">Search and manage clinic patient records.</Typography>
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
            Add Patient
          </Button>
        )}
      </Box>
      <Paper sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
          <TextField size="small" fullWidth label="Search patient number, name, email, or mobile" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Portal status</InputLabel><Select label="Portal status" value={portalStatus} onChange={(e) => { setPortalStatus(e.target.value); setPage(1) }}><MenuItem value="">All statuses</MenuItem><MenuItem value="not_activated">Not activated</MenuItem><MenuItem value="invited">Invited</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive (legacy)</MenuItem></Select></FormControl>
        </Stack>
        <TableContainer><Table><TableHead><TableRow><TableCell>Patient</TableCell><TableCell>Sex</TableCell><TableCell>Mobile</TableCell><TableCell>Email</TableCell><TableCell>Portal</TableCell>{canManage && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead><TableBody><TableState loading={loading} empty={!rows.length} colSpan={canManage ? 6 : 5} />{!loading && rows.map((patient) => <TableRow key={patient._id} hover><TableCell><Typography fontWeight={700}>{patient.firstName} {patient.middleName} {patient.lastName} {patient.suffix}</Typography><Typography variant="body2" color="text.secondary">{patient.patientNumber || 'Number pending'}</Typography></TableCell><TableCell>{patient.sex || patient.gender || '—'}</TableCell><TableCell>{patient.mobileNumber || patient.contactNumber || '—'}</TableCell><TableCell>{patient.email}</TableCell><TableCell><StatusChip status={patient.portalStatus} /></TableCell>{canManage && <TableCell align="right"><Tooltip title="Edit"><IconButton component={RouterLink} to={`${portalBase}/edit/${patient._id}`}><EditOutlinedIcon /></IconButton></Tooltip>{canDelete && <Tooltip title="Delete"><IconButton color="error" onClick={() => setConfirm(patient)}><DeleteOutlineIcon /></IconButton></Tooltip>}</TableCell>}</TableRow>)}</TableBody></Table></TableContainer>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 2 }}><Typography variant="body2" color="text.secondary">{pagination.total} patient(s)</Typography><Pagination page={page} count={pagination.totalPages} onChange={(_, value) => setPage(value)} color="primary" /></Stack>
      </Paper>
      <ConfirmDialog open={Boolean(confirm)} title="Delete patient?" message={confirm ? `Delete ${confirm.firstName} ${confirm.lastName}? Portal-linked and protected records cannot be deleted.` : ''} loading={deleting} onCancel={() => setConfirm(null)} onConfirm={remove} />
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)}><Alert severity={notice?.severity || 'info'} onClose={() => setNotice(null)}>{notice?.message}</Alert></Snackbar>
    </Box>
  )
}

export default Patients
