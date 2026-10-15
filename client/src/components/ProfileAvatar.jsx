import { Avatar } from '@mui/material'
import { useState } from 'react'
import {
  getProfileImageSource,
  getProfileInitials,
} from '../utils/profileAvatar'

function ProfileAvatar({
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
  const initials = getProfileInitials({ firstName, lastName, name })
  const usableImageUrl = getProfileImageSource(imageUrl, failedUrl)

  return (
    <Avatar
      className={className}
      src={usableImageUrl}
      alt={resolvedName ? `${resolvedName} profile` : 'Profile'}
      slotProps={{
        img: {
          onError: () => setFailedUrl(imageUrl || ''),
          style: { objectFit: 'cover' },
        },
      }}
      sx={{ width: size, height: size, objectFit: 'cover', ...sx }}
    >
      {initials || 'U'}
    </Avatar>
  )
}

export default ProfileAvatar
