import './SigmoInput.css'

export default function SigmoInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
  disabled = false
}) {
  return (
    <label className="sigmo-field">
      <span>{label}</span>
      <input
        name={name}
        value={value || ''}
        onChange={onChange}
        type={type}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  )
}