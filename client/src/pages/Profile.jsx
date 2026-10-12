import { Avatar, Box, Card, CardContent, Divider, Stack, Typography } from '@mui/material'
import useAuth from '../hooks/useAuth'

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
  const fullName = [user?.firstName, user?.middleName, user?.lastName]
    .filter(Boolean)
    .join(' ')
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`

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
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Profile
