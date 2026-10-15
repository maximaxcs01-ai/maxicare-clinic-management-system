import ProfileAvatar from './ProfileAvatar'

function DoctorAvatar({
  imageUrl,
  firstName = '',
  lastName = '',
  name = '',
  size = 48,
  className,
  sx,
}) {
  return (
    <ProfileAvatar
      imageUrl={imageUrl}
      firstName={firstName}
      lastName={lastName}
      name={name}
      size={size}
      className={className}
      sx={sx}
    />
  )
}

export default DoctorAvatar
