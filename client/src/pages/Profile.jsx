import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import ProfileAvatar from '../components/ProfileAvatar'
import useAuth from '../hooks/useAuth'
import {
  getMyDoctor,
  updateMyProfileImage,
} from '../services/doctorApi'
import { getOwnPatient, updateOwnPatient } from '../services/patientApi'
import { updateOwnProfileImage } from '../services/userApi'
import {
  philippineLocations,
  philippineProvinces,
} from '../data/philippineLocations'

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EMPTY_PATIENT_FORM = {
  sex: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: '',
  },
  mobileNumber: '',
  dateOfBirth: '',
}

function Detail({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ mt: 0.25 }}>{value || 'Not provided'}</Typography>
    </Box>
  )
}

function getPatientForm(patient) {
  const address =
    patient?.address && typeof patient.address === 'object'
      ? patient.address
      : {}
  const dob = patient?.dateOfBirth
    ? String(patient.dateOfBirth).slice(0, 10)
    : ''

  return {
    sex: patient?.sex || patient?.gender || '',
    address: {
      street: address.street || '',
      barangay: address.barangay || '',
      city: address.city || '',
      province: address.province || '',
      zipCode: address.zipCode || '',
    },
    mobileNumber: patient?.mobileNumber || patient?.contactNumber || '',
    dateOfBirth: dob,
  }
}

