import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563a6',
      dark: '#153b67',
    },
    secondary: {
      main: '#2f8f73',
    },
    background: {
      default: '#f7f9fc',
      paper: '#ffffff',
    },
    text: {
      primary: '#102a43',
      secondary: '#52667a',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", Arial, sans-serif',
    h4: {
      fontSize: '1.75rem',
      fontWeight: 750,
      letterSpacing: '-0.025em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 16,
  },
  shadows: [
    'none',
    '0 1px 3px rgba(15, 42, 67, 0.08)',
    ...Array(23).fill('0 4px 12px rgba(15, 42, 67, 0.08)'),
  ],
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '3px solid rgba(37, 99, 166, 0.28)',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 42, 67, 0.08)',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        rounded: {
          borderRadius: 16,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          transition: 'background-color 150ms ease, color 150ms ease',
          '&.Mui-selected': {
            color: '#153b67',
            backgroundColor: '#edf4fb',
          },
          '&.Mui-selected:hover': {
            backgroundColor: '#e4eff9',
          },
        },
      },
    },
  },
})

export default theme
