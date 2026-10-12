const roleDestinations = {
  patient: '/patient',
  receptionist: '/receptionist',
  doctor: '/doctor',
  admin: '/admin',
}

export function getRoleDestination(role) {
  return roleDestinations[role] || '/dashboard'
}
