import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import QueueOutlinedIcon from '@mui/icons-material/QueueOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'

export const roleNavigation = {
  patient: [
    { label: 'Dashboard', path: '/patient', icon: HomeOutlinedIcon },
    {
      label: 'Appointments',
      path: '/patient/appointments',
      icon: CalendarMonthOutlinedIcon,
    },
    {
      label: 'Medical History',
      path: '/patient/medical-history',
      icon: HistoryEduOutlinedIcon,
    },
    {
      label: 'Prescriptions',
      path: '/patient/prescriptions',
      icon: ReceiptLongOutlinedIcon,
    },
    {
      label: 'My Profile',
      path: '/patient/profile',
      icon: PersonOutlineOutlinedIcon,
    },
  ],
  receptionist: [
    {
      label: 'Dashboard',
      path: '/receptionist',
      icon: DashboardOutlinedIcon,
    },
    {
      label: 'Appointments',
      path: '/receptionist/appointments',
      icon: CalendarMonthOutlinedIcon,
    },
    {
      label: 'Walk-Ins',
      path: '/receptionist/walk-ins',
      icon: PersonAddAltOutlinedIcon,
    },
    { label: 'Queue', path: '/receptionist/queue', icon: QueueOutlinedIcon },
    {
      label: 'Patients',
      path: '/receptionist/patients',
      icon: PeopleOutlinedIcon,
    },
    {
      label: 'Doctors',
      path: '/receptionist/doctors',
      icon: LocalHospitalOutlinedIcon,
    },
  ],
  doctor: [
    { label: 'Overview', path: '/doctor', icon: DashboardOutlinedIcon },
    {
      label: 'My Schedule',
      path: '/doctor/schedule',
      icon: EventNoteOutlinedIcon,
    },
    {
      label: 'Appointments',
      path: '/doctor/appointments',
      icon: CalendarMonthOutlinedIcon,
    },
    { label: 'My Queue', path: '/doctor/queue', icon: QueueOutlinedIcon },
    {
      label: 'Patients',
      path: '/doctor/patients',
      icon: PeopleOutlinedIcon,
    },
    {
      label: 'Consultations',
      path: '/doctor/consultations',
      icon: MedicalServicesOutlinedIcon,
    },
    {
      label: 'Prescriptions',
      path: '/doctor/prescriptions',
      icon: ReceiptLongOutlinedIcon,
    },
    {
      label: 'Profile',
      path: '/doctor/profile',
      icon: PersonOutlineOutlinedIcon,
    },
  ],
  admin: [
    { label: 'Overview', path: '/admin', icon: DashboardOutlinedIcon },
    {
      label: 'Patients',
      path: '/admin/patients',
      icon: PeopleOutlinedIcon,
    },
    {
      label: 'Doctors',
      path: '/admin/doctors',
      icon: LocalHospitalOutlinedIcon,
    },
    {
      label: 'Appointments',
      path: '/admin/appointments',
      icon: CalendarMonthOutlinedIcon,
    },
    { label: 'Services', path: '/admin/services', icon: ScienceOutlinedIcon },
    { label: 'Users', path: '/admin/users', icon: GroupsOutlinedIcon },
    { label: 'Reports', path: '/admin/reports', icon: ReceiptLongOutlinedIcon },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: FactCheckOutlinedIcon },
    {
      label: 'Profile',
      path: '/admin/profile',
      icon: PersonOutlineOutlinedIcon,
    },
  ],
}

export function getNavigationForRole(role) {
  return roleNavigation[role] || []
}
