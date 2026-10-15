import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import FolderSharedOutlinedIcon from '@mui/icons-material/FolderSharedOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import {
  Alert,
  Box,
  CircularProgress,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import DoctorAvatar from '../components/DoctorAvatar'
import ServiceTypeIcon from '../components/ServiceTypeIcon'
import useAuth from '../hooks/useAuth'
import api from '../services/api'
import { getRoleDestination } from '../utils/authRoutes'

const clinicPhoto =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=85'

const features = [
  {
    icon: GroupsOutlinedIcon,
    title: 'Care from active clinicians',
    text: 'Explore doctors currently listed by the clinic.',
  },
  {
    icon: CalendarMonthOutlinedIcon,
    title: 'Convenient scheduling',
    text: 'Review available appointment options through the patient portal.',
  },
  {
    icon: FolderSharedOutlinedIcon,
    title: 'Your health records',
    text: 'Access your clinic information in one secure place.',
  },
]

const formatFee = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value)

function PublicLanding() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [catalog, setCatalog] = useState({ doctors: [], services: [] })
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const { token, user } = useAuth()
  const closeMenu = () => setMenuOpen(false)
  const bookingPath = !token
    ? '/register'
    : user?.role === 'patient'
      ? '/patient/appointments/book'
      : getRoleDestination(user?.role)

  useEffect(() => {
    let active = true
    api
      .get('/public/catalog')
      .then((response) => {
        if (!active) return
        const data = response.data.data
        setCatalog({
          doctors: Array.isArray(data?.doctors) ? data.doctors : [],
          services: Array.isArray(data?.services) ? data.services : [],
        })
        setCatalogError('')
      })
      .catch((requestError) => {
        if (active) {
          setCatalogError(
            requestError.response?.data?.message ||
              'Clinic services and doctors are temporarily unavailable.',
          )
        }
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const sectionLink = (id, label) => (
    <a href={`#${id}`} onClick={closeMenu}>
      {label}
    </a>
  )

  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link to="/" className="landing-brand-link" aria-label="Maxicare Clinic home">
            <BrandMark />
          </Link>

          <button
            type="button"
            className="landing-menu-toggle"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuRoundedIcon />
          </button>

          <nav
            id="landing-navigation"
            className={`landing-navigation${menuOpen ? ' landing-navigation-open' : ''}`}
            aria-label="Main navigation"
          >
            {sectionLink('home', 'Home')}
            {sectionLink('doctors', 'Find a Doctor')}
            {sectionLink('services', 'Services')}
            {sectionLink('about', 'About')}
            {sectionLink('contact', 'Contact')}
            <div className="landing-mobile-actions">
              <Link to="/login" className="landing-login" onClick={closeMenu}>
                Log In
              </Link>
              <Link
                to={bookingPath}
                className="landing-button landing-button-primary"
                onClick={closeMenu}
              >
                Book Appointment
              </Link>
            </div>
          </nav>

          <div className="landing-header-actions">
            <Link to="/login" className="landing-login">
              Log In
            </Link>
            <Link
              to={bookingPath}
              className="landing-button landing-button-primary"
            >
              Book Appointment
            </Link>
          </div>
        </div>
      </header>

      <section className="landing-hero" id="home">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">Professional care, close to home</span>
            <h1>Your care,<br />made simpler.</h1>
            <p>
              Book trusted clinic care, manage your appointments, and keep your
              health information organized in one secure place.
            </p>
            <div className="landing-hero-actions">
              <Link
                to={bookingPath}
                className="landing-button landing-button-primary landing-button-large"
              >
                Check available appointments
              </Link>
              <a
                href="#doctors"
                className="landing-button landing-button-outline landing-button-large"
              >
                Find a Doctor
              </a>
            </div>
          </div>

          <div className="landing-hero-media">
            <img
              src={clinicPhoto}
              alt="Doctor speaking with a patient in a modern clinic"
            />
            <aside className="landing-appointment-card">
              <div className="landing-appointment-heading">
                <span>Ready to plan your visit?</span>
              </div>
              <strong>Check available appointments</strong>
              <p>View current scheduling options in the patient portal.</p>
              <Link
                to={bookingPath}
                className="landing-card-link"
              >
                View Schedule
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section className="landing-features" aria-label="Clinic features">
        <div className="landing-features-inner">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="landing-feature">
              <span className="landing-feature-icon" aria-hidden="true"><Icon /></span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-catalog-section" id="doctors">
        <div className="landing-section-inner">
          <div className="landing-section-heading">
            <span className="landing-section-eyebrow">Our care team</span>
            <h2>Find a Doctor</h2>
            <p>Explore active doctors and the services they currently support.</p>
          </div>
          {catalogError && <Alert severity="error">{catalogError}</Alert>}
          {catalogLoading ? (
            <Box className="landing-loading">
              <CircularProgress size={30} />
            </Box>
          ) : catalog.doctors.length ? (
            <div className="landing-doctor-grid">
              {catalog.doctors.map((doctor, index) => (
                <article
                  key={`${doctor.firstName}-${doctor.lastName}-${doctor.specialization}-${index}`}
                  className="landing-doctor-card"
                >
                  <DoctorAvatar
                    imageUrl={doctor.profileImage?.url}
                    firstName={doctor.firstName}
                    lastName={doctor.lastName}
                    size={76}
                    sx={{ bgcolor: '#eaf3fa', color: '#1769aa', fontSize: 25 }}
                  />
                  <h3>
                    Dr. {[doctor.firstName, doctor.middleName, doctor.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </h3>
                  <p className="landing-doctor-specialization">
                    {doctor.specialization}
                  </p>
                  {doctor.services?.length > 0 ? (
                    <ul aria-label="Supported services">
                      {doctor.services.map((service) => (
                        <li key={service}>{service}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="landing-card-secondary">
                      Service information is not currently listed.
                    </p>
                  )}
                  <Link
                    to={bookingPath}
                    className="landing-card-link"
                  >
                    View / Book Appointment
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="landing-empty-state">
              Doctor profiles will appear here when available.
            </p>
          )}
        </div>
      </section>

      <section className="landing-catalog-section landing-services-section" id="services">
        <div className="landing-section-inner">
          <div className="landing-section-heading">
            <span className="landing-section-eyebrow">Clinic care</span>
            <h2>Our Services</h2>
            <p>View currently active services offered by the clinic.</p>
          </div>
          {catalogLoading ? (
            <Box className="landing-loading">
              <CircularProgress size={30} />
            </Box>
          ) : catalog.services.length ? (
            <div className="landing-service-grid">
              {catalog.services.map((service, index) => (
                <article
                  key={`${service.name}-${index}`}
                  className="landing-service-card"
                >
                  <span className="landing-service-icon">
                    <ServiceTypeIcon serviceName={service.name} />
                  </span>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <div className="landing-service-meta">
                    <span>{service.durationMinutes} minutes</span>
                    <strong>{formatFee(service.fee)}</strong>
                  </div>
                  <Link to={bookingPath} className="landing-card-link">
                    Book this service
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="landing-empty-state">
              Clinic services will appear here when available.
            </p>
          )}
        </div>
      </section>

      <section className="landing-about" id="about">
        <span>Maxicare Clinic</span>
        <h2>Reliable care for everyday health needs.</h2>
        <p>
          Our clinic brings patients, doctors, and care teams together through
          clear communication and dependable service.
        </p>
      </section>

      <section className="landing-contact" id="contact">
        <div className="landing-contact-content">
          <span className="landing-section-eyebrow">Contact</span>
          <h2>Plan your next visit</h2>
          <p>
            Sign in or create a patient account to review appointment options and
            connect with the clinic through its scheduling workflow.
          </p>
          <Link to={bookingPath} className="landing-button landing-button-primary">
            Book Appointment
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <BrandMark light />
          <p>Professional healthcare made easier.</p>
          <Link to="/login">Patient and staff portal</Link>
        </div>
      </footer>
    </main>
  )
}

export default PublicLanding
