import './SigmoButton.css'

export default function SigmoButton({
  children,
  type = 'button',
  variant = 'primary',
  onClick,
  disabled = false,
  className = ''
}) {
  return (
    <button
      type={type}
      className={`sigmo-button sigmo-button-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}