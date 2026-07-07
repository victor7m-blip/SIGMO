import './button.css'

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  fullWidth = false,
  onClick
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        'sigmo-btn',
        `sigmo-btn-${variant}`,
        `sigmo-btn-${size}`,
        fullWidth ? 'sigmo-btn-full' : ''
      ].join(' ')}
    >
      {icon && <span className="sigmo-btn-icon">{icon}</span>}

      <span>{children}</span>
    </button>
  )
}