import './SigmoPage.css'

export default function SigmoPage({
  title,
  subtitle,
  actions,
  children,
  className = ''
}) {
  return (
    <main className={`sigmo-page ${className}`}>
      <header className="sigmo-page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {actions && (
          <div className="sigmo-page-actions">
            {actions}
          </div>
        )}
      </header>

      {children}
    </main>
  )
}