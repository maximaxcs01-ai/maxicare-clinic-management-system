import { Box, Card, CardContent, Grid, Typography } from '@mui/material'
import useAuth from '../hooks/useAuth'

const dashboardContent = {
  patient: {
    title: 'Your care, in one place',
    subtitle: 'Review your clinic information and upcoming care activities.',
    cards: ['Next Appointment', 'Medical History', 'Prescriptions'],
  },
  receptionist: {
    title: 'Clinic overview',
    subtitle: 'Use the navigation to support patients and daily clinic operations.',
    cards: ["Today's Appointments", 'Waiting Patients', 'Patient Records'],
  },
  doctor: {
    title: 'Clinical workspace',
    subtitle: 'Review your schedule and patient care modules from one place.',
    cards: ['Upcoming Schedule', 'Assigned Patients', 'Consultations'],
  },
  admin: {
    title: 'Administration overview',
    subtitle: 'Manage clinic records and access administrative modules.',
    cards: ['Patient Records', 'Clinic Users', 'Services'],
  },
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function RoleDashboard() {
  const { user } = useAuth()
  const content = dashboardContent[user?.role] || dashboardContent.patient

  return (
    <Box component="section">
      <Typography component="h1" variant="h4">
        {getGreeting()}, {user?.firstName || 'there'}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
        {content.subtitle}
      </Typography>

      <Typography variant="h6" sx={{ mb: 2 }}>
        {content.title}
      </Typography>
      <Grid container spacing={2.5}>
        {content.cards.map((label) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No data available yet.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default RoleDashboard
