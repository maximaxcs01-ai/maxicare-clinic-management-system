import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, IconButton, InputLabel, MenuItem, Paper,
  Select, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material'
import { useState } from 'react'
import ConfirmDialog from '../common/ConfirmDialog'

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})
const defaultPeriod = { startTime: '09:00', endTime: '17:00' }

function PeriodEditor({ periods, disabled, onChange }) {
  const update = (index, field, value) => onChange(periods.map((period, itemIndex) => itemIndex === index ? { ...period, [field]: value } : period))
  return <Stack spacing={1.5}>{periods.map((period, index) => <Stack key={`${period.startTime}-${period.endTime}-${index}`} direction="row" spacing={1} alignItems="center"><FormControl size="small" fullWidth disabled={disabled}><InputLabel>Start</InputLabel><Select label="Start" value={period.startTime} onChange={(event) => update(index, 'startTime', event.target.value)}>{timeOptions.map((time) => <MenuItem key={time} value={time}>{time}</MenuItem>)}</Select></FormControl><Typography color="text.secondary">to</Typography><FormControl size="small" fullWidth disabled={disabled}><InputLabel>End</InputLabel><Select label="End" value={period.endTime} onChange={(event) => update(index, 'endTime', event.target.value)}>{timeOptions.map((time) => <MenuItem key={time} value={time}>{time}</MenuItem>)}</Select></FormControl>{!disabled && <Tooltip title="Remove period"><IconButton aria-label="Remove period" color="error" onClick={() => onChange(periods.filter((_, itemIndex) => itemIndex !== index))}><DeleteOutlinedIcon /></IconButton></Tooltip>}</Stack>)}{!disabled && <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...periods, { ...defaultPeriod }])} sx={{ alignSelf: 'flex-start' }}>Add Period</Button>}</Stack>
}

