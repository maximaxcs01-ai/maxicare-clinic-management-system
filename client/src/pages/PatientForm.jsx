import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AutocompleteInput from '../components/AutocompleteInput'
import DatePicker from '../components/DatePicker'
import {
  philippineLocations,
  philippineProvinces,
} from '../data/philippineLocations'
import api from '../services/api'

const namePattern = /^[\p{L}\s'-]+$/u
const contactNumberPattern = /^09\d{9}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const initialForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  contactNumber: '',
  email: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
  },
}

function getTodayValue() {
  const today = new Date()

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(today.getDate()).padStart(2, '0')}`
}

function isValidDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function getAddressForForm(address) {
  if (address && typeof address === 'object') {
    return {
      street: address.street || '',
      barangay: address.barangay || '',
      city: address.city || '',
      province: address.province || '',
    }
  }

  return {
    ...initialForm.address,
    street: typeof address === 'string' ? address : '',
  }
}

function validateName(value, label) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return `${label} is required.`
  }

  if (
    trimmedValue.length < 2 ||
    trimmedValue.length > 50 ||
    !namePattern.test(trimmedValue)
  ) {
    return `${label} must be 2 to 50 characters and use letters, spaces, hyphens, or apostrophes.`
  }

  return ''
}

function validateForm(formData, locationSelection) {
  const errors = {
    firstName: validateName(formData.firstName, 'First name'),
    lastName: validateName(formData.lastName, 'Last name'),
  }

  if (!formData.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.'
  } else if (!isValidDateValue(formData.dateOfBirth)) {
    errors.dateOfBirth = 'Please select a valid date of birth.'
  } else if (formData.dateOfBirth > getTodayValue()) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.'
  }

  if (!['Male', 'Female'].includes(formData.gender)) {
    errors.gender = 'Please select a gender.'
  }

  if (!contactNumberPattern.test(formData.contactNumber)) {
    errors.contactNumber =
      'Contact number must be 11 digits and start with 09.'
  }

  if (!emailPattern.test(formData.email.trim())) {
    errors.email = 'Please enter a valid email address.'
  }

  if (!formData.address.street.trim()) {
    errors.street = 'Street / House No. is required.'
  }

  if (!formData.address.barangay.trim()) {
    errors.barangay = 'Barangay is required.'
  }

  const provinceIsValid =
    locationSelection.province &&
    Object.hasOwn(philippineLocations, formData.address.province)

  if (!provinceIsValid) {
    errors.province = 'Please select a valid province or region.'
  }

  const cityIsValid =
    provinceIsValid &&
    locationSelection.city &&
    philippineLocations[formData.address.province].includes(
      formData.address.city,
    )

  if (!cityIsValid) {
    errors.city =
      'Please select a valid city or municipality for the selected province.'
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  )
}

function FieldError({ message }) {
  return message ? <p className="field-error">{message}</p> : null
}

function PatientForm() {
  const [formData, setFormData] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isProvinceSelected, setIsProvinceSelected] = useState(false)
  const [isCitySelected, setIsCitySelected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)

  useEffect(() => {
    if (!isEditMode) {
      return undefined
    }

    let active = true

    const loadPatient = async () => {
      try {
        setLoadingPatient(true)
        const response = await api.get(`/patients/${id}`)
        const patient = response.data.patient
        const address = getAddressForForm(patient.address)
        const provinceIsValid = Object.hasOwn(
          philippineLocations,
          address.province,
        )
        const cityIsValid =
          provinceIsValid &&
          philippineLocations[address.province].includes(address.city)

        if (active) {
          setFormData({
            firstName: patient.firstName || '',
            lastName: patient.lastName || '',
            dateOfBirth: patient.dateOfBirth?.slice(0, 10) || '',
            gender: patient.gender || '',
            contactNumber: patient.contactNumber || '',
            email: patient.email || '',
            address,
          })
          setIsProvinceSelected(provinceIsValid)
          setIsCitySelected(cityIsValid)
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'Unable to load patient.',
          )
        }
      } finally {
        if (active) {
          setLoadingPatient(false)
        }
      }
    }

    loadPatient()

    return () => {
      active = false
    }
  }, [id, isEditMode])

  const clearFieldError = (field) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      return {
        ...currentErrors,
        [field]: '',
      }
    })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }))
    clearFieldError(name)
  }

  const handleContactChange = (event) => {
    const contactNumber = event.target.value.replace(/\D/g, '').slice(0, 11)
    setFormData((currentData) => ({
      ...currentData,
      contactNumber,
    }))
    clearFieldError('contactNumber')
  }

  const handleAddressChange = (field, value) => {
    setFormData((currentData) => ({
      ...currentData,
      address: {
        ...currentData.address,
        [field]: value,
      },
    }))
    clearFieldError(field)
  }

  const handleProvinceInput = (province) => {
    const provinceChanged = province !== formData.address.province

    setFormData((currentData) => ({
      ...currentData,
      address: {
        ...currentData.address,
        province,
        city: provinceChanged ? '' : currentData.address.city,
      },
    }))
    setIsProvinceSelected(false)

    if (provinceChanged) {
      setIsCitySelected(false)
      clearFieldError('city')
    }

    clearFieldError('province')
  }

  const handleProvinceSelect = (province) => {
    setFormData((currentData) => ({
      ...currentData,
      address: {
        ...currentData.address,
        province,
      },
    }))
    setIsProvinceSelected(true)
    clearFieldError('province')
  }

  const handleCityInput = (city) => {
    handleAddressChange('city', city)
    setIsCitySelected(false)
  }

  const handleCitySelect = (city) => {
    handleAddressChange('city', city)
    setIsCitySelected(true)
  }

  const handleDateChange = (dateOfBirth) => {
    setFormData((currentData) => ({
      ...currentData,
      dateOfBirth,
    }))
    clearFieldError('dateOfBirth')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const validationErrors = validateForm(formData, {
      province: isProvinceSelected,
      city: isCitySelected,
    })
    setFieldErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const patientData = {
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      address: {
        street: formData.address.street.trim(),
        barangay: formData.address.barangay.trim(),
        city: formData.address.city.trim(),
        province: formData.address.province.trim(),
      },
    }

    try {
      setLoading(true)

      if (isEditMode) {
        await api.put(`/patients/${id}`, patientData)
      } else {
        await api.post('/patients', patientData)
      }

      navigate('/patients')
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Unable to save patient.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (loadingPatient) {
    return <p className="state-message">Loading patient...</p>
  }

  const selectedProvinceIsValid =
    isProvinceSelected &&
    Object.hasOwn(philippineLocations, formData.address.province)
  const cityOptions = selectedProvinceIsValid
    ? philippineLocations[formData.address.province]
    : []

  return (
    <section>
      <div className="page-heading-row">
        <h1>{isEditMode ? 'Edit Patient' : 'Add Patient'}</h1>
      </div>

      {error && <div className="message error-message">{error}</div>}

      <div className="content-panel form-panel">
        <form className="patient-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleChange}
              className={fieldErrors.firstName ? 'input-error' : ''}
              maxLength="50"
              autoComplete="given-name"
              required
            />
            <FieldError message={fieldErrors.firstName} />
          </div>

          <div className="form-field">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleChange}
              className={fieldErrors.lastName ? 'input-error' : ''}
              maxLength="50"
              autoComplete="family-name"
              required
            />
            <FieldError message={fieldErrors.lastName} />
          </div>

          <DatePicker
            id="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleDateChange}
            error={fieldErrors.dateOfBirth}
          />

          <div className="form-field">
            <label htmlFor="gender">Gender</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className={fieldErrors.gender ? 'input-error' : ''}
              required
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <FieldError message={fieldErrors.gender} />
          </div>

          <div className="form-field">
            <label htmlFor="contactNumber">Contact Number</label>
            <input
              id="contactNumber"
              name="contactNumber"
              type="text"
              inputMode="numeric"
              value={formData.contactNumber}
              onChange={handleContactChange}
              className={fieldErrors.contactNumber ? 'input-error' : ''}
              maxLength={11}
              autoComplete="tel"
              required
            />
            <FieldError message={fieldErrors.contactNumber} />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={fieldErrors.email ? 'input-error' : ''}
              autoComplete="email"
              required
            />
            <FieldError message={fieldErrors.email} />
          </div>

          <h2 className="form-section-heading full-width-field">Address</h2>

          <div className="form-field full-width-field">
            <label htmlFor="street">Street / House No.</label>
            <input
              id="street"
              type="text"
              value={formData.address.street}
              onChange={(event) =>
                handleAddressChange('street', event.target.value)
              }
              className={fieldErrors.street ? 'input-error' : ''}
              autoComplete="street-address"
              required
            />
            <FieldError message={fieldErrors.street} />
          </div>

          <div className="form-field">
            <label htmlFor="barangay">Barangay</label>
            <input
              id="barangay"
              type="text"
              value={formData.address.barangay}
              onChange={(event) =>
                handleAddressChange('barangay', event.target.value)
              }
              className={fieldErrors.barangay ? 'input-error' : ''}
              required
            />
            <FieldError message={fieldErrors.barangay} />
          </div>

          <AutocompleteInput
            id="province"
            label="Province / Region"
            value={formData.address.province}
            onChange={handleProvinceInput}
            onSelect={handleProvinceSelect}
            options={philippineProvinces}
            placeholder="Type a province or region"
            noMatchesMessage="No matching province found"
            error={fieldErrors.province}
          />

          <div className="full-width-field">
            <AutocompleteInput
              id="city"
              label="City / Municipality"
              value={formData.address.city}
              onChange={handleCityInput}
              onSelect={handleCitySelect}
              options={cityOptions}
              placeholder={
                selectedProvinceIsValid
                  ? 'Type a city or municipality'
                  : 'Select a province first'
              }
              noMatchesMessage="No matching city found"
              error={fieldErrors.city}
              disabled={!selectedProvinceIsValid}
            />
          </div>

          <div className="form-actions full-width-field">
            <button
              type="submit"
              className="button primary-button"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Patient'}
            </button>
            <button
              type="button"
              className="button secondary-button"
              onClick={() => navigate('/patients')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default PatientForm
