import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { CURRENT_TERMS_VERSION } from '../config/legal'

function PolicySection({ title, children }) {
  return (
    <Box component="section" sx={{ scrollMarginTop: 16 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1.25} color="text.secondary">
        {children}
      </Stack>
    </Box>
  )
}

function TermsPrivacyDialog({ open, onClose, onAccept, reviewOnly = false }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="terms-privacy-title"
      PaperProps={{ sx: { maxHeight: 'min(760px, 92vh)' } }}
    >
      <DialogTitle id="terms-privacy-title" sx={{ pr: 7 }}>
        Terms of Service &amp; Privacy Policy
        <Typography component="p" variant="caption" color="text.secondary">
          Version {CURRENT_TERMS_VERSION}
        </Typography>
        <IconButton
          aria-label="Close terms and privacy notice"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseOutlinedIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent dividers sx={{ px: { xs: 2.25, sm: 3.5 } }}>
        <Stack spacing={3}>
          <PolicySection title="Terms of Service">
            <Typography>
              Use this Clinic Management System to access the clinic services made
              available to your account, including appointment and patient-record
              features. Provide accurate information and keep your sign-in details
              private.
            </Typography>
            <Typography>
              Do not misuse the system, attempt to access another person&apos;s
              information, disrupt its operation, or submit false or harmful content.
              Appointment requests remain subject to clinic availability and workflow.
            </Typography>
            <Typography>
              The portal supports clinic operations but does not replace direct medical
              advice or emergency care. Features may be changed or temporarily
              unavailable for maintenance or operational reasons.
            </Typography>
          </PolicySection>

          <Divider />

          <PolicySection title="Privacy Policy">
            <Typography>
              The system processes the information you provide and the records created
              while the clinic serves you. This can include identity and contact
              details, account information, profile images, appointments, queue and
              triage details, consultation information, and prescriptions.
            </Typography>
            <Typography>
              Information is used to create and secure accounts, verify email, schedule
              and manage visits, support consultations and prescriptions, maintain
              patient history, send service messages, and operate and audit the system.
            </Typography>
            <Typography>
              Information is available only through system access appropriate to the
              user&apos;s clinic role and care relationship. Technical service providers
              may process information needed for database hosting, image storage, and
              email delivery. Records are retained according to clinic operational and
              record-keeping needs.
            </Typography>
            <Typography>
              Use the clinic&apos;s available contact channels if you need help with your
              account or want to ask about information held in the system.
            </Typography>
          </PolicySection>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.25, sm: 3.5 }, py: 2 }}>
        <Button onClick={onClose}>{reviewOnly ? 'Close' : 'Cancel'}</Button>
        {!reviewOnly && (
          <Button variant="contained" onClick={onAccept}>
            Accept &amp; Continue
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default TermsPrivacyDialog
