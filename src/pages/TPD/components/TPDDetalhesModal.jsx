import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import '../styles/TPD.css'

export default function TPDDetalhesModal({
  tpd,
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
      (tpd.foto_url
        ? {
            id: 'foto-principal-tpd',
            url: tpd.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, tpd.foto_url])

  const [
    fotoSelecionada,
    setFotoSelecionada
  ] = useState(fotoPrincipal)

  useEffect(() => {
    setFotoSelecionada(
      fotoPrincipal
    )
  }, [fotoPrincipal])

  const fotosDisponiveis =
    fotos.length > 0
      ? fotos
      : fotoPrincipal
        ? [fotoPrincipal]
        : []

  return (
    <div
      className="tpd-modal-backdrop"
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
        className="tpd-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do TPD"
      >
        <header>
          <div>
            <span>
              {tpd.tipo_equipamento ||
                'TPD'}
            </span>

            <h2>
              {tpd.patrimonio ||
                tpd.numero_serie ||
                'Terminal Portátil de Dados'}
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

        <div className="tpd-modal-content">
          <div className="tpd-modal-grid">
            <Info
              label="Patrimônio"
              value={tpd.patrimonio}
            />

            <Info
              label="Número de série"
              value={tpd.numero_serie}
            />

            <Info
              label="Marca"
              value={tpd.marca}
            />

            <Info
              label="Modelo"
              value={tpd.modelo}
            />

            <Info
              label="Tipo de equipamento"
              value={
                tpd.tipo_equipamento
              }
            />

            <Info
              label="Unidade"
              value={tpd.unidade}
            />

            <Info
              label="Status operacional"
              value={
                tpd.status_operacional
              }
            />

            <Info
              label="Local atual"
              value={tpd.local_atual}
            />

            <Info
              label="Equipe vinculada"
              value={
                tpd.equipe_vinculada
              }
            />

            <Info
              label="Viatura vinculada"
              value={
                tpd.viatura_vinculada
              }
            />

            <Info
              label="Situação do cadastro"
              value={
                tpd.ativo === false
                  ? 'INATIVO'
                  : 'ATIVO'
              }
            />
          </div>

          <div className="tpd-modal-media-grid">
            {tpd.qr_code && (
              <div className="tpd-modal-media-card">
                <span className="tpd-modal-media-title">
                  QR Code
                </span>

                <div className="tpd-modal-qr-box">
                  <QRCodeCanvas
                    value={tpd.qr_code}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>

                <strong>
                  {tpd.numero_serie ||
                    tpd.patrimonio}
                </strong>
              </div>
            )}

            <div className="tpd-modal-media-card tpd-modal-gallery-card">
              <span className="tpd-modal-media-title">
                Fotos do equipamento
              </span>

              {carregandoFotos && (
                <div className="tpd-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="tpd-gallery-error">
                    {erroFotos}
                  </div>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                fotoSelecionada && (
                  <>
                    <div className="tpd-modal-foto-destaque">
  <img
    src={fotoSelecionada.url}
    alt={`Foto do TPD ${
      tpd.patrimonio ||
      tpd.numero_serie ||
      ''
    }`}
  />

  {fotoSelecionada.principal && (
    <span className="tpd-modal-selo-principal">
      Foto principal
    </span>
  )}

  <button
    type="button"
    className="tpd-modal-ampliar"
    onClick={() =>
      window.open(
        fotoSelecionada.url,
        '_blank',
        'noopener,noreferrer'
      )
    }
  >
    Ampliar
  </button>
</div>

                    {fotosDisponiveis.length >
                      1 && (
                      <div className="tpd-modal-thumbnails">
                        {fotosDisponiveis.map(
                          (
                            foto,
                            index
                          ) => {
                            const selecionada =
                              fotoSelecionada?.id ===
                                foto.id ||
                              fotoSelecionada?.url ===
                                foto.url

                            return (
                              <button
                                key={
                                  foto.id ||
                                  `${foto.url}-${index}`
                                }
                                type="button"
                                className={
                                  selecionada
                                    ? 'tpd-modal-thumbnail is-selected'
                                    : 'tpd-modal-thumbnail'
                                }
                                onClick={() =>
                                  setFotoSelecionada(
                                    foto
                                  )
                                }
                                aria-label={`Visualizar foto ${
                                  index + 1
                                }`}
                              >
                                <img
                                  src={foto.url}
                                  alt={`Miniatura ${
                                    index + 1
                                  } do TPD`}
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

                    <small className="tpd-gallery-counter">
                      {
                        fotosDisponiveis.length
                      }{' '}
                      {fotosDisponiveis.length ===
                      1
                        ? 'foto cadastrada'
                        : 'fotos cadastradas'}
                    </small>
                  </>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                !fotoSelecionada && (
                  <div className="tpd-gallery-message">
                    Nenhuma foto
                    cadastrada.
                  </div>
                )}
            </div>
          </div>

          <div className="tpd-modal-observacoes">
            <strong>
              Observações
            </strong>

            <p>
              {tpd.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        <footer>
          <button
            type="button"
            className="tpd-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          {onEdit && (
            <button
              type="button"
              className="tpd-btn-primary"
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
    <div className="tpd-info">
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
