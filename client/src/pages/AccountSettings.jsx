import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import TermsPrivacyDialog from '../components/TermsPrivacyDialog'
import useAuth from '../hooks/useAuth'
import {
  changeAccountPassword,
  getAccountSettings,
  signOutAllDevices,
  updateInAppNotificationPreference,
} from '../services/accountSettingsApi'
import { CURRENT_TERMS_VERSION } from '../config/legal'

const initialPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const formatDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function SettingsSection({ title, description, children }) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{
        p: { xs: 2.25, sm: 3 },
        borderColor: 'divider',
        borderRadius: 3,
        boxShadow: '0 3px 14px rgba(17, 52, 78, 0.045)',
      }}
    >
      <Typography component="h2" variant="h6" fontWeight={700}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
      <Box sx={{ mt: 2.5 }}>{children}</Box>
    </Paper>
  )
}

function PasswordField({
  name,
  label,
  value,
  visible,
  disabled,
  onChange,
  onToggle,
  autoComplete,
}) {
  return (
    <TextField
      name={name}
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required
      fullWidth
      disabled={disabled}
      inputProps={name === 'newPassword' || name === 'confirmPassword'
        ? { minLength: 8, maxLength: 16 }
        : { maxLength: 128 }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              edge="end"
              aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              onClick={onToggle}
              disabled={disabled}
            >
              {visible
                ? <VisibilityOffOutlinedIcon />
                : <VisibilityOutlinedIcon />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}

function AccountSettings() {
  const { user, updateSession, logout } = useAuth()
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm)
  const [visibleFields, setVisibleFields] = useState({})
  const [logoutAllOpen, setLogoutAllOpen] = useState(false)
  const [logoutAllLoading, setLogoutAllLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const passwordRequestRef = useRef(false)
  const logoutAllRequestRef = useRef(false)

  useEffect(() => {
    let active = true
    getAccountSettings()
      .then((response) => {
        if (active) setSettings(response.data.data)
      })
      .catch((requestError) => {
        if (active) {
          setLoadError(
            requestError.response?.data?.message ||
              'Unable to load account settings.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const updatePasswordField = (field) => (event) => {
    setPasswordForm((current) => ({ ...current, [field]: event.target.value }))
    setPasswordError('')
  }

  const togglePasswordField = (field) => () => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }))
  }

  const retryLoadSettings = () => {
    setLoading(true)
    setLoadError('')
    getAccountSettings()
      .then((response) => setSettings(response.data.data))
      .catch((requestError) => {
        setLoadError(
          requestError.response?.data?.message ||
            'Unable to load account settings.',
        )
      })
      .finally(() => setLoading(false))
  }

  const closePasswordDialog = () => {
    if (passwordSaving) return
    setPasswordDialogOpen(false)
    setPasswordError('')
    setPasswordForm(initialPasswordForm)
    setVisibleFields({})
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    if (passwordRequestRef.current || passwordSaving) return

    if (
      passwordForm.newPassword.length < 8 ||
      passwordForm.newPassword.length > 16
    ) {
      setPasswordError('Password must be 8 to 16 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    passwordRequestRef.current = true
    setPasswordSaving(true)
    setPasswordError('')
    try {
      const response = await changeAccountPassword(passwordForm)
      updateSession(response.data.token, response.data.user)
      setPasswordDialogOpen(false)
      setPasswordForm(initialPasswordForm)
      setVisibleFields({})
      setNotice({
        severity: 'success',
        message: 'Password changed successfully.',
      })
    } catch (requestError) {
      setPasswordError(
        requestError.response?.data?.message ||
          'Unable to change your password. Please try again.',
      )
    } finally {
      passwordRequestRef.current = false
      setPasswordSaving(false)
    }
  }

  const handleNotificationChange = async (event) => {
    const inApp = event.target.checked
    if (notificationSaving) return
    setNotificationSaving(true)
    try {
      const response = await updateInAppNotificationPreference(inApp)
      setSettings((current) => ({
        ...current,
        notificationPreferences: response.data.data,
      }))
    } catch (requestError) {
      setNotice({
        severity: 'error',
        message:
          requestError.response?.data?.message ||
          'Unable to update notification preferences.',
      })
    } finally {
      setNotificationSaving(false)
    }
  }

  const handleLogoutAll = async () => {
    if (logoutAllRequestRef.current || logoutAllLoading) return
    logoutAllRequestRef.current = true
    setLogoutAllLoading(true)
    try {
      await signOutAllDevices()
      logout()
      navigate('/login', {
        replace: true,
        state: { message: 'You have been signed out of all devices.' },
      })
    } catch (requestError) {
      setNotice({
        severity: 'error',
        message:
          requestError.response?.data?.message ||
          'Unable to sign out all devices. Please try again.',
      })
      setLogoutAllOpen(false)
    } finally {
      logoutAllRequestRef.current = false
      setLogoutAllLoading(false)
    }
  }

  const roleLabel = (settings?.role || user?.role || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  const acceptedDate =
    settings?.termsAcceptedAt || settings?.privacyAcceptedAt || null
  const hasConsentRecord = Boolean(
    settings?.termsVersion || settings?.termsAcceptedAt || settings?.privacyAcceptedAt,
  )

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      component="section"
      sx={{ width: '100%', maxWidth: 960, minWidth: 0, mx: 'auto' }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography component="h1" variant="h4" fontWeight={750}>
          Account Settings
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Manage your account security, notifications, and privacy information.
        </Typography>
      </Box>

      {loadError && (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={retryLoadSettings}>Retry</Button>}
          sx={{ mb: 2 }}
        >
          {loadError}
        </Alert>
      )}

      {settings && (
        <Stack spacing={2}>
          <SettingsSection title="Account Information">
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 2.5,
              }}
            >
              {[
                ['Email', settings.email],
                ['Role', roleLabel],
                ['Status', settings.status
                  ? settings.status[0].toUpperCase() + settings.status.slice(1)
                  : 'Unavailable'],
              ].map(([label, value]) => (
                <Box key={label} sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography fontWeight={650} sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
                    {value || 'Unavailable'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SettingsSection>

          <SettingsSection
            title="Security"
            description="Change the password used to sign in to your account."
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">Password</Typography>
                <Typography fontWeight={700} aria-label="Password hidden">••••••••</Typography>
              </Box>
              <Button variant="outlined" onClick={() => setPasswordDialogOpen(true)}>
                Change Password
              </Button>
            </Stack>
          </SettingsSection>

          <SettingsSection
            title="Notifications"
            description="Choose whether this account receives new in-app notifications."
          >
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notificationPreferences?.inApp !== false}
                  onChange={handleNotificationChange}
                  disabled={notificationSaving}
                  inputProps={{ 'aria-label': 'In-app Notifications' }}
                />
              }
              label={notificationSaving ? 'Saving preference…' : 'In-app Notifications'}
            />
          </SettingsSection>

          <SettingsSection
            title="Privacy & Legal"
            description="Review the Terms of Service and Privacy Policy."
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ mb: 2.5 }}
            >
              <Button variant="outlined" onClick={() => setPolicyOpen(true)}>
                Terms of Service — View
              </Button>
              <Button variant="outlined" onClick={() => setPolicyOpen(true)}>
                Privacy Policy — View
              </Button>
            </Stack>
            {hasConsentRecord ? (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Policy version accepted:</strong>{' '}
                  {settings.termsVersion || CURRENT_TERMS_VERSION}
                </Typography>
                <Typography variant="body2">
                  <strong>Accepted:</strong> {formatDate(acceptedDate)}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Legacy account — no stored consent record.
              </Typography>
            )}
          </SettingsSection>

          <SettingsSection
            title="Session Security"
            description="Sign out your account from all currently logged-in devices."
          >
            <Button
              color="error"
              variant="outlined"
              onClick={() => setLogoutAllOpen(true)}
            >
              Sign Out All Devices
            </Button>
          </SettingsSection>
        </Stack>
      )}

      <Dialog
        open={passwordDialogOpen}
        onClose={closePasswordDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby="change-password-title"
      >
        <Box component="form" onSubmit={handlePasswordChange}>
          <DialogTitle id="change-password-title">Change Password</DialogTitle>
          <DialogContent>
            <Stack spacing={2.25} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Use 8 to 16 characters. Your other active sessions will be signed out.
              </Typography>
              {passwordError && <Alert severity="error">{passwordError}</Alert>}
              <PasswordField
                name="currentPassword"
                label="Current Password"
                value={passwordForm.currentPassword}
                visible={Boolean(visibleFields.currentPassword)}
                disabled={passwordSaving}
                onChange={updatePasswordField('currentPassword')}
                onToggle={togglePasswordField('currentPassword')}
                autoComplete="current-password"
              />
              <PasswordField
                name="newPassword"
                label="New Password"
                value={passwordForm.newPassword}
                visible={Boolean(visibleFields.newPassword)}
                disabled={passwordSaving}
                onChange={updatePasswordField('newPassword')}
                onToggle={togglePasswordField('newPassword')}
                autoComplete="new-password"
              />
              <PasswordField
                name="confirmPassword"
                label="Confirm New Password"
                value={passwordForm.confirmPassword}
                visible={Boolean(visibleFields.confirmPassword)}
                disabled={passwordSaving}
                onChange={updatePasswordField('confirmPassword')}
                onToggle={togglePasswordField('confirmPassword')}
                autoComplete="new-password"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={closePasswordDialog} disabled={passwordSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                passwordSaving ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
            >
              {passwordSaving ? 'Changing…' : 'Change Password'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={logoutAllOpen}
        title="Sign Out All Devices?"
        message="This will end all active sessions for your account, including this device. You will need to sign in again."
        confirmLabel="Sign Out All Devices"
        severity="warning"
        loading={logoutAllLoading}
        onCancel={() => setLogoutAllOpen(false)}
        onConfirm={handleLogoutAll}
      />

      <TermsPrivacyDialog
        open={policyOpen}
        reviewOnly
        onClose={() => setPolicyOpen(false)}
      />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setNotice(null)}
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

export default AccountSettings
