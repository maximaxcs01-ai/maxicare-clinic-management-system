import { useEffect, useRef, useState } from 'react'

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return Number.isNaN(date.getTime()) ? null : date
}

function toDateValue(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDate(value) {
  const date = parseDate(value)

  if (!date) {
    return 'Select date of birth'
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function DatePicker({ id, value, onChange, error }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const selectedDate = parseDate(value)
  const startingDate = selectedDate || today
  const currentYear = today.getFullYear()
  const minimumYear = currentYear - 120
  const [isOpen, setIsOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(startingDate.getMonth())
  const [viewYear, setViewYear] = useState(startingDate.getFullYear())
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const toggleCalendar = () => {
    if (!isOpen) {
      const dateToShow = parseDate(value) || today
      setViewMonth(dateToShow.getMonth())
      setViewYear(dateToShow.getFullYear())
    }

    setIsOpen((current) => !current)
  }

  const showPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((year) => year - 1)
    } else {
      setViewMonth((month) => month - 1)
    }
  }

  const showNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((year) => year + 1)
    } else {
      setViewMonth((month) => month + 1)
    }
  }

  const handleYearChange = (event) => {
    const nextYear = Number(event.target.value)
    setViewYear(nextYear)

    if (nextYear === currentYear && viewMonth > today.getMonth()) {
      setViewMonth(today.getMonth())
    }
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const calendarDays = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const atMinimumMonth = viewYear === minimumYear && viewMonth === 0
  const atCurrentMonth =
    viewYear === currentYear && viewMonth === today.getMonth()
  const years = Array.from({ length: 121 }, (_, index) => currentYear - index)

  const selectDay = (day) => {
    onChange(toDateValue(viewYear, viewMonth, day))
    setIsOpen(false)
  }

  return (
    <div className="form-field date-picker" ref={containerRef}>
      <label htmlFor={id}>Date of Birth</label>
      <button
        id={id}
        type="button"
        className={`date-picker-trigger${error ? ' input-error' : ''}`}
        onClick={toggleCalendar}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={value ? '' : 'date-placeholder'}>
          {formatDate(value)}
        </span>
        <span aria-hidden="true">▾</span>
      </button>

      {error && <p className="field-error">{error}</p>}

      {isOpen && (
        <div className="calendar-panel" role="dialog" aria-label="Choose date of birth">
          <div className="calendar-controls">
            <button
              type="button"
              className="calendar-arrow"
              onClick={showPreviousMonth}
              disabled={atMinimumMonth}
              aria-label="Previous month"
            >
              ‹
            </button>

            <select
              value={viewMonth}
              onChange={(event) => setViewMonth(Number(event.target.value))}
              aria-label="Month"
            >
              {monthNames.map((month, index) => (
                <option
                  key={month}
                  value={index}
                  disabled={viewYear === currentYear && index > today.getMonth()}
                >
                  {month}
                </option>
              ))}
            </select>

            <select value={viewYear} onChange={handleYearChange} aria-label="Year">
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="calendar-arrow"
              onClick={showNextMonth}
              disabled={atCurrentMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="calendar-grid calendar-weekdays">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} />
              }

              const dateValue = toDateValue(viewYear, viewMonth, day)
              const candidateDate = new Date(viewYear, viewMonth, day)
              const isFuture = candidateDate > today
              const isSelected = value === dateValue

              return (
                <button
                  key={dateValue}
                  type="button"
                  className={`calendar-day${isSelected ? ' selected' : ''}`}
                  onClick={() => selectDay(day)}
                  disabled={isFuture}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
