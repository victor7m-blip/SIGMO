import { useEffect, useState } from 'react'
import { supabase } from '../../../services/supabase'

export default function ArmaViewModal({ arma, onClose }) {
  const [fotos, setFotos] = useState([])
  const [loadingFotos, setLoadingFotos] = useState(false)

  useEffect(() => {
    if (arma?.id) {
      carregarFotos()
    }
  }, [arma])

  async function carregarFotos() {
    setLoadingFotos(true)

    const { data, error } = await supabase
      .from('sigmo_armas_fotos')
      .select('*')
      .eq('arma_id', arma.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar fotos da arma:', error)
      setFotos([])
    } else {
      setFotos(data || [])
    }

    setLoadingFotos(false)
  }

  if (!arma) return null

 console.log('ARMA RECEBIDA:', arma) 

  return (
    <div className="modal-backdrop">
      <div className="modal-card arma-view-modal">
        <div className="modal-header">
          <div>
            <h2>Detalhes da arma</h2>
            <p>Visualização completa do cadastro</p>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="arma-view-grid">
          <Info label="Patrimônio" value={arma.patrimonio} />
          <Info label="Número de série" value={arma.numero_serie} />
          <Info label="Espécie" value={arma.especie} />
          <Info label="Marca" value={arma.marca} />
          <Info label="Modelo" value={arma.modelo} />
          <Info label="Calibre" value={arma.calibre} />
          <Info label="Acabamento" value={arma.acabamento} />
          <Info label="Unidade" value={arma.unidade} />
          <Info label="Status" value={arma.status} />
        </div>

        <div className="arma-view-section">
          <h3>Observações</h3>
          <p className="arma-view-observacoes">
            {arma.observacoes || 'Nenhuma observação registrada.'}
          </p>
        </div>

        <div className="arma-view-section">
          <h3>Fotos</h3>

          {loadingFotos && <p>Carregando fotos...</p>}

          {!loadingFotos && fotos.length === 0 && (
            <p>Nenhuma foto cadastrada para esta arma.</p>
          )}

          {!loadingFotos && fotos.length > 0 && (
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

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="arma-view-info">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}