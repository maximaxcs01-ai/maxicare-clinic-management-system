import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoctorAvatar from '../components/DoctorAvatar'
import { createAppointment } from '../services/appointmentApi'
import { getOwnPatient } from '../services/patientApi'
import { getAvailability } from '../services/scheduleApi'
import { getDoctors } from '../services/doctorApi'
import { getServices } from '../services/serviceApi'

const STEPS = ['Service', 'Doctor', 'Schedule', 'Details', 'Review']
const getManilaDate = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

const getMonthStart = (date) => `${date.slice(0, 7)}-01`

const shiftMonth = (monthStart, amount) => {
  const [year, month] = monthStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1 + amount, 1))
  return next.toISOString().slice(0, 10)
}

const getCalendarDays = (monthStart) => {
  const [year, month] = monthStart.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return [
    ...Array.from({ length: firstWeekday }, (_, index) => ({
      key: `empty-${index}`,
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      return {
        key: `${year}-${month}-${day}`,
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      }
    }),
  ]
}

const formatMonth = (monthStart) =>
  new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${monthStart}T00:00:00.000Z`))

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'full',
    timeZone: 'Asia/Manila',
  }).format(new Date(`${date}T00:00:00+08:00`))

const formatTime = (time) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(`2020-01-01T${time}:00+08:00`))

function BookAppointment() {
  const navigate = useNavigate()
  const submitLock = useRef(false)
  const today = getManilaDate()
  const maximumDate = addDays(today, 60)
  const [activeStep, setActiveStep] = useState(0)
  const [services, setServices] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patient, setPatient] = useState(null)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(today))
  const [selectedTime, setSelectedTime] = useState('')
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [slots, setSlots] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')

  const selectedService = services.find((service) => service._id === selectedServiceId)
  const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId)
  const calendarDays = getCalendarDays(calendarMonth)
  const canShowPreviousMonth = calendarMonth > getMonthStart(today)
  const canShowNextMonth = calendarMonth < getMonthStart(maximumDate)

  useEffect(() => {
    let active = true
    Promise.all([getServices({ limit: 100 }), getOwnPatient()])
      .then(([servicesResponse, patientResponse]) => {
        if (!active) return
        const serviceData = servicesResponse.data?.data
        if (!Array.isArray(serviceData)) {
          throw new Error('The service response could not be read.')
        }
        setServices(serviceData)
        setPatient(patientResponse.data?.data || null)
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load booking information.',
          )
        }
      })
      .finally(() => {
        if (active) setInitialLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedServiceId) return undefined
    let active = true
    getDoctors({ serviceId: selectedServiceId, limit: 100 })
      .then((response) => {
        if (!active) return
        const data = response.data?.data
        if (!Array.isArray(data)) {
          setDoctors([])
          setError('The doctor response could not be read.')
          return
        }
        setDoctors(data)
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load doctors for this service.',
          )
        }
      })
      .finally(() => {
        if (active) setDoctorsLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedServiceId])

  useEffect(() => {
    if (!selectedDoctorId || !selectedServiceId || !selectedDate) {
      return undefined
    }
    let active = true
    getAvailability({
      doctorId: selectedDoctorId,
      serviceId: selectedServiceId,
      date: selectedDate,
    })
      .then((response) => {
        if (!active) return
        const availableSlots = response.data?.slots
        if (!Array.isArray(availableSlots)) {
          setSlots([])
          setAvailabilityError('The availability response could not be read.')
          return
        }
        setSlots(availableSlots.filter((slot) => slot.available))
        setAvailabilityError('')
      })
      .catch((requestError) => {
        if (!active) return
        setSlots([])
        setAvailabilityError(
          requestError.response?.data?.message ||
            'Unable to load available appointment slots.',
        )
      })
      .finally(() => {
        if (active) setSlotsLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedDate, selectedDoctorId, selectedServiceId])

  const selectService = (serviceId) => {
    setSelectedServiceId(serviceId)
    setSelectedDoctorId('')
    setSelectedDate('')
    setSelectedTime('')
    setCalendarMonth(getMonthStart(today))
    setDoctors([])
    setSlots([])
    setAvailabilityError('')
    setDoctorsLoading(Boolean(serviceId))
    setActiveStep(0)
    setError('')
  }

  const selectDoctor = (doctorId) => {
    setSelectedDoctorId(doctorId)
    setSelectedDate('')
    setSelectedTime('')
    setCalendarMonth(getMonthStart(today))
    setSlots([])
    setAvailabilityError('')
    setActiveStep(1)
  }

  const selectDate = (date) => {
    setSelectedDate(date)
    setSelectedTime('')
    setSlots([])
    setAvailabilityError('')
    setSlotsLoading(Boolean(date))
  }

  const canContinue = () => {
    if (activeStep === 0) return Boolean(selectedServiceId)
    if (activeStep === 1) return Boolean(selectedDoctorId)
    if (activeStep === 2) {
      return Boolean(
        selectedDate &&
          selectedTime &&
          slots.some((slot) => slot.time === selectedTime && slot.available),
      )
    }
    if (activeStep === 3) return true
    return false
  }

  const confirmBooking = async () => {
    if (
      submitLock.current ||
      !selectedService ||
      !selectedDoctor ||
      !selectedTime ||
      !slots.some((slot) => slot.time === selectedTime && slot.available)
    ) {
      return
    }
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      await createAppointment({
        serviceId: selectedServiceId,
        doctorId: selectedDoctorId,
        date: selectedDate,
        time: selectedTime,
        reasonForVisit,
      })
      navigate('/patient/appointments', {
        replace: true,
        state: { message: 'Appointment booked successfully.' },
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to book the selected appointment. Please try again.',
      )
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  if (initialLoading) {
    return (
      <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box component="section" className="patient-page booking-page" sx={{ width: '100%' }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Book Appointment</Typography>
        <Typography color="text.secondary">
          Choose a service, doctor, and available appointment time.
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper className="booking-shell" sx={{ width: '100%', p: { xs: 2, sm: 3 }, border: 1, borderColor: 'divider' }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Stack spacing={2}>
            <Typography variant="h6">Select a service</Typography>
            {services.length === 0 ? (
              <Alert severity="info">No active services are currently available.</Alert>
            ) : (
              <RadioGroup
                value={selectedServiceId}
                onChange={(event) => selectService(event.target.value)}
              >
                <Box className="booking-service-grid">
                  {services.map((service) => (
                    <Card
                      key={service._id}
                      variant="outlined"
                      sx={{
                        borderColor:
                          selectedServiceId === service._id ? 'primary.main' : 'divider',
                        bgcolor:
                          selectedServiceId === service._id
                            ? 'rgba(37, 99, 166, 0.05)'
                            : 'background.paper',
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <FormControlLabel
                          value={service._id}
                          control={<Radio />}
                          label={
                            <Box sx={{ width: '100%', minWidth: 0 }}>
                              <Stack direction="row" justifyContent="space-between" gap={1}>
                                <Typography fontWeight={700}>{service.name}</Typography>
                                {selectedServiceId === service._id && (
                                  <CheckCircleOutlinedIcon color="primary" fontSize="small" />
                                )}
                              </Stack>
                              <Typography variant="body2" color="text.secondary">
                                {service.description}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {service.durationMinutes} minutes · ₱
                                {Number(service.fee).toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                })}
                              </Typography>
                            </Box>
                          }
                          sx={{ m: 0, width: '100%' }}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </RadioGroup>
            )}
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Typography variant="h6">Select a doctor</Typography>
            {doctorsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            ) : doctors.length === 0 ? (
              <Alert severity="info">
                No active doctors currently offer this service.
              </Alert>
            ) : (
              <RadioGroup
                value={selectedDoctorId}
                onChange={(event) => selectDoctor(event.target.value)}
              >
                <Stack spacing={1.25}>
                  {doctors.map((doctor) => (
                    <Card
                      key={doctor._id}
                      className="booking-doctor-card"
                      variant="outlined"
                      sx={{
                        borderColor:
                          selectedDoctorId === doctor._id ? 'primary.main' : 'divider',
                        bgcolor:
                          selectedDoctorId === doctor._id
                            ? 'rgba(37, 99, 166, 0.05)'
                            : 'background.paper',
                      }}
                    >
                      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <FormControlLabel
                          className="booking-doctor-option"
                          value={doctor._id}
                          control={<Radio className="booking-doctor-radio" />}
                          labelPlacement="start"
                          label={
                            <Stack className="booking-doctor-details" direction="row" spacing={2} alignItems="center">
                              <DoctorAvatar
                                className="booking-doctor-avatar"
                                imageUrl={doctor.profileImage?.url}
                                firstName={doctor.firstName}
                                lastName={doctor.lastName}
                                size={96}
                              />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography className="booking-doctor-name" fontWeight={700}>
                                  Dr. {doctor.firstName} {doctor.lastName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {doctor.specialization || 'Medical Doctor'}
                                </Typography>
                                {selectedService && (
                                  <Typography className="booking-doctor-service" variant="caption">
                                    {selectedService.name}
                                  </Typography>
                                )}
                              </Box>
                              {selectedService?.fee != null && (
                                <Typography className="booking-doctor-fee" fontWeight={700}>
                                  ₱{Number(selectedService.fee).toLocaleString('en-PH', {
                                    minimumFractionDigits: 2,
                                  })}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </RadioGroup>
            )}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2.5}>
            <Typography variant="h6">Choose a date and available time</Typography>
            <Box className="booking-schedule-grid">
              <Paper variant="outlined" className="booking-calendar-panel">
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <IconButton
                    aria-label="Previous month"
                    disabled={!canShowPreviousMonth}
                    onClick={() => setCalendarMonth((month) => shiftMonth(month, -1))}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <Typography fontWeight={750}>{formatMonth(calendarMonth)}</Typography>
                  <IconButton
                    aria-label="Next month"
                    disabled={!canShowNextMonth}
                    onClick={() => setCalendarMonth((month) => shiftMonth(month, 1))}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Stack>
                <Box className="booking-calendar-weekdays" aria-hidden="true">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Typography key={day} variant="caption">{day}</Typography>
                  ))}
                </Box>
                <Box className="booking-calendar-grid" role="grid" aria-label="Appointment date">
                  {calendarDays.map((calendarDay) =>
                    calendarDay.date ? (
                      <ButtonBase
                        key={calendarDay.key}
                        className={`booking-calendar-day${
                          selectedDate === calendarDay.date ? ' is-selected' : ''
                        }${calendarDay.date === today ? ' is-today' : ''}`}
                        disabled={
                          calendarDay.date < today || calendarDay.date > maximumDate
                        }
                        onClick={() => selectDate(calendarDay.date)}
                        aria-label={formatDate(calendarDay.date)}
                        aria-pressed={selectedDate === calendarDay.date}
                        role="gridcell"
                      >
                        {calendarDay.day}
                      </ButtonBase>
                    ) : (
                      <span key={calendarDay.key} aria-hidden="true" />
                    ),
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Select a date within the next 60 days.
                </Typography>
              </Paper>
              <Paper variant="outlined" className="booking-slots-panel">
                <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                  Available 30-minute slots
                </Typography>
                {!selectedDate ? (
                  <Typography color="text.secondary" variant="body2">
                    Select a date to view real-time availability.
                  </Typography>
                ) : slotsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Loading availability...</Typography>
                  </Box>
                ) : availabilityError ? (
                  <Alert severity="error">{availabilityError}</Alert>
                ) : slots.length === 0 ? (
                  <Alert severity="info">
                    No available appointment slots for this date.
                  </Alert>
                ) : (
                  <Box className="booking-slot-grid">
                    {slots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? 'contained' : 'outlined'}
                        startIcon={<AccessTimeOutlinedIcon />}
                        onClick={() => setSelectedTime(slot.time)}
                      >
                        {formatTime(slot.time)}
                      </Button>
                    ))}
                  </Box>
                )}
              </Paper>
            </Box>
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={2}>
            <Typography variant="h6">Visit details</Typography>
            <Typography variant="body2" color="text.secondary">
              Add information that can help your care team prepare for the visit.
            </Typography>
            <TextField
              label="Reason for visit (optional)"
              value={reasonForVisit}
              onChange={(event) => setReasonForVisit(event.target.value)}
              multiline
              minRows={4}
              inputProps={{ maxLength: 1000 }}
              helperText={`${reasonForVisit.length}/1000 characters`}
            />
          </Stack>
        )}

        {activeStep === 4 && selectedService && selectedDoctor && (
          <Stack spacing={2}>
            <Typography variant="h6">Review your appointment</Typography>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack spacing={1.25}>
                <Typography><strong>Service:</strong> {selectedService.name}</Typography>
                <Typography>
                  <strong>Doctor:</strong> Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                </Typography>
                <Typography><strong>Date:</strong> {formatDate(selectedDate)}</Typography>
                <Typography><strong>Time:</strong> {formatTime(selectedTime)}</Typography>
                <Typography><strong>Reason:</strong> {reasonForVisit || 'Not provided'}</Typography>
                <Typography>
                  <strong>Patient:</strong>{' '}
                  {[patient?.firstName, patient?.middleName, patient?.lastName]
                    .filter(Boolean)
                    .join(' ')}
                </Typography>
              </Stack>
            </Paper>
            <Alert severity="info">
              Your appointment will be created with Pending status.
            </Alert>
          </Stack>
        )}

        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ mt: 4 }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            disabled={activeStep === 0 || submitting}
            onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
          >
            Back
          </Button>
          {activeStep < STEPS.length - 1 ? (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              disabled={!canContinue() || (activeStep === 1 && doctorsLoading) || (activeStep === 2 && slotsLoading)}
              onClick={() => setActiveStep((step) => step + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={confirmBooking}
              disabled={submitting}
            >
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

export default BookAppointment
