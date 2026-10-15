import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import {
  AppBar,
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
import BrandMark from './BrandMark'
import ProfileAvatar from './ProfileAvatar'

const defaultDrawerWidth = 272
const patientDrawerWidth = 224
const patientCollapsedDrawerWidth = 72
const patientSidebarStorageKey = 'patientSidebarCollapsed'
const receptionistSidebarStorageKey = 'receptionistSidebarCollapsed'
const doctorSidebarStorageKey = 'doctorSidebarCollapsed'
const adminSidebarStorageKey = 'adminSidebarCollapsed'

function AuthenticatedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountAnchor, setAccountAnchor] = useState(null)
  const [patientSidebarCollapsed, setPatientSidebarCollapsed] = useState(
    () => sessionStorage.getItem(patientSidebarStorageKey) === 'true',
  )
  const [receptionistSidebarCollapsed, setReceptionistSidebarCollapsed] = useState(
    () => sessionStorage.getItem(receptionistSidebarStorageKey) === 'true',
  )
  const [doctorSidebarCollapsed, setDoctorSidebarCollapsed] = useState(
    () => sessionStorage.getItem(doctorSidebarStorageKey) === 'true',
  )
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(
    () => sessionStorage.getItem(adminSidebarStorageKey) === 'true',
  )
  const { user, logout } = useAuth()
  const theme = useTheme()
  const patientDesktop = useMediaQuery('(min-width:768px)')
  const standardDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const navigation = getNavigationForRole(user?.role)
  const isPatient = user?.role === 'patient'
  const isReceptionist = user?.role === 'receptionist'
  const isDoctor = user?.role === 'doctor'
  const isAdmin = user?.role === 'admin'
  const usesCollapsibleSidebar =
    isPatient || isReceptionist || isDoctor || isAdmin
  const desktop = usesCollapsibleSidebar ? patientDesktop : standardDesktop
  const sidebarCollapsed =
    desktop &&
    ((isPatient && patientSidebarCollapsed) ||
      (isReceptionist && receptionistSidebarCollapsed) ||
      (isDoctor && doctorSidebarCollapsed) ||
      (isAdmin && adminSidebarCollapsed))
  const drawerWidth = usesCollapsibleSidebar
    ? sidebarCollapsed
      ? patientCollapsedDrawerWidth
      : patientDrawerWidth
    : defaultDrawerWidth
  const roleHome = getRoleDestination(user?.role)
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  const isItemActive = (path) =>
    location.pathname === path ||
    (path.split('/').length > 2 &&
      location.pathname.startsWith(`${path}/`))

  const handleLogout = () => {
    setAccountAnchor(null)
    logout()
    navigate('/', { replace: true })
  }

  const goToAccountPage = (path) => {
    setAccountAnchor(null)
    navigate(path)
  }

  const toggleSidebar = () => {
    const setCollapsed = isReceptionist
      ? setReceptionistSidebarCollapsed
      : isDoctor
        ? setDoctorSidebarCollapsed
        : isAdmin
          ? setAdminSidebarCollapsed
          : setPatientSidebarCollapsed
    const storageKey = isReceptionist
      ? receptionistSidebarStorageKey
      : isDoctor
        ? doctorSidebarStorageKey
        : isAdmin
          ? adminSidebarStorageKey
          : patientSidebarStorageKey

    setCollapsed((collapsed) => {
      const nextValue = !collapsed
      sessionStorage.setItem(storageKey, String(nextValue))
      return nextValue
    })
  }

  const drawer = (
    <Box className="portal-drawer-content" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        className="portal-branding"
        sx={{
          minHeight: 84,
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          px: sidebarCollapsed ? 1 : 2.5,
        }}
      >
        {!sidebarCollapsed && <BrandMark />}
        {usesCollapsibleSidebar && desktop && (
          <Tooltip title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
            <IconButton
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              size="small"
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>
        )}
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

          const navigationButton = (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{
                mb: 0.5,
                minHeight: 44,
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                borderRadius: 2.5,
                px: sidebarCollapsed ? 1 : 2,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: sidebarCollapsed ? 0 : 42,
                  justifyContent: 'center',
                  color: selected ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon fontSize="small" />
              </ListItemIcon>
              {!sidebarCollapsed && (
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      fontSize: 14,
                      fontWeight: selected ? 700 : 500,
                    },
                  }}
                />
              )}
            </ListItemButton>
          )

          return sidebarCollapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right">
              {navigationButton}
            </Tooltip>
          ) : (
            navigationButton
          )
        })}
      </List>
      {!sidebarCollapsed && (
        <Box className="portal-tagline" sx={{ mt: 'auto', mx: 2, mb: 2.5, p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {user?.role === 'patient'
              ? 'Living your best life'
              : 'Clinic Management System'}
          </Typography>
        </Box>
      )}
    </Box>
  )

  return (
    <Box
      className={`authenticated-shell authenticated-shell-${user?.role || 'user'}`}
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
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          transition: theme.transitions.create(['width', 'margin-left'], {
            duration: theme.transitions.duration.shorter,
          }),
          ...(usesCollapsibleSidebar
            ? {
                '@media (min-width:768px)': {
                  width: `calc(100% - ${drawerWidth}px)`,
                  ml: `${drawerWidth}px`,
                },
              }
            : {
                [theme.breakpoints.up('md')]: {
                  width: `calc(100% - ${drawerWidth}px)`,
                  ml: `${drawerWidth}px`,
                },
              }),
        }}
      >
        <Toolbar sx={{ minHeight: 72, px: { xs: 2, sm: 3 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            sx={{
              mr: 1.5,
              display: usesCollapsibleSidebar ? 'inline-flex' : { md: 'none' },
              ...(usesCollapsibleSidebar && {
                '@media (min-width:768px)': { display: 'none' },
              }),
            }}
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
              <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                <ProfileAvatar
                  imageUrl={user?.profileImage?.url}
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  size={38}
                  sx={{ bgcolor: 'primary.main', fontSize: 14 }}
                />
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
          ...(usesCollapsibleSidebar
            ? {
                '@media (min-width:768px)': {
                  width: drawerWidth,
                  flexShrink: 0,
                },
              }
            : {
                [theme.breakpoints.up('md')]: {
                  width: drawerWidth,
                  flexShrink: 0,
                },
              }),
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRightColor: 'divider',
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.shorter,
            }),
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        className="portal-main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          pt: '72px',
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
          ...(usesCollapsibleSidebar
            ? {
                '@media (min-width:768px)': {
                  width: `calc(100% - ${drawerWidth}px)`,
                },
              }
            : {
                [theme.breakpoints.up('md')]: {
                  width: `calc(100% - ${drawerWidth}px)`,
                },
              }),
        }}
      >
        <Box
          className="portal-content"
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
