import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import { Box, Paper, Typography } from '@mui/material'

function ModulePlaceholder({ title, description }) {
  return (
    <Box component="section">
      <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
        {title}
      </Typography>
      <Paper
        sx={{
          maxWidth: 720,
          p: { xs: 3, sm: 4 },
          border: 1,
          borderColor: 'divider',
        }}
      >
        <AccessTimeOutlinedIcon color="primary" sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography color="text.secondary">
          {description || `${title} will be available in a later development phase.`}
        </Typography>
      </Paper>
    </Box>
  )
}

export default ModulePlaceholder
