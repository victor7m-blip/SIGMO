import { useEffect, useState } from 'react'
import { gerarImagemQrCode } from '../../../services/qrCodeService'

export default function ArmaViewModal({
  arma,
  fotos = [],
  onClose,
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

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-large">
        <div className="modal-header">
          <div>
            <h2>Detalhes da Arma</h2>
            <p>
              {arma.patrimonio || 'Sem patrimônio'} • {arma.marca || '-'} {arma.modelo || ''}
            </p>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="arma-modal-layout">
            <aside className="arma-modal-media">
              <div className="arma-modal-foto-principal">
                {fotoSelecionada?.url || arma.foto_url ? (
                  <img
                    src={fotoSelecionada?.url || arma.foto_url}
                    alt="Foto principal da arma"
                  />
                ) : (
                  <div className="arma-modal-sem-foto">
                    🔫
                    <span>Sem foto</span>
                  </div>
                )}
              </div>

              {fotos.length > 0 && (
                <div className="arma-modal-miniaturas">
                  {fotos.map((foto) => (
                    <button
                      key={foto.id}
                      type="button"
                      className={
                        fotoSelecionada?.id === foto.id
                          ? 'arma-modal-miniatura active'
                          : 'arma-modal-miniatura'
                      }
                      onClick={() => setFotoSelecionada(foto)}
                    >
                      <img src={foto.url} alt="Miniatura da arma" />
                    </button>
                  ))}
                </div>
              )}

              {qrImagem && (
                <div className="arma-modal-qr">
                  <strong>QR Code</strong>
                  <img src={qrImagem} alt="QR Code da arma" />
                  <span>{arma.qr_code}</span>
                </div>
              )}
            </aside>

            <section className="arma-modal-info">
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
                  <span>{arma.status_operacional || '-'}</span>
                </div>

                <div>
                  <strong>QR Code</strong>
                  <span className="arma-modal-code">
                    {arma.qr_code || '-'}
                  </span>
                </div>

                <div className="details-full">
                  <strong>Observações</strong>
                  <span>{arma.observacoes || '-'}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="modal-actions">
          {onPrintFicha && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onPrintFicha(arma)}
            >
              Imprimir ficha
            </button>
          )}

          {onPrintEtiqueta && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onPrintEtiqueta(arma)}
            >
              Imprimir etiqueta
            </button>
          )}

          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}