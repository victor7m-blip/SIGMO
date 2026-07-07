import './SigmoCard.css'

export default function SigmoCard({ children, className = '' }) {
  return (
    <section className={`sigmo-card ${className}`}>
      {children}
    </section>
  )
}