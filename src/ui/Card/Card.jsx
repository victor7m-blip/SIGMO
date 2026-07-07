import './card.css'

export default function Card({
  children,
  title,
  subtitle,
  actions,
  className = ''
}) {
  return (
    <div className={`sigmo-card ${className}`}>
      {(title || subtitle || actions) && (
        <div className="sigmo-card-header">

          <div>

            {title && (
              <h3 className="sigmo-card-title">
                {title}
              </h3>
            )}

            {subtitle && (
              <p className="sigmo-card-subtitle">
                {subtitle}
              </p>
            )}

          </div>

          {actions && (
            <div className="sigmo-card-actions">
              {actions}
            </div>
          )}

        </div>
      )}

      <div className="sigmo-card-body">
        {children}
      </div>
    </div>
  )
}