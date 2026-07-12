import SigmoButton from '../../../ui/components/SigmoButton'
import Modal from '../../../components/ui/Modal/Modal'

import './MaterialViewModal.css'

export default function MaterialViewModal({
  material,
  onClose,
  onEdit,
  onDelete
}) {
  if (!material) return null

  return (
    <Modal
      open={true}
      title="Detalhes do material"
      onClose={onClose}
    >
      <div className="material-view">
        <div className="material-view-summary">
          <div>
            <span className="material-view-label">
              Patrimônio
            </span>

            <h2>
              {material.patrimonio || 'SEM PATRIMÔNIO'}
            </h2>

            <p>
              {material.descricao || 'Material sem descrição'}
            </p>
          </div>

          <span
            className={`material-view-status ${
              String(material.status || '')
                .toLowerCase()
                .replace(/\s+/g, '-')
            }`}
          >
            {material.status || 'SEM STATUS'}
          </span>
        </div>

        <div className="material-view-grid">
          <div className="material-view-field">
            <span>Categoria</span>
            <strong>{material.categoria || '-'}</strong>
          </div>

          <div className="material-view-field">
            <span>Marca</span>
            <strong>{material.marca || '-'}</strong>
          </div>

          <div className="material-view-field">
            <span>Modelo</span>
            <strong>{material.modelo || '-'}</strong>
          </div>

          <div className="material-view-field">
            <span>Número de série</span>
            <strong>{material.numero_serie || '-'}</strong>
          </div>

          <div className="material-view-field">
            <span>Unidade</span>
            <strong>{material.unidade || '-'}</strong>
          </div>

          <div className="material-view-field">
            <span>Local atual</span>
            <strong>{material.local_atual || '-'}</strong>
          </div>

          <div className="material-view-field material-view-field-full">
            <span>Observações</span>

            <strong>
              {material.observacoes || 'Nenhuma observação registrada.'}
            </strong>
          </div>
        </div>

        <div className="material-view-actions">
          <SigmoButton
            variant="secondary"
            onClick={onClose}
          >
            Fechar
          </SigmoButton>

          <div>
            <SigmoButton
              variant="secondary"
              onClick={onEdit}
            >
              Editar material
            </SigmoButton>

            <SigmoButton
              variant="danger"
              onClick={onDelete}
            >
              Excluir
            </SigmoButton>
          </div>
        </div>
      </div>
    </Modal>
  )
}