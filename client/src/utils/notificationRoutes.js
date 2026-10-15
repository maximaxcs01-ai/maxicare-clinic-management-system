const destinations = {
  patient: {
    patient_appointments: '/patient/appointments',
    patient_medical_history: '/patient/medical-history',
    patient_prescriptions: '/patient/prescriptions',
  },
  doctor: {
    doctor_appointments: '/doctor/appointments',
    doctor_queue: '/doctor/queue',
  },
  receptionist: {
    staff_appointments: '/receptionist/appointments',
    staff_queue: '/receptionist/queue',
  },
  admin: {
    staff_appointments: '/admin/appointments',
    staff_queue: '/admin/queue',
  },
}

export const getNotificationDestination = (notification, role) =>
  destinations[role]?.[notification?.targetType] || null
