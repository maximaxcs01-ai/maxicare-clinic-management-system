import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton } from '@mui/material'

function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', loading, onCancel, onConfirm }) {
  const destructive = /delete|remove|archive|deactivate/i.test(`${title} ${confirmLabel}`)

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '14px', p: 0.5 } }}
    >
      <DialogTitle sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5, pt: 3, pr: 7 }}>
        <Box
          component="span"
          sx={{
            width: 40,
            height: 40,
            display: 'grid',
            flex: '0 0 auto',
            placeItems: 'center',
            borderRadius: '50%',
            color: destructive ? 'error.main' : 'primary.main',
            bgcolor: destructive ? '#fff1f0' : '#edf4fb',
          }}
        >
          <ReportProblemOutlinedIcon />
        </Box>
        {title}
        <IconButton
          aria-label="Close dialog"
          onClick={onCancel}
          disabled={loading}
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <CloseOutlinedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pl: 8.5 }}>
        <DialogContentText sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button variant="outlined" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button
          color={destructive ? 'error' : 'primary'}
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          sx={{ borderRadius: '10px', minWidth: 96 }}
        >
          {loading ? 'Please wait...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
