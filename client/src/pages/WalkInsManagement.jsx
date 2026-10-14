import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { getServices } from '../services/serviceApi'
import {
  createWalkIn,
  getWalkInDoctor,
} from '../services/appointmentApi'
import { searchWalkInPatients } from '../services/patientApi'

const steps = ['Patient', 'Service', 'Review']

function WalkInsManagement() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queuePath = user?.role === 'admin' ? '/admin/queue' : '/receptionist/queue'
  const [step, setStep] = useState(0)
  const [patientMode, setPatientMode] = useState('existing')
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
  })
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [doctorPreview, setDoctorPreview] = useState(null)
  const [doctorLoading, setDoctorLoading] = useState(false)
  const doctorRequestSequence = useRef(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    getServices({ status: 'active', limit: 100 })
      .then((response) => {
        if (active) setServices(response.data.data || [])
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.message || 'Unable to load services.')
        }
      })
      .finally(() => {
        if (active) setServiceLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const timeout = setTimeout(() => {
      const query = search.trim()
      if (patientMode !== 'existing' || query.length < 2) {
        setPatients([])
        setPatientLoading(false)
        return
      }
      setPatientLoading(true)
      searchWalkInPatients({ search: query, limit: 10 })
        .then((response) => {
          if (active) setPatients(response.data.data || [])
        })
        .catch((err) => {
          if (active) {
            setPatients([])
            setError(err.response?.data?.message || 'Unable to search patients.')
          }
        })
        .finally(() => {
          if (active) setPatientLoading(false)
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [patientMode, search])

  const handleSelectService = async (service) => {
    const requestSequence = doctorRequestSequence.current + 1
    doctorRequestSequence.current = requestSequence
    setSelectedService({ ...service })
    setError('')
    setDoctorPreview(null)
    setDoctorLoading(true)
    try {
      const response = await getWalkInDoctor(service._id)
      if (doctorRequestSequence.current === requestSequence) {
        setDoctorPreview({
          serviceId: service._id,
          doctor: response.data,
        })
      }
    } catch (err) {
      if (doctorRequestSequence.current === requestSequence) {
        setError(
          err.response?.data?.message ||
            'No on-duty doctor is currently available for this service.',
        )
      }
    } finally {
      if (doctorRequestSequence.current === requestSequence) {
        setDoctorLoading(false)
      }
    }
  }

  const currentDoctorPreview =
    doctorPreview?.serviceId === selectedService?._id
      ? doctorPreview.doctor
      : null

  const patientName = useMemo(() => {
    if (patientMode === 'existing') {
      return selectedPatient
        ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
        : ''
    }
    return `${newPatient.firstName.trim()} ${newPatient.lastName.trim()}`.trim()
  }, [newPatient.firstName, newPatient.lastName, patientMode, selectedPatient])

  const patientIsValid =
    patientMode === 'existing'
      ? Boolean(selectedPatient)
      : Boolean(
          newPatient.firstName.trim() &&
            newPatient.lastName.trim() &&
            newPatient.email.trim(),
        )

  const handleNext = () => {
    setError('')
    if (step === 0 && !patientIsValid) {
      setError(
        patientMode === 'existing'
          ? 'Search for and select a patient to continue.'
          : 'First name, last name, and email are required.',
      )
      return
    }
    if (step === 1 && (!selectedService || !currentDoctorPreview)) {
      setError('Select a service with an available on-duty doctor.')
      return
    }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const response = await createWalkIn({
        serviceId: selectedService._id,
        ...(patientMode === 'existing'
          ? { patientId: selectedPatient._id }
          : { newPatient }),
      })
      setSuccess(response.data.data)
      setNotice(
        `Walk-in added to the queue at position ${response.data.data.queuePosition}.`,
      )
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to add the walk-in to the queue.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box component="section" sx={{ width: '100%', minWidth: 0 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Walk-Ins</Typography>
        <Typography color="text.secondary">
          Register a walk-in patient and add them to the next available doctor&apos;s queue.
        </Typography>
      </Stack>

      <Card sx={{ width: '100%' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {success ? (
            <Stack spacing={2}>
              <Alert severity="success">{notice}</Alert>
              <Typography variant="body2">
                {patientName} is assigned to Dr. {success.queueEntry?.doctorId?.firstName}{' '}
                {success.queueEntry?.doctorId?.lastName}.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="contained" onClick={() => navigate(queuePath)}>
                  View Queue
                </Button>
                <Button
                  onClick={() => {
                    setSuccess(null)
                    setStep(0)
                    setPatientMode('existing')
                    setSearch('')
                    setSelectedPatient(null)
                    setSelectedService(null)
                    setNewPatient({
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      email: '',
                      mobileNumber: '',
                    })
                  }}
                >
                  Add Another Walk-In
                </Button>
              </Stack>
            </Stack>
          ) : (
            <>
              <Stepper activeStep={step} sx={{ mb: 3 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              {step === 0 && (
                <Stack spacing={2.5}>
                  <RadioGroup
                    row
                    value={patientMode}
                    onChange={(event) => {
                      setPatientMode(event.target.value)
                      setSelectedPatient(null)
                      setError('')
                    }}
                  >
                    <FormControlLabel
                      value="existing"
                      control={<Radio />}
                      label="Existing patient"
                    />
                    <FormControlLabel
                      value="new"
                      control={<Radio />}
                      label="New patient"
                    />
                  </RadioGroup>
                  {patientMode === 'existing' ? (
                    <Stack spacing={1.5}>
                      <Autocomplete
                        options={patients}
                        value={selectedPatient}
                        inputValue={search}
                        loading={patientLoading}
                        filterOptions={(options) => options}
                        getOptionLabel={(option) =>
                          `${option.firstName} ${option.lastName} · ${option.patientNumber}`
                        }
                        isOptionEqualToValue={(option, value) =>
                          option._id === value._id
                        }
                        onInputChange={(_, value, reason) => {
                          if (reason === 'input') setSearch(value)
                        }}
                        onChange={(_, value) => setSelectedPatient(value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Search patients"
                            placeholder="Name, patient number, email, or mobile"
                            helperText="Enter at least two characters."
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {patientLoading && (
                                    <CircularProgress color="inherit" size={18} />
                                  )}
                                  {params.InputProps.endAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                      {selectedPatient && (
                        <Alert severity="info">
                          Selected: {selectedPatient.firstName}{' '}
                          {selectedPatient.middleName}{' '}
                          {selectedPatient.lastName} ·{' '}
                          {selectedPatient.patientNumber}
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'minmax(0, 1fr)',
                          sm: 'repeat(2, minmax(0, 1fr))',
                        },
                        gap: 2,
                      }}
                    >
                      <TextField
                        required
                        label="First name"
                        value={newPatient.firstName}
                        onChange={(event) =>
                          setNewPatient((prev) => ({
                            ...prev,
                            firstName: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        label="Middle name"
                        value={newPatient.middleName}
                        onChange={(event) =>
                          setNewPatient((prev) => ({
                            ...prev,
                            middleName: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        required
                        label="Last name"
                        value={newPatient.lastName}
                        onChange={(event) =>
                          setNewPatient((prev) => ({
                            ...prev,
                            lastName: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        required
                        type="email"
                        label="Email"
                        value={newPatient.email}
                        onChange={(event) =>
                          setNewPatient((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        label="Mobile number (optional)"
                        value={newPatient.mobileNumber}
                        onChange={(event) =>
                          setNewPatient((prev) => ({
                            ...prev,
                            mobileNumber: event.target.value,
                          }))
                        }
                        inputProps={{ maxLength: 11 }}
                      />
                    </Box>
                  )}
                </Stack>
              )}

              {step === 1 && (
                <Stack spacing={2}>
                  {serviceLoading ? (
                    <CircularProgress size={24} />
                  ) : services.length ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'minmax(0, 1fr)',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          lg: 'repeat(3, minmax(0, 1fr))',
                        },
                        gap: 2,
                      }}
                    >
                      {services.map((service) => (
                        <Card
                          key={service._id}
                          variant="outlined"
                          sx={{
                            borderColor:
                              selectedService?._id === service._id
                                ? 'primary.main'
                                : 'divider',
                          }}
                        >
                          <CardActionArea
                            onClick={() => handleSelectService(service)}
                          >
                            <CardContent>
                              <Typography fontWeight={600}>
                                {service.name}
                              </Typography>
                              {service.description && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ mt: 0.5 }}
                                >
                                  {service.description}
                                </Typography>
                              )}
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {service.durationMinutes} mins · ₱
                                {Number(service.fee || 0).toLocaleString()}
                              </Typography>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    <Alert severity="info">
                      There are no active clinic services.
                    </Alert>
                  )}
                  {selectedService && (
                    <Alert
                      severity={
                        doctorLoading
                          ? 'info'
                          : currentDoctorPreview
                            ? 'success'
                            : 'warning'
                      }
                    >
                      {doctorLoading
                        ? 'Checking on-duty doctors and queue lengths...'
                        : currentDoctorPreview
                          ? `Suggested doctor: Dr. ${currentDoctorPreview.doctor.firstName} ${currentDoctorPreview.doctor.lastName} · ${currentDoctorPreview.activeQueueCount} active in queue`
                          : 'No on-duty doctor currently supports this service.'}
                    </Alert>
                  )}
                </Stack>
              )}

              {step === 2 && (
                <Stack spacing={2}>
                  <Typography variant="h6">Confirm walk-in details</Typography>
                  <Divider />
                  <Typography>
                    <strong>Patient:</strong> {patientName}
                  </Typography>
                  {patientMode === 'existing' && selectedPatient && (
                    <Typography color="text.secondary">
                      {selectedPatient.patientNumber} · {selectedPatient.email}
                    </Typography>
                  )}
                  <Typography>
                    <strong>Service:</strong> {selectedService?.name}
                  </Typography>
                  <Typography>
                    <strong>Suggested doctor:</strong>{' '}
                    {currentDoctorPreview
                      ? `Dr. ${currentDoctorPreview.doctor.firstName} ${currentDoctorPreview.doctor.lastName} (${currentDoctorPreview.activeQueueCount} active in queue)`
                      : 'Unavailable'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The assignment is checked again when the walk-in is added.
                  </Typography>
                </Stack>
              )}

              <Stack
                direction={{ xs: 'column-reverse', sm: 'row' }}
                justifyContent="space-between"
                spacing={1.5}
                sx={{ mt: 3 }}
              >
                <Button
                  disabled={step === 0 || submitting}
                  onClick={() => {
                    setError('')
                    setStep((current) => Math.max(current - 1, 0))
                  }}
                >
                  Back
                </Button>
                {step < steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={
                      (step === 1 &&
                        (serviceLoading ||
                          doctorLoading ||
                          !currentDoctorPreview)) ||
                      (step === 0 && !patientIsValid)
                    }
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting || !currentDoctorPreview}
                  >
                    {submitting ? 'Adding to Queue…' : 'Add to Queue'}
                  </Button>
                )}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
      <Snackbar
        open={Boolean(notice && success)}
        autoHideDuration={6000}
        onClose={() => setNotice('')}
        message={notice}
      />
    </Box>
  )
}

export default WalkInsManagement
