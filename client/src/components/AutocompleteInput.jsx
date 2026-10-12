import { useEffect, useRef, useState } from 'react'

function AutocompleteInput({
  id,
  label,
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  noMatchesMessage,
  error,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const searchValue = value.trim().toLowerCase()
  const matches = options
    .filter((option) => option.toLowerCase().includes(searchValue))
    .slice(0, 8)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const selectOption = (option) => {
    if (disabled) {
      return
    }

    onChange(option)
    onSelect?.(option)
    setHighlightedIndex(-1)
    setIsOpen(false)
  }

  const handleKeyDown = (event) => {
    if (disabled) {
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)

      if (matches.length === 0) {
        setHighlightedIndex(-1)
        return
      }

      setHighlightedIndex((index) => Math.min(index + 1, matches.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (matches.length === 0) {
        setHighlightedIndex(-1)
        return
      }

      setHighlightedIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter' && isOpen && highlightedIndex >= 0) {
      event.preventDefault()
      selectOption(matches[highlightedIndex])
    }
  }

  return (
    <div className="form-field autocomplete" ref={containerRef}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setHighlightedIndex(-1)
          setIsOpen(true)
        }}
        onFocus={() => {
          if (!disabled) {
            setIsOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={error ? 'input-error' : ''}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && !disabled}
        aria-controls={`${id}-suggestions`}
        disabled={disabled}
        required
      />

      {error && <p className="field-error">{error}</p>}

      {isOpen && !disabled && (
        <div className="autocomplete-panel" id={`${id}-suggestions`} role="listbox">
          {matches.length > 0 ? (
            matches.map((option, index) => (
              <button
                key={option}
                type="button"
                className={`autocomplete-option${
                  index === highlightedIndex ? ' highlighted' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                {option}
              </button>
            ))
          ) : (
            <div className="autocomplete-empty">{noMatchesMessage}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default AutocompleteInput
