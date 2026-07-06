import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import './policialViewModal.css'

export default function PolicialViewModal({
  policial,
  fotos = [],
  onClose,
  onPrintFicha,
  onPrintCredencial
}) {
  const [fotoSelecionada, setFotoSelecionada] = useState(null)

  const fotoPrincipal = useMemo(() => {
    if (!policial) return null

    return (
      fotos.find((foto) => foto.principal) ||
      fotos.find((foto) => foto.url === policial.foto_url) ||
      fotos[0] ||
      (policial.foto_url
        ? {
            id: 'principal-policial',
            url: policial.foto_url,
            principal: true
          }
        : null)
    )
  }, [policial, fotos])

  useEffect(() => {
    setFotoSelecionada(fotoPrincipal)
  }, [fotoPrincipal])

  if (!policial) return null

  const fotoAtual = fotoSelecionada || fotoPrincipal

  const qrValue =
    policial.qr_code ||
    JSON.stringify({
      modulo: 'POLICIAIS',
      id: policial.id,
      nome: policial.nome,
      nome_guerra: policial.nome_guerra,
      re: policial.re
    })

  return (
    <div className="policial-modal-overlay">
      <div className="policial-modal">
        <div className="policial-modal-header">
          <div>
            <span>POLICIAL</span>
            <h2>{policial.nome_guerra || policial.nome}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="policial-modal-close"
          >
            ×
          </button>
        </div>

        <div className="policial-modal-body">
          <aside className="policial-modal-photo-area">
            <div className="policial-main-photo">
              {fotoAtual?.url ? (
                <img src={fotoAtual.url} alt={policial.nome || 'Policial'} />
              ) : (
                <div className="policial-photo-placeholder">
                  SEM FOTO
                </div>
              )}
            </div>

            <div className="policial-modal-photo-caption">
              {fotoAtual?.principal ? 'Foto principal' : 'Foto selecionada'}
            </div>

            <div className="policial-modal-qrcode">
              <strong>QR Code funcional</strong>

              <div className="policial-qrcode-box">
                <QRCodeCanvas
                  value={qrValue}
                  size={150}
                  includeMargin
                />
              </div>
            </div>
          </aside>

          <section className="policial-modal-info">
            <div className="policial-info-grid">
              <Info label="Nome completo" value={policial.nome} />
              <Info label="Nome de guerra" value={policial.nome_guerra} />
              <Info label="RE" value={policial.re} />
              <Info label="Posto/Graduação" value={policial.posto_graduacao} />
              <Info label="Companhia" value={policial.companhia} />
              <Info label="Pelotão" value={policial.pelotao} />
              <Info label="Equipe" value={policial.equipe} />
              <Info label="Função" value={policial.funcao} />
              <Info label="Telefone" value={policial.telefone} />
              <Info label="E-mail" value={policial.email} />
              <Info label="CPF" value={policial.cpf} />
              <Info label="RG" value={policial.rg} />
              <Info label="Perfil" value={policial.perfil} />
              <Info label="Situação" value={policial.situacao} />
            </div>

            <div className="policial-observacoes">
              <strong>Observações</strong>
              <p>{policial.observacoes || 'Nenhuma observação registrada.'}</p>
            </div>

            <div className="policial-gallery">
              <strong>Galeria de fotos</strong>

              {fotos.length > 0 ? (
                <div className="policial-gallery-grid">
                  {fotos.map((foto) => (
                    <button
                      key={foto.id || foto.url}
                      type="button"
                      className={`policial-gallery-item ${
                        fotoSelecionada?.id === foto.id ? 'active' : ''
                      }`}
                      onClick={() => setFotoSelecionada(foto)}
                      title="Visualizar foto"
                    >
                      <img
                        src={foto.url}
                        alt="Foto do policial"
                        loading="lazy"
                      />

                      {foto.principal && (
                        <span>Principal</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p>Nenhuma foto cadastrada.</p>
              )}
            </div>
          </section>
        </div>

        <div className="policial-modal-footer">
          <button
            type="button"
            onClick={onPrintFicha}
            className="btn-secondary"
          >
            Imprimir ficha funcional
          </button>

          <button
            type="button"
            onClick={onPrintCredencial}
            className="btn-secondary"
          >
            Imprimir credencial
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="policial-info-item">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}