import './select.css'

export default function Select({
  label,
  error,
  children,
  fullWidth = true,
  ...props
}) {
  return (
    <div
      className={`sigmo-select-wrapper ${
        fullWidth ? 'full' : ''
      }`}
    >
      {label && (
        <label className="sigmo-label">
          {label}
        </label>
      )}

      <select
        className={`sigmo-select ${
          error ? 'error' : ''
        }`}
        {...props}
      >
        {children}
      </select>

      {error && (
        <small className="sigmo-error">
          {error}
        </small>
      )}
    </div>
  )
}