function ProfilePhoto({
  imageUrl,
  imagePreview,
  firstName,
  lastName,
  selectedFile,
  uploading,
  onSelect,
  onSave,
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
      sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
    >
      <ProfileAvatar
        imageUrl={imagePreview || imageUrl}
        firstName={firstName}
        lastName={lastName}
        size={132}
        sx={{ bgcolor: 'primary.main', fontSize: '1.8rem', fontWeight: 700 }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" fontWeight={700}>Profile Photo</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.5 }}>
          <Button
            component="label"
            variant="outlined"
            startIcon={<PhotoCameraOutlinedIcon />}
            disabled={uploading}
          >
            {imageUrl ? 'Change Photo' : 'Upload Photo'}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onSelect}
            />
          </Button>
          {selectedFile && (
            <Button
              variant="contained"
              onClick={onSave}
              disabled={uploading}
            >
              {uploading ? 'Saving...' : 'Save Photo'}
            </Button>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          JPEG, PNG, or WebP. Maximum size 5 MB.
        </Typography>
        {selectedFile && (
          <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
            Selected: {selectedFile.name}
          </Typography>
        )}
      </Box>
    </Stack>
  )
}

function Profile() {
  const { user, updateUser } = useAuth()
  const isPatient = user?.role === 'patient'
  const isDoctor = user?.role === 'doctor'
  const fullName = [user?.firstName, user?.middleName, user?.lastName]
    .filter(Boolean)
    .join(' ')
  const [patient, setPatient] = useState(null)
  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT_FORM)
  const [patientLoading, setPatientLoading] = useState(isPatient)
  const [patientSaving, setPatientSaving] = useState(false)
  const [patientAttemptedSave, setPatientAttemptedSave] = useState(false)
  const [patientError, setPatientError] = useState('')
  const [doctor, setDoctor] = useState(null)
  const [doctorLoading, setDoctorLoading] = useState(isDoctor)
  const [doctorError, setDoctorError] = useState('')
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [notice, setNotice] = useState(null)

  const address = patientForm.address
  const cityOptions = useMemo(
    () => philippineLocations[address.province] || [],
    [address.province],
  )
  const patientFormValid =
    Boolean(patientForm.sex) &&
    Boolean(address.street.trim()) &&
    Boolean(address.barangay.trim()) &&
    Boolean(address.city) &&
    Boolean(address.province) &&
    (!patientForm.mobileNumber ||
      /^09\d{9}$/.test(patientForm.mobileNumber.trim()))

  useEffect(() => {
    if (!isPatient) return undefined
    let active = true
    getOwnPatient()
      .then((response) => {
        if (!active) return
        const nextPatient = response.data.data
        setPatient(nextPatient)
        setPatientForm(getPatientForm(nextPatient))
      })
      .catch((error) => {
        if (active) {
          setPatientError(
            error.response?.data?.message || 'Unable to load patient profile.',
          )
        }
      })
      .finally(() => {
        if (active) setPatientLoading(false)
      })
    return () => {
      active = false
    }
  }, [isPatient])

  useEffect(() => {
    if (!isDoctor) return undefined
    let active = true
    getMyDoctor()
      .then((response) => {
        if (active) {
          setDoctor(response.data.data)
          setDoctorError('')
        }
      })
      .catch((error) => {
        if (active) {
          setDoctorError(
            error.response?.data?.message || 'Unable to load doctor profile.',
          )
        }
      })
      .finally(() => {
        if (active) setDoctorLoading(false)
      })
    return () => {
      active = false
    }
  }, [isDoctor])

  useEffect(
    () => () => {
      if (profileImagePreview) URL.revokeObjectURL(profileImagePreview)
    },
    [profileImagePreview],
  )

  const selectProfileImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProfileImageFile(null)
    setProfileImagePreview('')
    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setNotice({
        severity: 'error',
        message: 'Select a JPEG, PNG, or WebP image.',
      })
      return
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setNotice({
        severity: 'error',
        message: 'Profile photo must not exceed 5 MB.',
      })
      return
    }
    setProfileImageFile(file)
    setProfileImagePreview(URL.createObjectURL(file))
  }

  const saveProfileImage = async () => {
    if (!profileImageFile) return
    try {
      setImageUploading(true)
      const response = isDoctor
        ? await updateMyProfileImage(profileImageFile)
        : await updateOwnProfileImage(profileImageFile)
      const updatedProfile = response.data.data
      if (isDoctor) setDoctor(updatedProfile)
      updateUser({ profileImage: updatedProfile.profileImage })
      setProfileImageFile(null)
      setProfileImagePreview('')
      setNotice({
        severity: 'success',
        message: response.data.message || 'Profile photo updated successfully.',
      })
    } catch (error) {
      setNotice({
        severity: 'error',
        message:
          error.response?.data?.message || 'Unable to update profile photo.',
      })
    } finally {
      setImageUploading(false)
    }
  }

  const savePatientDetails = async () => {
    setPatientAttemptedSave(true)
    if (!patientFormValid) {
      setNotice({
        severity: 'error',
        message: 'Complete Sex, Address, and enter a valid mobile number.',
      })
      return
    }

    try {
      setPatientSaving(true)
      const response = await updateOwnPatient(patientForm)
      setPatient(response.data.data)
      setPatientForm(getPatientForm(response.data.data))
      setNotice({
        severity: 'success',
        message: response.data.message || 'Profile updated successfully.',
      })
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.response?.data?.message || 'Unable to save profile.',
      })
    } finally {
      setPatientSaving(false)
    }
  }

  const setAddressField = (field, value) => {
    setPatientForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [field]: value,
        ...(field === 'province' ? { city: '' } : {}),
      },
    }))
  }

  if (isPatient) {
    const addressLabel = patient?.address
      ? Object.values(patient.address).filter(Boolean).join(', ')
      : ''

    return (
      <Box component="section" className="patient-page patient-profile-page">
        <Typography component="h1" variant="h4" sx={{ mb: 3 }}>My Profile</Typography>
        {patientError && <Alert severity="error" sx={{ mb: 2 }}>{patientError}</Alert>}
        {patientLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : patient && (
          <Stack spacing={3}>
            <Paper className="patient-profile-card" sx={{ p: { xs: 2.5, sm: 4 } }}>
              <ProfilePhoto
                imageUrl={user?.profileImage?.url}
                imagePreview={profileImagePreview}
                firstName={user?.firstName}
                lastName={user?.lastName}
                selectedFile={profileImageFile}
                uploading={imageUploading}
                onSelect={selectProfileImage}
                onSave={saveProfileImage}
              />
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Personal Information
              </Typography>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6 }}><Detail label="First Name" value={patient.firstName} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Detail label="Middle Name" value={patient.middleName} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Detail label="Last Name" value={patient.lastName} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Detail label="Email" value={user?.email || patient.email} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><Detail label="Patient Number" value={patient.patientNumber} /></Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5 }}>
                Editable Personal Details
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl
                    fullWidth
                    required
                    error={patientAttemptedSave && !patientForm.sex}
                  >
                    <InputLabel id="patient-profile-sex-label">Sex</InputLabel>
                    <Select
                      labelId="patient-profile-sex-label"
                      label="Sex"
                      value={patientForm.sex}
                      onChange={(event) =>
                        setPatientForm((current) => ({
                          ...current,
                          sex: event.target.value,
                        }))
                      }
                    >
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                    </Select>
                    {patientAttemptedSave && !patientForm.sex && (
                      <FormHelperText>Select your sex.</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date of Birth"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={patientForm.dateOfBirth}
                    onChange={(event) =>
                      setPatientForm((current) => ({
                        ...current,
                        dateOfBirth: event.target.value,
                      }))
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Street / House Number"
                    value={address.street}
                    required
                    error={patientAttemptedSave && !address.street.trim()}
                    helperText={
                      patientAttemptedSave && !address.street.trim()
                        ? 'Street or house number is required.'
                        : ''
                    }
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    onChange={(event) => setAddressField('street', event.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Barangay"
                    value={address.barangay}
                    required
                    error={patientAttemptedSave && !address.barangay.trim()}
                    helperText={
                      patientAttemptedSave && !address.barangay.trim()
                        ? 'Barangay is required.'
                        : ''
                    }
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    onChange={(event) => setAddressField('barangay', event.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    required
                    label="Province"
                    value={address.province}
                    error={patientAttemptedSave && !address.province}
                    onChange={(event) => setAddressField('province', event.target.value)}
                  >
                    {philippineProvinces.map((province) => (
                      <MenuItem key={province} value={province}>{province}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    required
                    label="City / Municipality"
                    value={address.city}
                    disabled={!cityOptions.length}
                    error={patientAttemptedSave && !address.city}
                    onChange={(event) => setAddressField('city', event.target.value)}
                  >
                    {cityOptions.map((city) => (
                      <MenuItem key={city} value={city}>{city}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="ZIP Code"
                    value={address.zipCode}
                    slotProps={{ htmlInput: { maxLength: 10 } }}
                    onChange={(event) => setAddressField('zipCode', event.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Mobile Number"
                    value={patientForm.mobileNumber}
                    slotProps={{ htmlInput: { maxLength: 11 } }}
                    error={Boolean(
                      patientForm.mobileNumber &&
                        !/^09\d{9}$/.test(patientForm.mobileNumber.trim()),
                    )}
                    helperText={
                      patientForm.mobileNumber &&
                      !/^09\d{9}$/.test(patientForm.mobileNumber.trim())
                        ? 'Enter 11 digits starting with 09.'
                        : 'Optional. Use 11 digits starting with 09.'
                    }
                    onChange={(event) =>
                      setPatientForm((current) => ({
                        ...current,
                        mobileNumber: event.target.value,
                      }))
                    }
                  />
                </Grid>
              </Grid>
              <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={savePatientDetails}
                disabled={patientSaving}
              >
                {patientSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Box sx={{ mt: 3 }}>
                <Detail label="Current Address" value={addressLabel} />
                <Detail label="Portal Status" value={patient.portalStatus} />
                <Detail label="Account Status" value={user?.status} />
              </Box>
            </Paper>
          </Stack>
        )}
        <Snackbar
          open={Boolean(notice)}
          autoHideDuration={5000}
          onClose={() => setNotice(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {notice && <Alert severity={notice.severity} variant="filled">{notice.message}</Alert>}
        </Snackbar>
      </Box>
    )
  }

  if (isDoctor) {
    return (
      <Box component="section" className="doctor-page doctor-profile-page">
        <Box className="doctor-page-header">
          <Typography component="h1" variant="h4">My Profile</Typography>
          <Typography color="text.secondary">Manage your professional profile and photo.</Typography>
        </Box>
        <Paper className="doctor-profile-card" sx={{ maxWidth: 900, p: { xs: 2.5, sm: 4 }, border: 1, borderColor: 'divider' }}>
          {doctorLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (
            <>
              {doctorError && <Alert severity="error" sx={{ mb: 3 }}>{doctorError}</Alert>}
              <ProfilePhoto
                imageUrl={doctor?.profileImage?.url}
                imagePreview={profileImagePreview}
                firstName={doctor?.firstName || user?.firstName}
                lastName={doctor?.lastName || user?.lastName}
                selectedFile={profileImageFile}
                uploading={imageUploading}
                onSelect={selectProfileImage}
                onSave={saveProfileImage}
              />
              {doctor && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Doctor number" value={doctor.doctorNumber} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="License number" value={doctor.licenseNumber} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Name" value={fullName} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Email" value={doctor.email} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Mobile number" value={doctor.mobileNumber} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Specialization" value={doctor.specialization} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Account status" value={doctor.status} /></Grid>
                  </Grid>
                </>
              )}
            </>
          )}
        </Paper>
        <Snackbar
          open={Boolean(notice)}
          autoHideDuration={5000}
          onClose={() => setNotice(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {notice && <Alert severity={notice.severity} variant="filled">{notice.message}</Alert>}
        </Snackbar>
      </Box>
    )
  }

  return (
    <Box
      component="section"
      className={user?.role === 'admin' ? 'admin-page admin-profile-page' : undefined}
    >
      <Box className={user?.role === 'admin' ? 'admin-page-header' : undefined}>
        <Box>
          <Typography component="h1" variant="h4" sx={user?.role === 'admin' ? undefined : { mb: 3 }}>
            Profile
          </Typography>
          {user?.role === 'admin' && (
            <Typography color="text.secondary">Review your administrator account information.</Typography>
          )}
        </Box>
      </Box>
      <Card className={user?.role === 'admin' ? 'admin-profile-card' : undefined} sx={{ maxWidth: 820 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <ProfilePhoto
            imageUrl={user?.profileImage?.url}
            imagePreview={profileImagePreview}
            firstName={user?.firstName}
            lastName={user?.lastName}
            selectedFile={profileImageFile}
            uploading={imageUploading}
            onSelect={selectProfileImage}
            onSave={saveProfileImage}
          />
          <Divider sx={{ my: 3 }} />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}><Detail label="Name" value={fullName} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Detail label="Email" value={user?.email} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Detail label="Role" value={user?.role} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Detail label="Account status" value={user?.status} /></Grid>
          </Grid>
        </CardContent>
      </Card>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notice && <Alert severity={notice.severity} variant="filled">{notice.message}</Alert>}
      </Snackbar>
    </Box>
  )
}

export default Profile
