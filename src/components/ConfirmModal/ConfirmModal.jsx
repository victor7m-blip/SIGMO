import './ConfirmModal.css'

export default function ConfirmModal({
  open,
  title = 'Confirmar ação',
  message = 'Deseja realmente continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
  onConfirm,
  onClose
}) {
  if (!open) return null

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal">
        <h2>{title}</h2>

        <p>{message}</p>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-cancel"
            onClick={onClose}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={danger ? 'confirm-modal-danger' : 'confirm-modal-confirm'}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}