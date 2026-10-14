import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import FolderSharedOutlinedIcon from '@mui/icons-material/FolderSharedOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

const clinicPhoto =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=85'

const features = [
  {
    icon: GroupsOutlinedIcon,
    title: 'Trusted Doctors',
    text: 'Experienced clinicians focused on your care.',
  },
  {
    icon: CalendarMonthOutlinedIcon,
    title: 'Easy Scheduling',
    text: 'Choose a convenient appointment in minutes.',
  },
  {
    icon: FolderSharedOutlinedIcon,
    title: 'Your Health Records',
    text: 'Access your clinic information in one place.',
  },
]

function PublicLanding() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

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
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuRoundedIcon />
          </button>

          <nav
            className={`landing-navigation${menuOpen ? ' landing-navigation-open' : ''}`}
            aria-label="Main navigation"
          >
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#doctors" onClick={closeMenu}>Find a Doctor</a>
            <a href="#services" onClick={closeMenu}>Services</a>
            <a href="#about" onClick={closeMenu}>About</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
            <div className="landing-mobile-actions">
              <Link to="/login" className="landing-login" onClick={closeMenu}>Log In</Link>
              <Link to="/register" className="landing-button landing-button-primary" onClick={closeMenu}>
                Book Appointment
              </Link>
            </div>
          </nav>

          <div className="landing-header-actions">
            <button className="landing-search-button" type="button" aria-label="Search">
              <SearchOutlinedIcon />
            </button>
            <Link to="/login" className="landing-login">Log In</Link>
            <Link to="/register" className="landing-button landing-button-primary">
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
              <Link to="/register" className="landing-button landing-button-primary landing-button-large">
                Book Appointment
              </Link>
              <a href="#doctors" className="landing-button landing-button-outline landing-button-large">
                Find a Doctor
              </a>
            </div>
          </div>

          <div className="landing-hero-media" id="doctors">
            <img
              src={clinicPhoto}
              alt="Doctor speaking with a patient in a modern clinic"
            />
            <aside className="landing-appointment-card" aria-label="Next available appointment">
              <div className="landing-appointment-heading">
                <span>Next Available Appointment</span>
                <span className="landing-availability">Available</span>
              </div>
              <strong>General Consultation</strong>
              <p>Dr. Maria Santos</p>
              <div className="landing-appointment-time">
                <span>Today</span>
                <strong>10:30 AM</strong>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="landing-features" id="services" aria-label="Clinic features">
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

      <section className="landing-about" id="about">
        <span>Maxicare Clinic</span>
        <h2>Reliable care for everyday health needs.</h2>
        <p>
          Our clinic brings patients, doctors, and care teams together through
          clear communication and dependable service.
        </p>
      </section>

      <footer className="landing-footer" id="contact">
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
