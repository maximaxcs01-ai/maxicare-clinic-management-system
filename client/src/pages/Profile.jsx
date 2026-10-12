import { Alert, Avatar, Box, Card, CardContent, CircularProgress, Divider, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import useAuth from '../hooks/useAuth'
import { getOwnPatient } from '../services/patientApi'

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
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [patientLoading, setPatientLoading] = useState(user?.role === 'patient')
  const [patientError, setPatientError] = useState('')
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

  return (
    <Box component="section">
      <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
        Profile
      </Typography>
      <Card sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack direction="row" spacing={2} alignItems="center">
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
