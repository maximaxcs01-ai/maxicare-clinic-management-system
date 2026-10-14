function BrandMark({ light = false }) {
  return (
    <span className={`brand-mark${light ? ' brand-mark-light' : ''}`}>
      <img
        className="brand-mark-image"
        src="/maxicare-logo.png"
        alt="Maxicare"
      />
    </span>
  )
}

export default BrandMark
