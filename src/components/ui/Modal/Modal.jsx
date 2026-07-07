import './modal.css'

export default function Modal({
  open,
  title,
  children,
  footer,
  onClose
}) {
  if (!open) return null

  return (
    <div className="sigmo-modal-overlay">

      <div className="sigmo-modal">

        <div className="sigmo-modal-header">

          <h2>{title}</h2>

          <button
            className="sigmo-modal-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>

        <div className="sigmo-modal-body">
          {children}
        </div>

        {footer && (
          <div className="sigmo-modal-footer">
            {footer}
          </div>
        )}

      </div>

    </div>
  )
}