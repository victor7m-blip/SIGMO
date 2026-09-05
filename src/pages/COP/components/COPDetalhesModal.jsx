import {
  useEffect,
  useMemo,
  useState
} from 'react'

import '../styles/COP.css'

export default function COPDetalhesModal({
  cop,
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
      (cop.foto_url
        ? {
            id: 'foto-principal-cop',
            url: cop.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, cop.foto_url])

  const [
    fotoSelecionada,
    setFotoSelecionada
  ] = useState(fotoPrincipal)

  useEffect(() => {
    setFotoSelecionada(fotoPrincipal)
  }, [fotoPrincipal])

  const fotosDisponiveis =
    fotos.length > 0
      ? fotos
      : fotoPrincipal
        ? [fotoPrincipal]
        : []

  return (
    <div
      className="cop-modal-backdrop"
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
        className="cop-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da COP nº ${
          cop.numero || ''
        }`}
      >
        <header>
          <div>
            <span>
              Câmera Operacional Portátil
            </span>

            <h2>
              COP nº {cop.numero || '—'}
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

        <div className="cop-modal-content">
          <div className="cop-modal-grid">
            <Info
              label="Número da COP"
              value={cop.numero}
            />

            <Info
              label="ID da câmera"
              value={
                cop.identificacao_equipamento
              }
            />

            <Info
              label="Marca"
              value={cop.marca}
            />

            <Info
              label="Status operacional"
              value={formatarStatus(
                cop.status_operacional
              )}
            />

            <Info
              label="Local atual"
              value={cop.local_atual}
            />

            <Info
              label="Situação do cadastro"
              value={
                cop.ativo === false
                  ? 'INATIVA'
                  : 'ATIVA'
              }
            />
          </div>

          <div className="cop-modal-media-grid">
            <div className="cop-modal-media-card cop-modal-gallery-card">
              <span className="cop-modal-media-title">
                Fotos da câmera
              </span>

              {carregandoFotos && (
                <div className="cop-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="cop-gallery-error">
                    {erroFotos}
                  </div>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                fotoSelecionada && (
                  <>
                    <div className="cop-modal-foto-destaque">
                      <img
                        src={fotoSelecionada.url}
                        alt={`Foto da COP nº ${
                          cop.numero || ''
                        }`}
                      />

                      {fotoSelecionada.principal && (
                        <span className="cop-modal-selo-principal">
                          Foto principal
                        </span>
                      )}

                      <button
                        type="button"
                        className="cop-modal-ampliar"
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
                      <div className="cop-modal-thumbnails">
                        {fotosDisponiveis.map(
                          (foto, index) => {
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
                                    ? 'cop-modal-thumbnail is-selected'
                                    : 'cop-modal-thumbnail'
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
                                  } da COP`}
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

                    <small className="cop-gallery-counter">
                      {fotosDisponiveis.length}{' '}
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
                  <div className="cop-gallery-message">
                    Nenhuma foto cadastrada.
                  </div>
                )}
            </div>
          </div>

          <div className="cop-modal-observacoes">
            <strong>
              Observações
            </strong>

            <p>
              {cop.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        <footer>
          <button
            type="button"
            className="cop-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          {onEdit && (
            <button
              type="button"
              className="cop-btn-primary"
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
    <div className="cop-info">
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

function formatarStatus(status) {
  return String(status || '')
    .trim()
    .replaceAll('_', ' ') || '—'
}
