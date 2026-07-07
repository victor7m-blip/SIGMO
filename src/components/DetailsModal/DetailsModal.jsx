import './DetailsModal.css'

export default function DetailsModal({
  title,
  subtitle,
  isOpen,
  onClose,
  children
}) {
  if (!isOpen) return null

  return (
    <div className="details-modal-backdrop" onClick={onClose}>
      <section
        className="details-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="details-modal-header">
          <div>
            <span className="details-modal-kicker">SIGMO</span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            type="button"
            className="details-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="details-modal-content">
          {children}
        </div>

        <footer className="details-modal-footer">
          <button
            type="button"
            className="details-modal-close-button"
            onClick={onClose}
          >
            Fechar
          </button>
        </footer>
      </section>
    </div>
  )
}