import { Chip } from '@mui/material'

function StatusChip({ status }) {
  const active = status === 'active'
  return (
    <Chip
      label={String(status || 'unknown').replaceAll('_', ' ')}
      size="small"
      color={active ? 'success' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      sx={{ textTransform: 'capitalize', fontWeight: 600 }}
    />
  )
}

export default StatusChip
