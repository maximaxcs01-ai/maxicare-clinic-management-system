import BrandMark from './BrandMark'

function AuthPage({ children, wide = false, className = '' }) {
  return (
    <main className={`auth-page${wide ? ' auth-page-plain' : ' auth-page-photo'}`}>
      {!wide && <div className="auth-page-background" aria-hidden="true" />}
      <section className={`auth-panel${wide ? ' auth-panel-wide' : ''} ${className}`}>
        <div className="auth-panel-brand">
          <BrandMark />
        </div>
        {children}
      </section>
      <p className="auth-page-footer">
        © {new Date().getFullYear()} Maxicare Clinic. Care, close to home.
      </p>
    </main>
  )
}

export default AuthPage
