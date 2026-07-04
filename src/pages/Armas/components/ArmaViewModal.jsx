import { useEffect, useState } from 'react'
import { listarFotosArma } from '../../../services/armasFotosService'

export default function ArmaViewModal({ arma, onClose }) {
  const [fotos, setFotos] = useState([])

  useEffect(() => {
    async function carregarFotos() {
      if (!arma?.id) return

      try {
        const data = await listarFotosArma(arma.id)
        setFotos(data || [])
      } catch (error) {
        console.error('Erro ao carregar fotos da arma:', error)
      }
    }

    carregarFotos()
  }, [arma])

  if (!arma) return null

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-large">
        <div className="modal-header">
          <h2>Detalhes da Arma</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="details-grid">
            <div>
              <strong>Patrimônio</strong>
              <span>{arma.patrimonio || '-'}</span>
            </div>

            <div>
              <strong>Número de Série</strong>
              <span>{arma.numero_serie || '-'}</span>
            </div>

            <div>
              <strong>Espécie</strong>
              <span>{arma.especie || '-'}</span>
            </div>

            <div>
              <strong>Marca</strong>
              <span>{arma.marca || '-'}</span>
            </div>

            <div>
              <strong>Modelo</strong>
              <span>{arma.modelo || '-'}</span>
            </div>

            <div>
              <strong>Calibre</strong>
              <span>{arma.calibre || '-'}</span>
            </div>

            <div>
              <strong>Acabamento</strong>
              <span>{arma.acabamento || '-'}</span>
            </div>

            <div>
              <strong>Unidade</strong>
              <span>{arma.unidade || '-'}</span>
            </div>

            <div>
              <strong>Status</strong>
              <span>{arma.status || '-'}</span>
            </div>

            <div className="details-full">
              <strong>Observações</strong>
              <span>{arma.observacoes || '-'}</span>
            </div>
          </div>

          <div className="arma-fotos-section">
            <h3>Fotos da arma</h3>

            {fotos.length === 0 ? (
              <p className="empty-text">Nenhuma foto cadastrada.</p>
            ) : (
              <div className="arma-fotos-grid">
                {fotos.map((foto) => (
                  <a
                    key={foto.id}
                    href={foto.url}
                    target="_blank"
                    rel="noreferrer"
                    className="arma-foto-card"
                  >
                    <img src={foto.url} alt="Foto da arma" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}