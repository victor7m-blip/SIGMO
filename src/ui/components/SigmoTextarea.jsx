import './SigmoInput.css'

export default function SigmoTextarea({
  label,
  name,
  value,
  onChange,
  placeholder = '',
  rows = 4,
  disabled = false
}) {
  return (
    <label className="sigmo-field">
      <span>{label}</span>
      <textarea
        name={name}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
      />
    </label>
  )
}