export const getProfileInitials = ({
  firstName = '',
  lastName = '',
  name = '',
}) => {
  const resolvedName = name || [firstName, lastName].filter(Boolean).join(' ')
  return `${firstName?.[0] || resolvedName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
}

export const getProfileImageSource = (imageUrl, failedUrl = '') =>
  imageUrl && failedUrl !== imageUrl ? imageUrl : undefined
