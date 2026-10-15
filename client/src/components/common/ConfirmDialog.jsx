import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton } from '@mui/material'

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  severity,
  error,
  loading,
  confirmDisabled = false,
  children,
  maxWidth = 'xs',
  onCancel,
  onConfirm,
}) {
  const destructive =
    severity === 'error' ||
    (!severity && /delete|remove|archive|deactivate/i.test(`${title} ${confirmLabel}`))
  const warning = severity === 'warning'
  const color = destructive ? 'error' : warning ? 'warning' : 'primary'

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth={maxWidth}
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
            color: `${color}.main`,
            bgcolor: destructive
              ? '#fff1f0'
              : warning
                ? '#fff8e1'
                : '#edf4fb',
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
      <DialogContent sx={{ pl: children ? 3 : 8.5 }}>
        <DialogContentText sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
          {message}
        </DialogContentText>
        {children}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
      <Button variant="outlined" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
      <Button
        color={color}
          variant="contained"
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
          sx={{ borderRadius: '10px', minWidth: 96 }}
        >
          {loading ? 'Please wait...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
