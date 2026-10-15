import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { getAuditLogs } from '../../services/auditApi'

const manilaDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const formatManilaDate = (value) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

function AuditLogs() {
  const [filters, setFilters] = useState({
    from: manilaDate(),
    to: manilaDate(),
    actorRole: '',
    action: '',
    entityType: '',
    search: '',
  })
  const [result, setResult] = useState({ data: [], pagination: { totalPages: 1 } })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      getAuditLogs({ ...filters, page, limit: 20 })
        .then(({ data }) => {
          if (active) setResult(data)
        })
        .catch((requestError) => {
          if (active) {
            setError(requestError.response?.data?.message || 'Unable to load audit logs.')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filters, page])

  const updateFilter = (key, value) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <Box component="section" className="admin-page admin-audit-page" sx={{ width: '100%', minWidth: 0 }}>
      <Box className="admin-page-header">
        <Box>
        <Typography variant="h4">Audit Logs</Typography>
        <Typography color="text.secondary">
          Review sensitive system activity (Asia/Manila).
        </Typography>
        </Box>
      </Box>
      <Paper className="admin-filter-panel">
        <Stack direction={{ xs: 'column', md: 'row' }} flexWrap="wrap" spacing={2}>
          <TextField
            label="Date from"
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: filters.to }}
          />
          <TextField
            label="Date to"
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: filters.from }}
          />
          <TextField
            select
            label="Actor role"
            value={filters.actorRole}
            onChange={(event) => updateFilter('actorRole', event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All roles</MenuItem>
            {['admin', 'doctor', 'receptionist', 'patient', 'system'].map((role) => (
              <MenuItem key={role} value={role}>{role}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Action"
            value={filters.action}
            onChange={(event) => updateFilter('action', event.target.value)}
          />
          <TextField
            label="Entity type"
            value={filters.entityType}
            onChange={(event) => updateFilter('entityType', event.target.value)}
          />
          <TextField
            label="Search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
          <Button
            variant="outlined"
            onClick={() => {
              setPage(1)
              setFilters({
                from: manilaDate(),
                to: manilaDate(),
                actorRole: '',
                action: '',
                entityType: '',
                search: '',
              })
            }}
          >
            Today
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper className="admin-management-panel">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Date/Time', 'Actor', 'Role', 'Action', 'Entity', 'Description', 'Details'].map((label) => (
                      <TableCell key={label}>{label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.data.length ? result.data.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatManilaDate(entry.createdAt)}</TableCell>
                      <TableCell>
                        {entry.actorUserId
                          ? `${entry.actorUserId.firstName || ''} ${entry.actorUserId.lastName || ''}`.trim() || entry.actorUserId.email
                          : 'Unavailable'}
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{entry.actorRole}</TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell>{entry.entityType} · {String(entry.entityId).slice(-6)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => setSelected(entry)}>View</Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center">No audit entries for this filter.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
            <Stack
              className="admin-pagination"
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
            >
              <Typography variant="body2" color="text.secondary">
                {result.pagination.total || 0} audit entr{result.pagination.total === 1 ? 'y' : 'ies'}
              </Typography>
              <Pagination
                count={result.pagination.totalPages || 1}
                page={page}
                onChange={(_, nextPage) => setPage(nextPage)}
                color="primary"
              />
            </Stack>
          </>
        )}
      </Paper>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Audit entry details</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={1} sx={{ py: 1 }}>
              <Typography><strong>Description:</strong> {selected.description}</Typography>
              <Typography><strong>Entity ID:</strong> {selected.entityId}</Typography>
              {selected.patientId && <Typography><strong>Patient ID:</strong> {selected.patientId}</Typography>}
              <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(selected.metadata || {}, null, 2)}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AuditLogs
