import './SigmoInput.css'

export default function SigmoSelect({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
  disabled = false
}) {
  return (
    <label className="sigmo-field">
      <span>{label}</span>
      <select
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
        disabled={disabled}
      >
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
    </label>
  )
}