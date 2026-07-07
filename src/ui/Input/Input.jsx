import './input.css'

export default function Input({
  label,
  error,
  fullWidth = true,
  ...props
}) {
  return (
    <div
      className={`sigmo-input-wrapper ${
        fullWidth ? 'full' : ''
      }`}
    >
      {label && (
        <label className="sigmo-label">
          {label}
        </label>
      )}

      <input
        className={`sigmo-input ${
          error ? 'error' : ''
        }`}
        {...props}
      />

      {error && (
        <small className="sigmo-error">
          {error}
        </small>
      )}
    </div>
  )
}