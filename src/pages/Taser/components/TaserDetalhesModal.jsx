import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import '../styles/Taser.css'

export default function TaserDetalhesModal({
  taser,
  fotos = [],
  carregandoFotos = false,
  erroFotos = '',
  onClose,
  onEdit
}) {
  const fotoPrincipal = useMemo(() => {
    return (
      fotos.find(
        (foto) => foto.principal
      ) ||
      fotos[0] ||
      (taser.foto_url
        ? {
            id: 'foto-principal-taser',
            url: taser.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, taser.foto_url])

  const [
    fotoSelecionada,
    setFotoSelecionada
  ] = useState(fotoPrincipal)

  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [zoomFoto, setZoomFoto] = useState(1)

  useEffect(() => {
    setFotoSelecionada(
      fotoPrincipal
    )
  }, [fotoPrincipal])

  useEffect(() => {
    if (!fotoAmpliada) setZoomFoto(1)
  }, [fotoAmpliada])

  function alterarZoom(delta) {
    setZoomFoto((atual) =>
      Math.max(
        0.5,
        Math.min(4, Number((atual + delta).toFixed(2)))
      )
    )
  }

  function handleWheelFoto(event) {
    event.preventDefault()
    alterarZoom(event.deltaY < 0 ? 0.1 : -0.1)
  }

  const fotosDisponiveis =
    fotos.length > 0
      ? fotos
      : fotoPrincipal
        ? [fotoPrincipal]
        : []

  return (
    <div
      className="taser-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <section
        className="taser-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do Taser"
      >
        <header>
          <div>
            <span>
              {taser.tipo_taser ||
                'Taser'}
            </span>

            <h2>
              {taser.patrimonio ||
                taser.numero_serie ||
                'TASER'}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="taser-modal-content">
          <div className="taser-modal-grid">
            <Info label="Patrimônio" value={taser.patrimonio} />
            <Info label="Número de série" value={taser.numero_serie} />
            <Info label="Marca" value={taser.marca} />
            <Info label="Modelo" value={taser.modelo} />
            <Info label="Tipo" value={taser.tipo_taser} />
            <Info label="Unidade" value={taser.unidade} />
            <Info label="Status operacional" value={taser.status_operacional} />
            <Info label="Local atual" value={taser.local_atual} />
            <Info label="Equipe vinculada" value={taser.equipe_vinculada} />
            <Info label="Viatura vinculada" value={taser.viatura_vinculada} />
            <Info
              label="Situação do cadastro"
              value={
                taser.ativo === false
                  ? 'INATIVO'
                  : 'ATIVO'
              }
            />
          </div>

          <div className="taser-modal-media-grid">
            {taser.qr_code && (
              <div className="taser-modal-media-card">
                <span className="taser-modal-media-title">
                  QR Code
                </span>

                <div className="taser-modal-qr-box">
                  <QRCodeCanvas
                    value={taser.qr_code}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>

                <strong>
                  {taser.numero_serie ||
                    taser.patrimonio}
                </strong>
              </div>
            )}

            <div className="taser-modal-media-card taser-modal-gallery-card">
              <span className="taser-modal-media-title">
                Fotos do equipamento
              </span>

              {carregandoFotos && (
                <div className="taser-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="taser-gallery-error">
                    {erroFotos}
                  </div>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                fotoSelecionada && (
                  <>
                    <button
                      type="button"
                      className="taser-modal-photo-button"
                      onClick={() => setFotoAmpliada(fotoSelecionada)}
                      title="Clique para ampliar a foto"
                      aria-label="Ampliar foto do Taser"
                    >
                      <img
                        src={fotoSelecionada.url}
                        alt={
                          taser.patrimonio ||
                          taser.numero_serie ||
                          'Taser'
                        }
                        className="taser-modal-photo"
                      />
                    </button>

                    {fotosDisponiveis.length > 1 && (
                      <div className="taser-modal-thumbnails">
                        {fotosDisponiveis.map(
                          (
                            foto,
                            index
                          ) => {
                            const selecionada =
                              fotoSelecionada?.id === foto.id ||
                              fotoSelecionada?.url === foto.url

                            return (
                              <button
                                key={
                                  foto.id ||
                                  `${foto.url}-${index}`
                                }
                                type="button"
                                className={
                                  selecionada
                                    ? 'taser-modal-thumbnail is-selected'
                                    : 'taser-modal-thumbnail'
                                }
                                onClick={() =>
                                  setFotoSelecionada(foto)
                                }
                                aria-label={`Visualizar foto ${index + 1}`}
                              >
                                <img
                                  src={foto.url}
                                  alt={`Miniatura ${index + 1} do Taser`}
                                />

                                {foto.principal && (
                                  <span>
                                    Principal
                                  </span>
                                )}
                              </button>
                            )
                          }
                        )}
                      </div>
                    )}

                    <small className="taser-gallery-counter">
                      {fotosDisponiveis.length}{' '}
                      {fotosDisponiveis.length === 1
                        ? 'foto cadastrada'
                        : 'fotos cadastradas'}
                    </small>
                  </>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                !fotoSelecionada && (
                  <div className="taser-gallery-message">
                    Nenhuma foto cadastrada.
                  </div>
                )}
            </div>
          </div>

          <div className="taser-modal-observacoes">
            <strong>
              Observações
            </strong>

            <p>
              {taser.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        {fotoAmpliada && (
          <div
            className="taser-photo-lightbox"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setFotoAmpliada(null)
              }
            }}
          >
            <section
              className="taser-photo-lightbox-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Foto ampliada do Taser"
            >
              <header>
                <div>
                  <span>Foto cadastral do Taser</span>
                  <h3>{taser.patrimonio || taser.numero_serie || 'Taser'}</h3>
                  <small>Use a roda do mouse para ampliar ou reduzir.</small>
                </div>

                <button
                  type="button"
                  onClick={() => setFotoAmpliada(null)}
                  aria-label="Fechar foto ampliada"
                >
                  ×
                </button>
              </header>

              <div
                className="taser-photo-lightbox-stage"
                onWheel={handleWheelFoto}
              >
                <img
                  src={fotoAmpliada.url}
                  alt={`Foto ampliada do Taser ${
                    taser.patrimonio || taser.numero_serie || ''
                  }`}
                  style={{
                    transform: `scale(${zoomFoto})`
                  }}
                />
              </div>

              <footer>
                <button
                  type="button"
                  className="taser-btn-secondary"
                  onClick={() => alterarZoom(-0.1)}
                >
                  −
                </button>
                <strong>{Math.round(zoomFoto * 100)}%</strong>
                <button
                  type="button"
                  className="taser-btn-secondary"
                  onClick={() => alterarZoom(0.1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="taser-btn-secondary"
                  onClick={() => setZoomFoto(1)}
                >
                  100%
                </button>
                <button
                  type="button"
                  className="taser-btn-primary taser-photo-lightbox-close"
                  onClick={() => setFotoAmpliada(null)}
                >
                  Fechar
                </button>
              </footer>
            </section>
          </div>
        )}

        <footer>
          <button
            type="button"
            className="taser-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          {onEdit && (
            <button
              type="button"
              className="taser-btn-primary"
              onClick={onEdit}
            >
              Editar
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}

function Info({
  label,
  value
}) {
  return (
    <div className="taser-info">
      <span>
        {label}
      </span>

      <strong>
        {value === null ||
        value === undefined ||
        value === ''
          ? '—'
          : value}
      </strong>
    </div>
  )
}
