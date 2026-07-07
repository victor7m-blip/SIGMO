import SigmoButton from '../../../ui/components/SigmoButton'
import Modal from '../../../components/ui/Modal/Modal'

export default function MaterialViewModal({
  material,
  onClose,
  onEdit,
  onDelete
}) {
  if (!material) return null

  return (
    <Modal onClose={onClose}>
      <div className="material-view">
        <div className="view-header">
          <div>
            <h2>{material.descricao || 'Material'}</h2>
            <p>{material.patrimonio || 'Sem patrimônio'}</p>
          </div>

          <div className="view-actions">
            <SigmoButton variant="secondary" onClick={onEdit}>
              Editar
            </SigmoButton>

            <SigmoButton variant="danger" onClick={onDelete}>
              Excluir
            </SigmoButton>
          </div>
        </div>

        <div className="view-grid">
          <div><strong>Categoria:</strong> {material.categoria || '-'}</div>
          <div><strong>Marca:</strong> {material.marca || '-'}</div>
          <div><strong>Modelo:</strong> {material.modelo || '-'}</div>
          <div><strong>Nº de série:</strong> {material.numero_serie || '-'}</div>
          <div><strong>Status:</strong> {material.status || '-'}</div>
          <div><strong>Unidade:</strong> {material.unidade || '-'}</div>
          <div><strong>Local atual:</strong> {material.local_atual || '-'}</div>
          <div className="full">
            <strong>Observações:</strong> {material.observacoes || '-'}
          </div>
        </div>
      </div>
    </Modal>
  )
}