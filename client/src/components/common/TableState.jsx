import { Box, Skeleton, TableCell, TableRow, Typography } from '@mui/material'

function TableState({ loading, empty, colSpan, emptyMessage = 'No records found.' }) {
  if (loading) {
    return Array.from({ length: 5 }, (_, index) => (
      <TableRow key={index}>
        <TableCell colSpan={colSpan}><Skeleton height={34} /></TableCell>
      </TableRow>
    ))
  }

  if (empty) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan}>
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography color="text.secondary">{emptyMessage}</Typography>
          </Box>
        </TableCell>
      </TableRow>
    )
  }

  return null
}

export default TableState
