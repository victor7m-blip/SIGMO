import { useEffect, useState } from 'react'
import { gerarImagemQrCode } from '../../../services/qrCodeService'
import './ArmaViewModal.css'

export default function ArmaViewModal({
  arma,
  fotos = [],
  onClose,
  onEdit,
  onDelete,
  onPrintFicha,
  onPrintEtiqueta
}) {
  const [fotoSelecionada, setFotoSelecionada] = useState(null)
  const [qrImagem, setQrImagem] = useState('')

  useEffect(() => {
    const principal = fotos.find((foto) => foto.principal) || fotos[0] || null
    setFotoSelecionada(principal)
  }, [fotos])

  useEffect(() => {
    async function carregarQr() {
      if (!arma?.qr_code) {
        setQrImagem('')
        return
      }

      try {
        const imagem = await gerarImagemQrCode(arma.qr_code)
        setQrImagem(imagem)
      } catch (error) {
        console.error(error)
        setQrImagem('')
      }
    }

    carregarQr()
  }, [arma])

  if (!arma) return null

  const fotoPrincipal = fotoSelecionada?.url || arma.foto_url || ''

  return (
    <div className="arma-view-overlay">
      <div className="arma-view-card">
        <header className="arma-view-header">
          <div>
            <h2>Detalhes da Arma</h2>
            <p>
              {arma.patrimonio || 'Sem patrimônio'} • {arma.marca || '-'} {arma.modelo || ''}
            </p>
          </div>

          <button type="button" className="arma-view-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="arma-view-body">
          <aside className="arma-view-media">
            <div className="arma-view-foto-principal">
              {fotoPrincipal ? (
                <img
                  src={fotoPrincipal}
                  alt="Foto principal da arma"
                />
              ) : (
                <div className="arma-view-sem-foto">
                  🔫
                  <span>Sem foto</span>
                </div>
              )}
            </div>

            {fotos.length > 0 && (
              <div className="arma-view-miniaturas">
                {fotos.map((foto) => (
                  <button
                    key={foto.id}
                    type="button"
                    className={
                      fotoSelecionada?.id === foto.id
                        ? 'arma-view-miniatura active'
                        : 'arma-view-miniatura'
                    }
                    onClick={() => setFotoSelecionada(foto)}
                  >
                    <img src={foto.url} alt="Miniatura da arma" />
                  </button>
                ))}
              </div>
            )}

            {qrImagem && (
              <div className="arma-view-qr">
                <strong>QR Code</strong>
                <img src={qrImagem} alt="QR Code da arma" />
                <span>{arma.qr_code}</span>
              </div>
            )}
          </aside>

          <section className="arma-view-info">
            <div className="arma-view-grid">
              <div><strong>Patrimônio</strong><span>{arma.patrimonio || '-'}</span></div>
              <div><strong>Número de Série</strong><span>{arma.numero_serie || '-'}</span></div>
              <div><strong>Espécie</strong><span>{arma.especie || '-'}</span></div>
              <div><strong>Marca</strong><span>{arma.marca || '-'}</span></div>
              <div><strong>Modelo</strong><span>{arma.modelo || '-'}</span></div>
              <div><strong>Calibre</strong><span>{arma.calibre || '-'}</span></div>
              <div><strong>Acabamento</strong><span>{arma.acabamento || '-'}</span></div>
              <div><strong>Unidade</strong><span>{arma.unidade || '-'}</span></div>
              <div><strong>Status</strong><span>{arma.status_operacional || arma.status || '-'}</span></div>
              <div><strong>QR Code</strong><span>{arma.qr_code || '-'}</span></div>

              <div className="arma-view-full">
                <strong>Observações</strong>
                <span>{arma.observacoes || '-'}</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="arma-view-actions">
          {onPrintFicha && (
            <button type="button" className="btn-secondary" onClick={() => onPrintFicha(arma)}>
              Imprimir ficha
            </button>
          )}

          {onPrintEtiqueta && (
            <button type="button" className="btn-secondary" onClick={() => onPrintEtiqueta(arma)}>
              Imprimir etiqueta
            </button>
          )}

          {onEdit && (
            <button type="button" className="btn-secondary" onClick={() => onEdit(arma)}>
              Editar
            </button>
          )}

          {onDelete && (
            <button type="button" className="btn-danger-small" onClick={() => onDelete(arma)}>
              Excluir
            </button>
          )}

          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}