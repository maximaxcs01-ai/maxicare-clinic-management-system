import { useRef } from 'react'

const OTP_LENGTH = 6

function OtpInput({ digits, onChange, disabled, label = 'Verification digit' }) {
  const inputRefs = useRef([])

  const updateDigits = (startIndex, value) => {
    const numericValue = value.replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!numericValue) return

    const next = [...digits]
    numericValue.split('').forEach((digit, offset) => {
      if (startIndex + offset < OTP_LENGTH) {
        next[startIndex + offset] = digit
      }
    })
    onChange(next)

    const nextIndex = Math.min(startIndex + numericValue.length, OTP_LENGTH - 1)
    inputRefs.current[nextIndex]?.focus()
  }

  const handleChange = (index, event) => {
    const value = event.target.value.replace(/\D/g, '')
    if (value.length > 1) {
      updateDigits(index, value)
      return
    }

    const next = [...digits]
    next[index] = value
    onChange(next)

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    event.preventDefault()
    updateDigits(0, event.clipboardData.getData('text'))
  }

  return (
    <div className="otp-inputs" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength="1"
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          aria-label={`${label} ${index + 1}`}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

export default OtpInput
