import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import DoctorAvatar from '../components/DoctorAvatar'
import useAuth from '../hooks/useAuth'
import {
  getMyDoctor,
  updateMyProfileImage,
} from '../services/doctorApi'
import { getOwnPatient } from '../services/patientApi'

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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

function Profile() {
  const { user, updateUser } = useAuth()
  const [patient, setPatient] = useState(null)
  const [patientLoading, setPatientLoading] = useState(user?.role === 'patient')
  const [patientError, setPatientError] = useState('')
  const [profileTab, setProfileTab] = useState('personal')
  const [doctor, setDoctor] = useState(null)
  const [doctorLoading, setDoctorLoading] = useState(user?.role === 'doctor')
  const [doctorError, setDoctorError] = useState('')
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [doctorNotice, setDoctorNotice] = useState(null)
  const fullName = [user?.firstName, user?.middleName, user?.lastName]
    .filter(Boolean)
    .join(' ')
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`

  useEffect(() => {
    if (user?.role !== 'patient') return undefined
    let active = true
    getOwnPatient()
      .then((response) => { if (active) setPatient(response.data.data) })
      .catch((error) => { if (active) setPatientError(error.response?.data?.message || 'Unable to load patient profile.') })
      .finally(() => { if (active) setPatientLoading(false) })
    return () => { active = false }
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'doctor') return undefined
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
  }, [user?.role])

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
    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      setDoctorNotice({
        severity: 'error',
        message: 'Select a JPEG, PNG, or WebP image.',
      })
      return
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setDoctorNotice({
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
      const response = await updateMyProfileImage(profileImageFile)
      setDoctor(response.data.data)
      updateUser({ profileImage: response.data.data.profileImage })
      setDoctorError('')
      setProfileImageFile(null)
      setProfileImagePreview('')
      setDoctorNotice({
        severity: 'success',
        message: response.data.message || 'Profile photo updated successfully.',
      })
    } catch (error) {
      setDoctorNotice({
        severity: 'error',
        message:
          error.response?.data?.message || 'Unable to update profile photo.',
      })
    } finally {
      setImageUploading(false)
    }
  }

  if (user?.role === 'patient') {
    const address = patient?.address
      ? typeof patient.address === 'string'
        ? patient.address
        : Object.values(patient.address).filter(Boolean).join(', ')
      : ''

    return (
      <Box component="section" className="patient-page patient-profile-page">
        <Typography component="h1" variant="h4" sx={{ mb: 3 }}>My Profile</Typography>
        <Paper className="patient-profile-card">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
          >
            <Avatar className="patient-profile-avatar">{initials.toUpperCase()}</Avatar>
            <Box>
              <Typography variant="h5" fontWeight={700}>{fullName || 'Patient'}</Typography>
              <Typography color="text.secondary">
                Patient number: {patient?.patientNumber || 'Loading...'}
              </Typography>
            </Box>
          </Stack>

          {patientLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>}
          {patientError && <Alert severity="warning" sx={{ mt: 3 }}>{patientError}</Alert>}
          {!patientLoading && patient && (
            <>
              <Tabs
                value={profileTab}
                onChange={(_, value) => setProfileTab(value)}
                sx={{ mt: 3, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab value="personal" label="Personal" />
                <Tab value="contact" label="Contact" />
              </Tabs>
              <Grid container spacing={3} sx={{ pt: 3 }}>
                {profileTab === 'personal' ? (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Full name" value={fullName} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Patient number" value={patient.patientNumber} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Date of birth" value={patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('en-PH') : ''} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Sex" value={patient.sex || patient.gender} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Portal status" value={patient.portalStatus} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Account status" value={user?.status} /></Grid>
                  </>
                ) : (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Email" value={user?.email} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Mobile number" value={patient.mobileNumber || patient.contactNumber} /></Grid>
                    <Grid size={{ xs: 12 }}><Detail label="Address" value={address} /></Grid>
                  </>
                )}
              </Grid>
            </>
          )}
        </Paper>
      </Box>
    )
  }

  if (user?.role === 'doctor') {
    const doctorName = [
      doctor?.firstName || user?.firstName,
      doctor?.middleName || user?.middleName,
      doctor?.lastName || user?.lastName,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <Box component="section" className="doctor-page doctor-profile-page">
        <Box className="doctor-page-header">
          <Typography component="h1" variant="h4">My Profile</Typography>
          <Typography color="text.secondary">Manage your professional profile and photo.</Typography>
        </Box>
        <Paper className="doctor-profile-card" sx={{ maxWidth: 900, p: { xs: 2.5, sm: 4 }, border: 1, borderColor: 'divider' }}>
          {doctorLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {doctorError && <Alert severity="error" sx={{ mb: 3 }}>{doctorError}</Alert>}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
              >
                <DoctorAvatar
                  className="doctor-avatar"
                  imageUrl={profileImagePreview || doctor?.profileImage?.url}
                  firstName={doctor?.firstName || user?.firstName}
                  lastName={doctor?.lastName || user?.lastName}
                  size={132}
                  sx={{ borderRadius: 3, bgcolor: 'primary.main', fontSize: '1.8rem', fontWeight: 700 }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {doctorName || 'Doctor'}
                  </Typography>
                  <Typography color="text.secondary">
                    {doctor?.specialization || 'Doctor profile'}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2 }}>
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<PhotoCameraOutlinedIcon />}
                      disabled={imageUploading}
                    >
                      {doctor?.profileImage?.url ? 'Change Photo' : 'Upload Photo'}
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={selectProfileImage}
                      />
                    </Button>
                    {profileImageFile && (
                      <Button
                        variant="contained"
                        onClick={saveProfileImage}
                        disabled={imageUploading}
                      >
                        {imageUploading ? 'Saving...' : 'Save Photo'}
                      </Button>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    JPEG, PNG, or WebP. Maximum size 5 MB.
                  </Typography>
                  {profileImageFile && (
                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                      Selected: {profileImageFile.name}
                    </Typography>
                  )}
                </Box>
              </Stack>

              {doctor && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="Doctor number" value={doctor.doctorNumber} /></Grid>
                    <Grid size={{ xs: 12, sm: 6 }}><Detail label="License number" value={doctor.licenseNumber} /></Grid>
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
          open={Boolean(doctorNotice)}
          autoHideDuration={5000}
          onClose={() => setDoctorNotice(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {doctorNotice && (
            <Alert
              severity={doctorNotice.severity}
              variant="filled"
              onClose={() => setDoctorNotice(null)}
            >
              {doctorNotice.message}
            </Alert>
          )}
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
      <Card className={user?.role === 'admin' ? 'admin-profile-card' : undefined} sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
              {initials.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">{fullName || 'Clinic user'}</Typography>
              <Typography color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {user?.role}
              </Typography>
            </Box>
          </Stack>
          <Divider sx={{ my: 3 }} />
          <Stack spacing={2.5}>
            <Detail label="Email" value={user?.email} />
            <Detail label="Role" value={user?.role} />
            <Detail label="Account status" value={user?.status} />
            {patientLoading && <CircularProgress size={24} />}
            {patientError && <Alert severity="warning">{patientError}</Alert>}
            {patient && (
              <>
                <Divider />
                <Detail label="Patient number" value={patient.patientNumber} />
                <Detail label="Date of birth" value={patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : ''} />
                <Detail label="Sex" value={patient.sex || patient.gender} />
                <Detail label="Mobile number" value={patient.mobileNumber || patient.contactNumber} />
                <Detail label="Portal status" value={patient.portalStatus} />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Profile
