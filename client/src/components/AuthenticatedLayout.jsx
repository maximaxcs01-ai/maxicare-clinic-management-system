import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useState } from 'react'
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { getNavigationForRole } from '../config/roleNavigation'
import useAuth from '../hooks/useAuth'
import { getRoleDestination } from '../utils/authRoutes'

const drawerWidth = 272

function AuthenticatedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountAnchor, setAccountAnchor] = useState(null)
  const { user, logout } = useAuth()
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const navigation = getNavigationForRole(user?.role)
  const roleHome = getRoleDestination(user?.role)
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`

  const isItemActive = (path) =>
    location.pathname === path ||
    (path.split('/').length > 2 &&
      location.pathname.startsWith(`${path}/`))

  const handleLogout = () => {
    setAccountAnchor(null)
    logout()
    navigate('/login')
  }

  const goToAccountPage = (path) => {
    setAccountAnchor(null)
    navigate(path)
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ minHeight: 72, px: 3 }}>
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            color="primary.dark"
          >
            Maxicare Clinic
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Academic prototype
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List
        component="nav"
        aria-label={`${user?.role || 'User'} portal navigation`}
        sx={{ px: 1.5, py: 2 }}
      >
        {navigation.map((item) => {
          const Icon = item.icon
          const selected = isItemActive(item.path)

          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{ mb: 0.5, borderRadius: 2.5 }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 42,
                  color: selected ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: selected ? 700 : 500,
                }}
              />
            </ListItemButton>
          )
        })}
      </List>
      <Box sx={{ mt: 'auto', px: 3, pb: 2.5 }}>
        <Typography variant="caption" color="text.secondary">
          Clinic Management System
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ minHeight: 72, px: { xs: 2, sm: 3 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            sx={{ mr: 1.5, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
            {navigation.find((item) => isItemActive(item.path))?.label ||
              'Maxicare Clinic'}
          </Typography>

          <Tooltip title="Open account menu">
            <IconButton
              onClick={(event) => setAccountAnchor(event.currentTarget)}
              aria-label="Open account menu"
              aria-controls={accountAnchor ? 'account-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={accountAnchor ? 'true' : undefined}
              sx={{ borderRadius: 3, p: 0.5 }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: 'primary.main',
                    fontSize: 14,
                  }}
                >
                  {initials.toUpperCase() || 'U'}
                </Avatar>
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    textAlign: 'left',
                    pr: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="text.primary"
                  >
                    {fullName || 'Clinic user'}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {user?.role}
                  </Typography>
                </Box>
              </Stack>
            </IconButton>
          </Tooltip>
          <Menu
            id="account-menu"
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={() => setAccountAnchor(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => goToAccountPage(`${roleHome}/profile`)}>
              <ListItemIcon>
                <AccountCircleOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem
              onClick={() => goToAccountPage(`${roleHome}/account-settings`)}
            >
              <ListItemIcon>
                <SettingsOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Account Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRightColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          pt: '72px',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 1280,
            mx: 'auto',
            p: { xs: 2, sm: 3, lg: 4 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default AuthenticatedLayout
