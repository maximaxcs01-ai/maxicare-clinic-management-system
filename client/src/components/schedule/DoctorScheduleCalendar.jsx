import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import StatusChip from '../common/StatusChip'
import { getDoctorAppointments } from '../../services/appointmentApi'

const weekdayKeys = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const editorDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})
const defaultPeriod = { startTime: '09:00', endTime: '17:00' }

const pad = (value) => String(value).padStart(2, '0')
const toDateKey = (year, month, day) =>
  `${year}-${pad(month + 1)}-${pad(day)}`

const getManilaTodayKey = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const formatSelectedDate = (dateKey) =>
  new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateKey(dateKey))

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))

const formatPeriod = ({ startTime, endTime }) => {
  const format = (time) => {
    const [hour, minute] = time.split(':').map(Number)
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2020, 0, 1, hour, minute)))
  }
  return `${format(startTime)} – ${format(endTime)}`
}

function PeriodEditor({ periods, onChange }) {
  const updatePeriod = (index, field, value) => {
    onChange(
      periods.map((period, periodIndex) =>
        periodIndex === index ? { ...period, [field]: value } : period,
      ),
    )
  }

  return (
    <Stack spacing={1.25}>
      {periods.map((period, index) => (
        <Stack
          key={`${period.startTime}-${period.endTime}-${index}`}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Start</InputLabel>
            <Select
              label="Start"
              value={period.startTime}
              onChange={(event) =>
                updatePeriod(index, 'startTime', event.target.value)
              }
            >
              {timeOptions.map((time) => (
                <MenuItem key={time} value={time}>{time}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            to
          </Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>End</InputLabel>
            <Select
              label="End"
              value={period.endTime}
              onChange={(event) =>
                updatePeriod(index, 'endTime', event.target.value)
              }
            >
              {timeOptions.map((time) => (
                <MenuItem key={time} value={time}>{time}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            color="error"
            onClick={() =>
              onChange(periods.filter((_, periodIndex) => periodIndex !== index))
            }
          >
            Remove
          </Button>
        </Stack>
      ))}
      <Button
        size="small"
        startIcon={<AddOutlinedIcon />}
        onClick={() => onChange([...periods, { ...defaultPeriod }])}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Period
      </Button>
    </Stack>
  )
}

function DoctorScheduleCalendar({ schedule, editable, saving, error, onChange, onSave }) {
  const todayKey = getManilaTodayKey()
  const todayDate = parseDateKey(todayKey)
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1)),
  )
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [appointments, setAppointments] = useState([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [appointmentsError, setAppointmentsError] = useState('')
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overridePeriods, setOverridePeriods] = useState([{ ...defaultPeriod }])

  const overrideForDate = (dateKey) =>
    schedule.dateOverrides.find((override) => override.date === dateKey)

  const getEffectivePeriods = (dateKey) => {
    if (schedule.status !== 'active') return []
    const override = overrideForDate(dateKey)
    if (override) return override.type === 'custom' ? override.periods : []
    const weekday = weekdayKeys[parseDateKey(dateKey).getUTCDay()]
    return schedule.weeklySchedule[weekday] || []
  }

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getUTCFullYear()
    const month = visibleMonth.getUTCMonth()
    const leadingDays = new Date(Date.UTC(year, month, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return [
      ...Array.from({ length: leadingDays }, (_, index) => ({
        key: `blank-${index}`,
        blank: true,
      })),
      ...Array.from({ length: daysInMonth }, (_, index) => ({
        key: toDateKey(year, month, index + 1),
        day: index + 1,
      })),
    ]
  }, [visibleMonth])

  useEffect(() => {
    let active = true
    getDoctorAppointments({
      date: selectedDate,
      bucket: 'today',
      page: 1,
      limit: 100,
    })
      .then((response) => {
        if (!active) return
        const data = response.data?.data
        if (!Array.isArray(data)) {
          setAppointments([])
          setAppointmentsError('The appointment response could not be read.')
          return
        }
        setAppointments(data)
        setAppointmentsError('')
      })
      .catch((requestError) => {
        if (!active) return
        setAppointments([])
        setAppointmentsError(
          requestError.response?.data?.message ||
            'Unable to load appointments for this date.',
        )
      })
      .finally(() => {
        if (active) setAppointmentsLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedDate])

  const selectDate = (dateKey) => {
    if (dateKey === selectedDate) return
    setAppointmentsLoading(true)
    setAppointmentsError('')
    setSelectedDate(dateKey)
  }

  const changeMonth = (offset) => {
    const nextMonth = new Date(
      Date.UTC(
        visibleMonth.getUTCFullYear(),
        visibleMonth.getUTCMonth() + offset,
        1,
      ),
    )
    setVisibleMonth(nextMonth)
    selectDate(
      toDateKey(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1),
    )
  }

  const updateWeeklyDay = (day, periods) => {
    onChange({
      ...schedule,
      weeklySchedule: { ...schedule.weeklySchedule, [day]: periods },
    })
  }

  const replaceOverride = (value) => {
    const existingIndex = schedule.dateOverrides.findIndex(
      (override) => override.date === selectedDate,
    )
    const overrides = [...schedule.dateOverrides]
    if (existingIndex >= 0) overrides[existingIndex] = value
    else overrides.push(value)
    onChange({ ...schedule, dateOverrides: overrides })
  }

  const useWeeklySchedule = () => {
    onChange({
      ...schedule,
      dateOverrides: schedule.dateOverrides.filter(
        (override) => override.date !== selectedDate,
      ),
    })
  }

  const markUnavailable = () => {
    const existing = overrideForDate(selectedDate)
    replaceOverride({
      ...(existing?._id ? { _id: existing._id } : {}),
      date: selectedDate,
      type: 'unavailable',
      periods: [],
    })
  }

  const openCustomOverride = () => {
    const current = overrideForDate(selectedDate)
    const periods =
      current?.type === 'custom'
        ? current.periods
        : getEffectivePeriods(selectedDate)
    setOverridePeriods(
      periods.length ? periods.map((period) => ({ ...period })) : [{ ...defaultPeriod }],
    )
    setOverrideOpen(true)
  }

  const saveCustomOverride = () => {
    if (!overridePeriods.length) return
    const existing = overrideForDate(selectedDate)
    replaceOverride({
      ...(existing?._id ? { _id: existing._id } : {}),
      date: selectedDate,
      type: 'custom',
      periods: overridePeriods,
    })
    setOverrideOpen(false)
  }

  const saveWeeklySchedule = async () => {
    const saved = await onSave()
    if (saved) setWeeklyOpen(false)
  }

  const selectedOverride = overrideForDate(selectedDate)
  const selectedPeriods = getEffectivePeriods(selectedDate)
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(visibleMonth)

  return (
    <Stack spacing={2.5}>
      {error && <Alert severity="error">{error}</Alert>}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <span className={`schedule-status-dot is-${schedule.status}`} />
          <Typography fontWeight={700} sx={{ textTransform: 'capitalize' }}>
            {schedule.status} schedule
          </Typography>
          <Typography variant="body2" color="text.secondary">Asia/Manila</Typography>
        </Stack>
        {editable && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" onClick={() => setWeeklyOpen(true)}>
              Edit Weekly Availability
            </Button>
            <Button variant="contained" disabled={saving} onClick={onSave}>
              {saving ? 'Saving…' : 'Save Schedule'}
            </Button>
          </Stack>
        )}
      </Stack>

      <Box className="doctor-calendar-layout">
        <Paper className="doctor-calendar-card">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <Typography variant="h5" fontWeight={750}>{monthLabel}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <IconButton
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeftOutlinedIcon />
              </IconButton>
              <Button
                onClick={() => {
                  setVisibleMonth(new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1)))
                  selectDate(todayKey)
                }}
              >
                Today
              </Button>
              <IconButton
                aria-label="Next month"
                onClick={() => changeMonth(1)}
              >
                <ChevronRightOutlinedIcon />
              </IconButton>
            </Stack>
          </Stack>

          <Box className="doctor-calendar-weekdays">
            {weekdayLabels.map((day) => <Typography key={day}>{day}</Typography>)}
          </Box>
          <Box className="doctor-calendar-grid">
            {calendarDays.map((calendarDay) => {
              if (calendarDay.blank) return <Box key={calendarDay.key} />
              const periods = getEffectivePeriods(calendarDay.key)
              const override = overrideForDate(calendarDay.key)
              const classNames = [
                'doctor-calendar-day',
                calendarDay.key === todayKey ? 'is-today' : '',
                calendarDay.key === selectedDate ? 'is-selected' : '',
                periods.length ? 'is-available' : '',
                override?.type === 'unavailable' ? 'is-unavailable' : '',
              ].filter(Boolean).join(' ')
              return (
                <Button
                  key={calendarDay.key}
                  className={classNames}
                  onClick={() => selectDate(calendarDay.key)}
                  aria-label={`Select ${formatSelectedDate(calendarDay.key)}`}
                >
                  <span>{calendarDay.day}</span>
                  {(periods.length > 0 || override?.type === 'unavailable') && (
                    <span className="doctor-calendar-indicator" />
                  )}
                </Button>
              )
            })}
          </Box>
          <Stack direction="row" spacing={2} className="doctor-calendar-legend">
            <Typography variant="caption"><span className="legend-dot is-available" /> Available</Typography>
            <Typography variant="caption"><span className="legend-dot is-unavailable" /> Unavailable override</Typography>
          </Stack>
        </Paper>

        <Paper className="doctor-calendar-side-panel">
          <Typography variant="overline" color="primary">Selected date</Typography>
          <Typography variant="h6">{formatSelectedDate(selectedDate)}</Typography>

          <Typography fontWeight={750} sx={{ mt: 2.5 }}>Date Overrides</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Adjust availability for a specific date without changing the regular weekly schedule.
          </Typography>

          <Box className="doctor-selected-availability">
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight={750}>Availability</Typography>
              {selectedOverride && (
                <Typography variant="caption" color="primary">Date override</Typography>
              )}
            </Stack>
            {selectedPeriods.length ? (
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {selectedPeriods.map((period, index) => (
                  <Typography key={`${period.startTime}-${index}`} variant="body2">
                    {formatPeriod(period)}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Unavailable
              </Typography>
            )}
            {editable && (
              <Stack spacing={0.75} sx={{ mt: 2, alignItems: 'flex-start' }}>
                <Button size="small" startIcon={<EditOutlinedIcon />} onClick={openCustomOverride}>
                  {selectedOverride?.type === 'custom' ? 'Edit Date Override' : 'Add Date Override'}
                </Button>
                <Button size="small" color="error" onClick={markUnavailable}>
                  Mark Unavailable
                </Button>
                {selectedOverride && (
                  <Button size="small" onClick={useWeeklySchedule}>Use Weekly Schedule</Button>
                )}
              </Stack>
            )}
          </Box>

          <Divider sx={{ my: 2.5 }} />
          <Typography fontWeight={750}>Appointments</Typography>
          {appointmentsLoading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : appointmentsError ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>{appointmentsError}</Alert>
          ) : appointments.length ? (
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              {appointments.map((appointment) => (
                <Box key={appointment._id} className="doctor-calendar-appointment">
                  <Typography variant="body2" fontWeight={750}>
                    {formatTime(appointment.startAt)}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650}>
                      {appointment.patientId
                        ? `${appointment.patientId.firstName} ${appointment.patientId.lastName}`
                        : 'Patient unavailable'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {appointment.serviceId?.name || 'Service unavailable'}
                    </Typography>
                  </Box>
                  <StatusChip status={appointment.status} />
                </Box>
              ))}
            </Stack>
          ) : (
            <Box className="doctor-calendar-empty">
              <Typography variant="body2" color="text.secondary">
                No appointments on this date.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Dialog open={weeklyOpen} onClose={() => setWeeklyOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Edit Weekly Availability</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
              <InputLabel>Schedule Status</InputLabel>
              <Select
                label="Schedule Status"
                value={schedule.status}
                onChange={(event) => onChange({ ...schedule, status: event.target.value })}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            {editorDays.map((day) => {
              const periods = schedule.weeklySchedule[day] || []
              return (
                <Box key={day} className="doctor-weekly-day">
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'space-between', alignItems: 'center', mb: periods.length ? 2 : 0 }}
                  >
                    <Box>
                      <Typography fontWeight={750} sx={{ textTransform: 'capitalize' }}>{day}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {periods.length ? 'Available' : 'Unavailable'}
                      </Typography>
                    </Box>
                    <Switch
                      checked={periods.length > 0}
                      onChange={(event) =>
                        updateWeeklyDay(day, event.target.checked ? [{ ...defaultPeriod }] : [])
                      }
                      inputProps={{ 'aria-label': `Set ${day} availability` }}
                    />
                  </Stack>
                  {periods.length > 0 && (
                    <PeriodEditor periods={periods} onChange={(value) => updateWeeklyDay(day, value)} />
                  )}
                </Box>
              )
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeeklyOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveWeeklySchedule} disabled={saving}>
            {saving ? 'Saving...' : 'Save Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={overrideOpen} onClose={() => setOverrideOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Date Override · {formatSelectedDate(selectedDate)}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These hours replace the weekly availability for this date only.
          </Typography>
          <PeriodEditor periods={overridePeriods} onChange={setOverridePeriods} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!overridePeriods.length} onClick={saveCustomOverride}>
            Apply Override
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default DoctorScheduleCalendar
