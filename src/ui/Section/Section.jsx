import './section.css'

export default function Section({
  title,
  subtitle,
  children,
  actions
}) {
  return (
    <section className="sigmo-section">

      {(title || subtitle || actions) && (

        <div className="sigmo-section-header">

          <div>

            {title && (
              <h2>{title}</h2>
            )}

            {subtitle && (
              <p>{subtitle}</p>
            )}

          </div>

          {actions && (
            <div className="sigmo-section-actions">
              {actions}
            </div>
          )}

        </div>

      )}

      {children}

    </section>
  )
}