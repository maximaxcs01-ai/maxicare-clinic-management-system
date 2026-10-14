import { Chip } from '@mui/material'

function StatusChip({ status }) {
  const norm = String(status || 'unknown').toLowerCase()

  let color = 'default'
  let variant = 'outlined'

  if (norm === 'active' || norm === 'confirmed') {
    color = 'success'
    variant = 'filled'
  } else if (norm === 'pending') {
    color = 'warning'
    variant = 'filled'
  } else if (norm === 'cancelled' || norm === 'rejected') {
    color = 'error'
    variant = 'outlined'
  } else if (norm === 'completed') {
    color = 'info'
    variant = 'filled'
  }

  return (
    <Chip
      label={norm.replaceAll('_', ' ')}
      size="small"
      color={color}
      variant={variant}
      sx={{ textTransform: 'capitalize', fontWeight: 600 }}
    />
  )
}

export default StatusChip
