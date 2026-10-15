import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationApi'
import { getNotificationDestination } from '../utils/notificationRoutes'

const relativeTime = (value) => {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const ranges = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

function NotificationBell({ role }) {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const [anchor, setAnchor] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const requestInFlightRef = useRef(null)
  const requestControllerRef = useRef(null)
  const mountedRef = useRef(false)
  const resumeRefreshAtRef = useRef(0)
  const eligible = Boolean(token && user && user.mustChangePassword !== true)

  const refreshNotifications = useCallback(
    (showError = false) => {
      if (!eligible) return Promise.resolve()
      if (requestInFlightRef.current) return requestInFlightRef.current

      const controller = new AbortController()
      requestControllerRef.current = controller
      if (showError) setLoading(true)

      const request = getNotifications(15, { signal: controller.signal })
        .then((response) => {
          if (!mountedRef.current) return
          setNotifications(response.data.data || [])
          setUnreadCount(response.data.unreadCount || 0)
          if (showError) setError('')
        })
        .catch((requestError) => {
          if (!mountedRef.current || requestError.name === 'CanceledError') return
          if (showError) {
            setError(
              requestError.response?.data?.message ||
                'Unable to load notifications.',
            )
          }
        })
        .finally(() => {
          if (requestInFlightRef.current === request) {
            requestInFlightRef.current = null
          }
          if (requestControllerRef.current === controller) {
            requestControllerRef.current = null
          }
          if (mountedRef.current && showError) setLoading(false)
        })

      requestInFlightRef.current = request
      return request
    },
    [eligible],
  )

  useEffect(() => {
    if (!eligible) return undefined
    mountedRef.current = true
    const initialRefresh = window.setTimeout(refreshNotifications, 0)

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') refreshNotifications()
    }, 15000)
    const refreshOnResume = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - resumeRefreshAtRef.current < 1000) return
      resumeRefreshAtRef.current = now
      refreshNotifications()
    }
    document.addEventListener('visibilitychange', refreshOnResume)
    window.addEventListener('focus', refreshOnResume)

    return () => {
      mountedRef.current = false
      window.clearTimeout(initialRefresh)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshOnResume)
      window.removeEventListener('focus', refreshOnResume)
      requestControllerRef.current?.abort()
      requestControllerRef.current = null
      requestInFlightRef.current = null
    }
  }, [eligible, refreshNotifications])

  const openNotifications = (event) => {
    setAnchor(event.currentTarget)
    setError('')
    refreshNotifications(true)
  }

  const openNotification = async (notification) => {
    const destination = getNotificationDestination(notification, role)
    if (!destination) return

    if (!notification.isRead) {
      try {
        await markNotificationRead(notification._id)
        setNotifications((current) =>
          current.map((item) =>
            item._id === notification._id ? { ...item, isRead: true } : item,
          ),
        )
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || 'Unable to update notification.',
        )
        return
      }
    }

    setAnchor(null)
    navigate(destination)
  }

  const markAllRead = async () => {
    if (!unreadCount || markingAll) return
    setMarkingAll(true)
    setError('')
    try {
      await markAllNotificationsRead()
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      )
      setUnreadCount(0)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Unable to update notifications.',
      )
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <>
      <IconButton
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        onClick={openNotifications}
        sx={{ mr: 1 }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsNoneOutlinedIcon />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 'min(380px, calc(100vw - 24px))',
              maxHeight: 'min(560px, calc(100vh - 96px))',
              mt: 1,
            },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Box>
            <Typography fontWeight={700}>Notifications</Typography>
            <Typography variant="caption" color="text.secondary">
              {unreadCount} unread
            </Typography>
          </Box>
          <Button size="small" disabled={!unreadCount || markingAll} onClick={markAllRead}>
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </Button>
        </Stack>
        <Divider />
        {error && <Alert severity="error" sx={{ m: 1.5 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length ? (
          <List disablePadding sx={{ overflowY: 'auto' }}>
            {notifications.map((notification) => {
              const destination = getNotificationDestination(notification, role)
              return (
                <ListItemButton
                  key={notification._id}
                  onClick={() => openNotification(notification)}
                  disabled={!destination}
                  aria-label={`${notification.title}${notification.isRead ? '' : ', unread'}`}
                  sx={{ alignItems: 'flex-start', gap: 1.25, py: 1.5, bgcolor: notification.isRead ? 'transparent' : 'action.hover' }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{ width: 8, height: 8, mt: 0.75, flex: '0 0 auto', borderRadius: '50%', bgcolor: notification.isRead ? 'transparent' : 'primary.main' }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="body2" fontWeight={notification.isRead ? 600 : 750}>
                        {notification.title}
                      </Typography>
                      {!notification.isRead && (
                        <Typography variant="caption" color="primary" fontWeight={700}>
                          Unread
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {relativeTime(notification.createdAt)}
                    </Typography>
                  </Box>
                </ListItemButton>
              )
            })}
          </List>
        ) : (
          <Typography color="text.secondary" align="center" sx={{ px: 2, py: 5 }}>
            No notifications yet.
          </Typography>
        )}
      </Popover>
    </>
  )
}

export default NotificationBell
