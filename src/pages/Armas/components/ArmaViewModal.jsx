import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import './ArmaViewModal.css'

export default function ArmaViewModal({
  arma,
  fotos = [],
  carregandoFotos = false,
  erroFotos = '',
  onClose,
  onEdit,
  onDelete,
  onPrintFicha,
  onPrintEtiqueta,
  onAbrirPolicial
}) {
  const fotoPrincipal = useMemo(() => {
    return (
      fotos.find((foto) => foto.principal) ||
      fotos[0] ||
      (arma?.foto_url
        ? {
            id: 'foto-principal-arma',
            url: arma.foto_url,
            principal: true
          }
        : null)
    )
  }, [arma?.foto_url, fotos])

  const [fotoSelecionada, setFotoSelecionada] = useState(fotoPrincipal)

  useEffect(() => {
    setFotoSelecionada(fotoPrincipal)
  }, [fotoPrincipal])

  if (!arma) return null

  const fotosDisponiveis =
    fotos.length > 0
      ? fotos
      : fotoPrincipal
        ? [fotoPrincipal]
        : []

  const statusAtual = String(
    arma.status_patrimonial ||
      arma.status_operacional ||
      arma.status ||
      ''
  ).toUpperCase()

  const ehCarga =
    statusAtual === 'CARGA' ||
    statusAtual.includes('CARGA PERMANENTE')

  const ehCautela =
    statusAtual.includes('CAUTELA') ||
    statusAtual.includes('CAUTELADO')

  const responsavelNome =
    arma.responsavel_atual_nome ||
    arma.carga_policial_nome ||
    arma.responsavel_nome ||
    arma.proprietario_nome ||
    arma.proprietario_policial_nome ||
    ''

  const responsavelRe =
    arma.carga_policial_re ||
    arma.responsavel_re ||
    arma.proprietario_re ||
    arma.proprietario_policial_re ||
    ''

  const dataVinculo = arma.vinculo_patrimonial_em

  function formatarDataHora(valor) {
    if (!valor) return '-'

    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) return '-'

    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div
      className="arma-view-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section
        className="arma-view-card"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da arma"
      >
        <header className="arma-view-header">
          <div>
            <span>{arma.propriedade || 'PMESP'}</span>
            <h2>
              {arma.patrimonio ||
                arma.numero_serie ||
                'Arma'}
            </h2>
          </div>

          <button
            type="button"
            className="arma-view-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="arma-view-content">
          <div className="arma-view-grid">
            <Info label="Patrimônio" value={arma.patrimonio} />
            <Info label="Número de série" value={arma.numero_serie} />
            <Info label="Espécie" value={arma.especie} />
            <Info label="Marca" value={arma.marca} />
            <Info label="Modelo" value={arma.modelo} />
            <Info label="Calibre" value={arma.calibre} />
            <Info label="Acabamento" value={arma.acabamento} />
            <Info label="Unidade" value={arma.unidade} />
            <Info
              label="Status operacional"
              value={arma.status_operacional || arma.status}
            />

            {arma.propriedade === 'PARTICULAR' && (
              <>
                <Info label="Número SIGMA" value={arma.numero_sigma} />
                <Info
                  label="Número do registro"
                  value={arma.numero_registro || arma.registro}
                />
                <Info
                  label="Validade do registro"
                  value={arma.validade_registro || arma.validade}
                />
                <Info
                  label="Comprimento do cano"
                  value={arma.comprimento_cano}
                />
                <Info label="Capacidade" value={arma.capacidade} />
                <Info
                  label="País de fabricação"
                  value={arma.pais_fabricacao}
                />
                <Info
                  label="Ano de fabricação"
                  value={arma.ano_fabricacao}
                />
                <Info
                  label="Proprietário"
                  value={
                    arma.proprietario_nome ||
                    arma.proprietario_policial_nome
                  }
                />
                <Info
                  label="RE do proprietário"
                  value={
                    arma.proprietario_re ||
                    arma.proprietario_policial_re
                  }
                />
                <Info
                  label="Situação documental"
                  value={arma.situacao_documental}
                />
              </>
            )}
          </div>

          {(ehCarga || ehCautela || responsavelNome) && (
            <section className="arma-view-vinculo">
              <div className="arma-view-vinculo-header">
                <span>Situação patrimonial</span>
                <strong>{ehCarga ? 'Carga permanente' : ehCautela ? 'Cautela ativa' : 'Responsabilidade atual'}</strong>
              </div>

              <div className="arma-view-vinculo-grid">
                <InfoLink
                  label="Policial responsável"
                  value={responsavelNome || 'Sem responsável informado'}
                  disabled={!responsavelRe || !onAbrirPolicial}
                  onClick={() => onAbrirPolicial?.(responsavelRe)}
                />
                <InfoLink
                  label="RE"
                  value={responsavelRe ? `RE ${responsavelRe}` : 'Não informado'}
                  disabled={!responsavelRe || !onAbrirPolicial}
                  onClick={() => onAbrirPolicial?.(responsavelRe)}
                />
                <Info
                  label={ehCarga ? 'Carga paga em' : ehCautela ? 'Cautela paga em' : 'Vínculo registrado em'}
                  value={formatarDataHora(dataVinculo)}
                />
                <Info
                  label="Local atual"
                  value={arma.local_atual || arma.unidade || '-'}
                />
              </div>
            </section>
          )}

          <div className="arma-view-media-grid">
            <div className="arma-view-media-card arma-view-qr-card">
              <span className="arma-view-media-title">QR Code patrimonial</span>

              {arma.qr_code ? (
                <>
                  <div className="arma-view-qr-box">
                    <QRCodeCanvas
                      value={arma.qr_code}
                      size={190}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <strong>{arma.qr_code}</strong>
                  <small>Use este código para localizar a arma no SIGMO.</small>
                </>
              ) : (
                <div className="arma-view-message">
                  Esta arma ainda não possui QR Code cadastrado.
                </div>
              )}
            </div>

            <div className="arma-view-media-card arma-view-gallery-card">
              <span className="arma-view-media-title">Fotos da arma</span>

              {carregandoFotos && (
                <div className="arma-view-message">Carregando fotos...</div>
              )}

              {!carregandoFotos && erroFotos && (
                <div className="arma-view-error">{erroFotos}</div>
              )}

              {!carregandoFotos && !erroFotos && fotoSelecionada && (
                <>
                  <div className="arma-view-photo-wrap">
                    <img
                      src={fotoSelecionada.url}
                      alt={`Foto da arma ${
                        arma.patrimonio || arma.numero_serie || ''
                      }`}
                      className="arma-view-photo"
                    />

                    {fotoSelecionada.principal && (
                      <span className="arma-view-principal-badge">
                        Principal
                      </span>
                    )}

                    <button
                      type="button"
                      className="arma-view-ampliar"
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

                  {fotosDisponiveis.length > 1 && (
                    <div className="arma-view-thumbnails">
                      {fotosDisponiveis.map((foto, index) => {
                        const selecionada =
                          fotoSelecionada?.id === foto.id ||
                          fotoSelecionada?.url === foto.url

                        return (
                          <button
                            key={foto.id || `${foto.url}-${index}`}
                            type="button"
                            className={
                              selecionada
                                ? 'arma-view-thumbnail is-selected'
                                : 'arma-view-thumbnail'
                            }
                            onClick={() => setFotoSelecionada(foto)}
                            aria-label={`Visualizar foto ${index + 1}`}
                          >
                            <img
                              src={foto.url}
                              alt={`Miniatura ${index + 1} da arma`}
                            />

                            {foto.principal && <span>Principal</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <small className="arma-view-gallery-counter">
                    {fotosDisponiveis.length}{' '}
                    {fotosDisponiveis.length === 1
                      ? 'foto cadastrada'
                      : 'fotos cadastradas'}
                  </small>
                </>
              )}

              {!carregandoFotos && !erroFotos && !fotoSelecionada && (
                <div className="arma-view-message">
                  Nenhuma foto cadastrada.
                </div>
              )}
            </div>
          </div>

          <div className="arma-view-observacoes">
            <strong>Observações</strong>
            <p>{arma.observacoes || 'Sem observações.'}</p>
          </div>
        </div>

        <footer className="arma-view-actions">
          <div className="arma-view-actions-left">
            {onPrintFicha && (
              <button
                type="button"
                className="armas-btn-secondary"
                onClick={() => onPrintFicha(arma)}
              >
                Imprimir ficha
              </button>
            )}

            {onPrintEtiqueta && (
              <button
                type="button"
                className="armas-btn-secondary"
                onClick={() => onPrintEtiqueta(arma)}
              >
                Imprimir etiqueta
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="btn-danger-small"
                onClick={() => onDelete(arma)}
              >
                Excluir
              </button>
            )}
          </div>

          <div className="arma-view-actions-right">
            <button
              type="button"
              className="armas-btn-secondary"
              onClick={onClose}
            >
              Fechar
            </button>

            {onEdit && (
              <button
                type="button"
                className="armas-btn-primary"
                onClick={() => onEdit(arma)}
              >
                Editar
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="arma-view-info">
      <span>{label}</span>
      <strong>
        {value === null || value === undefined || value === '' ? '—' : value}
      </strong>
    </div>
  )
}

function InfoLink({ label, value, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`arma-view-info arma-view-info-link${disabled ? ' is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? '' : 'Abrir cadastro do policial'}
    >
      <span>{label}</span>
      <strong>{value || '—'}</strong>
      {!disabled && <small>Ver cadastro do policial →</small>}
    </button>
  )
}
