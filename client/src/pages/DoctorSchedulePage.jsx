import { Alert, Box, CircularProgress, Snackbar, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ScheduleEditor from '../components/schedule/ScheduleEditor'
import useAuth from '../hooks/useAuth'
import { getDoctorSchedule, getMyDoctor, saveDoctorSchedule } from '../services/scheduleApi'

function DoctorSchedulePage({ readOnly = false }) {
  const { id } = useParams()
  const { user } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const editable = !readOnly && ['admin', 'doctor'].includes(user.role)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const doctorResponse = user.role === 'doctor' ? await getMyDoctor() : null
        const doctorId = user.role === 'doctor' ? doctorResponse.data.data._id : id
        const response = await getDoctorSchedule(doctorId)
        if (active) { setDoctor(response.data.doctor); setSchedule(response.data.schedule) }
      } catch (requestError) { if (active) setError(requestError.response?.data?.message || 'Unable to load schedule.') }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [id, user.role])

  const save = async () => {
    try {
      setSaving(true); setError('')
      const response = await saveDoctorSchedule(doctor.id, {
        weeklySchedule: schedule.weeklySchedule,
        dateOverrides: schedule.dateOverrides,
        status: schedule.status,
      })
      setSchedule(response.data.schedule); setSuccess(response.data.message)
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save schedule.') }
    finally { setSaving(false) }
  }

  if (loading) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
  if (!schedule || !doctor) return <Alert severity="error">{error || 'Schedule unavailable.'}</Alert>

  return <Box component="section"><Typography variant="h4">Doctor Schedule</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{doctor.firstName} {doctor.middleName} {doctor.lastName} · {doctor.doctorNumber}</Typography><ScheduleEditor schedule={schedule} editable={editable} saving={saving} error={error} onChange={setSchedule} onSave={save} /><Snackbar open={Boolean(success)} autoHideDuration={5000} onClose={() => setSuccess('')}><Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert></Snackbar></Box>
}

export default DoctorSchedulePage
