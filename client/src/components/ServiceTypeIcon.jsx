import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined'
import HealingOutlinedIcon from '@mui/icons-material/HealingOutlined'
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined'
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined'
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined'

const serviceIcons = [
  {
    keywords: ['cardiothoracic'],
    Icon: HealthAndSafetyOutlinedIcon,
  },
  { keywords: ['cardiology', 'cardiac', 'heart'], Icon: MonitorHeartOutlinedIcon },
  { keywords: ['diagnostic', 'laboratory', 'imaging', 'test'], Icon: BiotechOutlinedIcon },
  { keywords: ['general surgery', 'surgical'], Icon: HealingOutlinedIcon },
  { keywords: ['internal medicine', 'internal'], Icon: MedicationOutlinedIcon },
  { keywords: ['general consultation', 'general'], Icon: MedicalServicesOutlinedIcon },
]

function ServiceTypeIcon({ serviceName, ...iconProps }) {
  const normalizedName = String(serviceName || '').toLowerCase()
  const match = serviceIcons.find(({ keywords }) =>
    keywords.some((keyword) => normalizedName.includes(keyword)),
  )
  const Icon = match?.Icon || LocalHospitalOutlinedIcon

  return <Icon {...iconProps} />
}

export default ServiceTypeIcon
