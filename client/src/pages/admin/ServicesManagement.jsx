import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Pagination, Paper, Select,
  Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import StatusChip from '../../components/common/StatusChip'
import TableState from '../../components/common/TableState'
import { createService, deleteService, getServices, updateService } from '../../services/serviceApi'

const emptyForm = { name: '', description: '', fee: '', durationMinutes: 30, status: 'active' }

function ServicesManagement() {
  const [rows, setRows] = useState([])
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
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        const response = await getServices({ page, limit: 10, search, status })
        if (active) { setRows(response.data.data); setPagination(response.data.pagination) }
      } catch (error) {
        if (active) setNotice({ severity: 'error', message: error.response?.data?.message || 'Unable to load services.' })
      } finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [page, search, status, reload])

  const openForm = (service = null) => {
    setDialog(service || {})
    setForm(service ? {
      name: service.name, description: service.description, fee: service.fee,
      durationMinutes: service.durationMinutes, status: service.status,
    } : emptyForm)
  }

  const save = async () => {
    if (!form.name.trim() || !form.description.trim() || Number(form.fee) < 0 || Number(form.durationMinutes) < 1) {
      setNotice({ severity: 'error', message: 'Complete all required fields with valid values.' }); return
    }
    try {
      setSaving(true)
      const payload = { ...form, fee: Number(form.fee), durationMinutes: Number(form.durationMinutes) }
      const response = dialog?._id ? await updateService(dialog._id, payload) : await createService(payload)
      setNotice({ severity: 'success', message: response.data.message })
      setDialog(null); setForm(emptyForm); setReload((value) => value + 1)
    } catch (error) { setNotice({ severity: 'error', message: error.response?.data?.message || 'Unable to save service.' }) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    try {
      setSaving(true)
      const response = await deleteService(confirm._id)
      setNotice({ severity: 'success', message: response.data.message })
      setConfirm(null); setReload((value) => value + 1)
    } catch (error) { setNotice({ severity: 'error', message: error.response?.data?.message || 'Unable to delete service.' }) }
    finally { setSaving(false) }
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
          <Typography variant="h4">Services</Typography>
          <Typography color="text.secondary">Manage clinic services, fees, and durations.</Typography>
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
          Add Service
        </Button>
      </Box>
      <Paper sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
          <TextField size="small" label="Search services" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} fullWidth />
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><MenuItem value="">All statuses</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></Select></FormControl>
        </Stack>
        <TableContainer><Table><TableHead><TableRow><TableCell>Service</TableCell><TableCell>Fee</TableCell><TableCell>Duration</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody><TableState loading={loading} empty={!rows.length} colSpan={5} />{!loading && rows.map((service) => <TableRow key={service._id} hover><TableCell><Typography fontWeight={700}>{service.name}</Typography><Typography variant="body2" color="text.secondary">{service.description}</Typography></TableCell><TableCell>₱{Number(service.fee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell><TableCell>{service.durationMinutes} minutes</TableCell><TableCell><StatusChip status={service.status} /></TableCell><TableCell align="right"><Tooltip title="Edit"><IconButton onClick={() => openForm(service)}><EditOutlinedIcon /></IconButton></Tooltip><Tooltip title="Delete"><IconButton color="error" onClick={() => setConfirm(service)}><DeleteOutlineIcon /></IconButton></Tooltip></TableCell></TableRow>)}</TableBody>
        </Table></TableContainer>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 2 }}><Typography variant="body2" color="text.secondary">{pagination.total} service(s)</Typography><Pagination page={page} count={pagination.totalPages} onChange={(_, value) => setPage(value)} color="primary" /></Stack>
      </Paper>
      <Dialog open={dialog !== null} onClose={() => !saving && setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>{dialog?._id ? 'Edit Service' : 'Add Service'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField required label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><TextField required multiline minRows={3} label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField required type="number" label="Fee" inputProps={{ min: 0 }} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} fullWidth /><TextField required type="number" label="Duration (minutes)" inputProps={{ min: 1 }} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} fullWidth /></Stack><FormControl><InputLabel>Status *</InputLabel><Select label="Status *" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></Select></FormControl></Stack></DialogContent><DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={() => setDialog(null)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Service'}</Button></DialogActions></Dialog>
      <ConfirmDialog open={Boolean(confirm)} title="Delete service?" message={confirm ? `Delete ${confirm.name}? This cannot be undone.` : ''} loading={saving} onCancel={() => setConfirm(null)} onConfirm={remove} />
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)}><Alert severity={notice?.severity || 'info'} onClose={() => setNotice(null)}>{notice?.message}</Alert></Snackbar>
    </Box>
  )
}

export default ServicesManagement