function ScheduleEditor({ schedule, editable, saving, error, onChange, onSave }) {
  const [overrideDialog, setOverrideDialog] = useState(null)
  const [overrideForm, setOverrideForm] = useState({ date: '', type: 'unavailable', periods: [] })
  const [deleteIndex, setDeleteIndex] = useState(null)

  const setDay = (day, periods) => onChange({ ...schedule, weeklySchedule: { ...schedule.weeklySchedule, [day]: periods } })
  const openOverride = (index = null) => { const current = index === null ? { date: '', type: 'unavailable', periods: [] } : schedule.dateOverrides[index]; setOverrideDialog(index === null ? 'new' : index); setOverrideForm({ date: current.date, type: current.type, periods: current.periods.map((period) => ({ ...period })) }) }
  const saveOverride = () => { if (!overrideForm.date || (overrideForm.type === 'custom' && !overrideForm.periods.length)) return; const overrides = [...schedule.dateOverrides]; const value = { date: overrideForm.date, type: overrideForm.type, periods: overrideForm.type === 'custom' ? overrideForm.periods : [] }; if (overrideDialog === 'new') overrides.push(value); else overrides[overrideDialog] = value; onChange({ ...schedule, dateOverrides: overrides }); setOverrideDialog(null) }
  const removeOverride = () => { onChange({ ...schedule, dateOverrides: schedule.dateOverrides.filter((_, index) => index !== deleteIndex) }); setDeleteIndex(null) }

  return <Stack spacing={3}>
    {error && <Alert severity="error">{error}</Alert>}
    <Paper sx={{ p: { xs: 2, sm: 3 }, border: 1, borderColor: 'divider' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}><Box><Typography variant="h6">Weekly schedule</Typography><Typography variant="body2" color="text.secondary">Times are interpreted in Asia/Manila.</Typography></Box>{editable && <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Schedule status</InputLabel><Select label="Schedule status" value={schedule.status} onChange={(event) => onChange({ ...schedule, status: event.target.value })}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></Select></FormControl>}</Stack><Stack divider={<Divider flexItem />} spacing={0}>{days.map((day) => { const periods = schedule.weeklySchedule[day] || []; return <Box key={day} sx={{ py: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: periods.length ? 2 : 0 }}><Typography fontWeight={700} sx={{ textTransform: 'capitalize' }}>{day}</Typography><Stack direction="row" alignItems="center"><Typography variant="body2" color="text.secondary">{periods.length ? 'Enabled' : 'Unavailable'}</Typography>{editable && <Switch checked={periods.length > 0} onChange={(event) => setDay(day, event.target.checked ? [{ ...defaultPeriod }] : [])} inputProps={{ 'aria-label': `Enable ${day}` }} />}</Stack></Stack>{periods.length > 0 && <PeriodEditor periods={periods} disabled={!editable} onChange={(value) => setDay(day, value)} />}</Box>})}</Stack></Paper>
    <Paper sx={{ p: { xs: 2, sm: 3 }, border: 1, borderColor: 'divider' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Box><Typography variant="h6">Date exceptions</Typography><Typography variant="body2" color="text.secondary">Exceptions take precedence over the weekly schedule.</Typography></Box>{editable && <Button startIcon={<AddIcon />} onClick={() => openOverride()}>Add Date Exception</Button>}</Stack>{schedule.dateOverrides.length === 0 ? <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No date exceptions configured.</Typography> : <Stack spacing={1.5}>{[...schedule.dateOverrides].sort((a, b) => a.date.localeCompare(b.date)).map((override) => { const originalIndex = schedule.dateOverrides.indexOf(override); return <Card key={`${override.date}-${originalIndex}`} variant="outlined"><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}><Box><Typography fontWeight={700}>{new Date(`${override.date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</Typography><Typography variant="body2" color="text.secondary">{override.type === 'unavailable' ? 'Unavailable' : override.periods.map((period) => `${period.startTime}–${period.endTime}`).join(', ')}</Typography></Box>{editable && <Stack direction="row"><Tooltip title="Edit exception"><IconButton onClick={() => openOverride(originalIndex)}><EditOutlinedIcon /></IconButton></Tooltip><Tooltip title="Delete exception"><IconButton color="error" onClick={() => setDeleteIndex(originalIndex)}><DeleteOutlinedIcon /></IconButton></Tooltip></Stack>}</Stack></CardContent></Card>})}</Stack>}</Paper>
    {editable && <Button variant="contained" size="large" disabled={saving} onClick={onSave} sx={{ alignSelf: 'flex-start' }}>{saving ? 'Saving schedule...' : 'Save Schedule'}</Button>}
    <Dialog open={overrideDialog !== null} onClose={() => setOverrideDialog(null)} fullWidth maxWidth="sm"><DialogTitle>{overrideDialog === 'new' ? 'Add Date Exception' : 'Edit Date Exception'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField required type="date" label="Date" slotProps={{ inputLabel: { shrink: true } }} value={overrideForm.date} onChange={(event) => setOverrideForm({ ...overrideForm, date: event.target.value })} /><FormControl required><InputLabel>Type</InputLabel><Select label="Type" value={overrideForm.type} onChange={(event) => setOverrideForm({ ...overrideForm, type: event.target.value, periods: event.target.value === 'custom' && !overrideForm.periods.length ? [{ ...defaultPeriod }] : [] })}><MenuItem value="unavailable">Unavailable</MenuItem><MenuItem value="custom">Custom Hours</MenuItem></Select></FormControl>{overrideForm.type === 'custom' && <PeriodEditor periods={overrideForm.periods} onChange={(periods) => setOverrideForm({ ...overrideForm, periods })} />}</Stack></DialogContent><DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={() => setOverrideDialog(null)}>Cancel</Button><Button variant="contained" onClick={saveOverride}>Save Exception</Button></DialogActions></Dialog>
    <ConfirmDialog open={deleteIndex !== null} title="Delete date exception?" message="The weekly schedule will apply to this date after the exception is removed." onCancel={() => setDeleteIndex(null)} onConfirm={removeOverride} />
  </Stack>
}

export default ScheduleEditor
