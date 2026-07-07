import './badge.css'

export default function Badge({
  children,
  color = 'blue'
}) {
  return (
    <span className={`sigmo-badge ${color}`}>
      {children}
    </span>
  )
}