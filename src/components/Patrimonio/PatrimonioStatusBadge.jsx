import './PatrimonioStatusBadge.css'

export default function PatrimonioStatusBadge({ status }) {
  const value = status || 'SEM STATUS'

  return (
    <span className={`patrimonio-status patrimonio-status-${value.toLowerCase().replaceAll(' ', '-')}`}>
      {value}
    </span>
  )
}