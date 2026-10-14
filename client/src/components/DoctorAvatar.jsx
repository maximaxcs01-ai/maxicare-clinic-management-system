import { Avatar } from '@mui/material'
import { useState } from 'react'

function DoctorAvatar({
  imageUrl,
  firstName = '',
  lastName = '',
  name = '',
  size = 48,
  className,
  sx,
}) {
  const [failedUrl, setFailedUrl] = useState('')
  const resolvedName = name || [firstName, lastName].filter(Boolean).join(' ')
  const initials =
    `${firstName?.[0] || resolvedName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  const usableImageUrl = imageUrl && failedUrl !== imageUrl ? imageUrl : undefined

  return (
    <Avatar
      className={className}
      src={usableImageUrl}
      alt={resolvedName ? `${resolvedName} profile` : 'Doctor profile'}
      slotProps={{
        img: {
          onError: () => setFailedUrl(imageUrl || ''),
          style: { objectFit: 'cover' },
        },
      }}
      sx={{ width: size, height: size, objectFit: 'cover', ...sx }}
    >
      {initials || 'DR'}
    </Avatar>
  )
}

export default DoctorAvatar
