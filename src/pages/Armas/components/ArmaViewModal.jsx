import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  listarFotosManutencao,
  listarManutencoes
} from '../../../services/manutencoesService'

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

  const [historicoManutencoes, setHistoricoManutencoes] = useState([])
  const [fotosHistorico, setFotosHistorico] = useState({})
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState('')
  const [fotoManutencaoAmpliada, setFotoManutencaoAmpliada] = useState(null)
  const [zoomFotoManutencao, setZoomFotoManutencao] = useState(1)
  const [fotoCadastroAmpliada, setFotoCadastroAmpliada] = useState(null)
  const [zoomFotoCadastro, setZoomFotoCadastro] = useState(1)

  useEffect(() => {
    setFotoSelecionada(fotoPrincipal)
  }, [fotoPrincipal])

  useEffect(() => {
    if (!fotoCadastroAmpliada && !fotoManutencaoAmpliada) {
      return undefined
    }

    const overflowAnterior =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow =
        overflowAnterior
    }
  }, [
    fotoCadastroAmpliada,
    fotoManutencaoAmpliada
  ])

  useEffect(() => {
    if (!fotoCadastroAmpliada) {
      setZoomFotoCadastro(1)
    }
  }, [fotoCadastroAmpliada])

  useEffect(() => {
    if (!fotoManutencaoAmpliada) {
      setZoomFotoManutencao(1)
    }
  }, [fotoManutencaoAmpliada])

  useEffect(() => {
    let ativo = true

    async function carregarHistoricoManutencoes() {
      if (!arma?.id) {
        if (ativo) {
          setHistoricoManutencoes([])
          setFotosHistorico({})
          setErroHistorico('')
          setLoadingHistorico(false)
        }
        return
      }

      try {
        setLoadingHistorico(true)
        setErroHistorico('')

        const resultado = await listarManutencoes({
          modulo: 'ARMAS',
          status: null,
          referenciaId: arma.id,
          pagina: 1,
          limite: 100
        })

        const manutencoes = resultado?.data || []

        if (!ativo) return

        setHistoricoManutencoes(manutencoes)

        const paresFotos = await Promise.all(
          manutencoes.map(async (manutencao) => {
            try {
              const listaFotos =
                await listarFotosManutencao(manutencao.id)

              return [
                manutencao.id,
                listaFotos || []
              ]
            } catch (error) {
              console.warn(
                'Não foi possível carregar as fotos da manutenção da arma:',
                error
              )

              return [
                manutencao.id,
                []
              ]
            }
          })
        )

        if (ativo) {
          setFotosHistorico(
            Object.fromEntries(paresFotos)
          )
        }
      } catch (error) {
        console.error(
          'Erro ao carregar histórico de manutenções da arma:',
          error
        )

        if (ativo) {
          setHistoricoManutencoes([])
          setFotosHistorico({})
          setErroHistorico(
            error?.message ||
            'Não foi possível carregar o histórico de manutenções.'
          )
        }
      } finally {
        if (ativo) {
          setLoadingHistorico(false)
        }
      }
    }

    carregarHistoricoManutencoes()

    return () => {
      ativo = false
    }
  }, [arma?.id])

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

  function statusManutencaoLabel(status) {
    const valor = String(status || '')
      .trim()
      .toUpperCase()

    if (valor === 'EM_MANUTENCAO') {
      return 'EM MANUTENÇÃO'
    }

    if (valor === 'CONCLUIDA') {
      return 'CONCLUÍDA'
    }

    if (valor === 'CANCELADA') {
      return 'CANCELADA'
    }

    return valor.replaceAll('_', ' ') || 'SEM STATUS'
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
                    <button
                      type="button"
                      onClick={() =>
                        setFotoCadastroAmpliada(
                          fotoSelecionada
                        )
                      }
                      title="Clique para ampliar a foto"
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: 0,
                        border: 0,
                        background: 'transparent',
                        cursor: 'zoom-in'
                      }}
                    >
                      <img
                        src={fotoSelecionada.url}
                        alt={`Foto da arma ${
                          arma.patrimonio || arma.numero_serie || ''
                        }`}
                        className="arma-view-photo"
                      />
                    </button>

                    {fotoSelecionada.principal && (
                      <span className="arma-view-principal-badge">
                        Principal
                      </span>
                    )}

                    <button
                      type="button"
                      className="arma-view-ampliar"
                      onClick={() =>
                        setFotoCadastroAmpliada(
                          fotoSelecionada
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

          <section
            style={{
              marginTop: '18px',
              border: '1px solid #cbd5e1',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#fff'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: '#eff6ff',
                borderBottom: '1px solid #cbd5e1'
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '.08em',
                    color: '#1d4ed8'
                  }}
                >
                  HISTÓRICO PERMANENTE
                </span>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '3px'
                  }}
                >
                  Manutenções da arma
                </strong>
              </div>

              <strong
                style={{
                  minWidth: '36px',
                  textAlign: 'center',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  background: '#dbeafe',
                  color: '#1e40af'
                }}
              >
                {historicoManutencoes.length}
              </strong>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {loadingHistorico && (
                <div className="arma-view-message">
                  Carregando histórico de manutenções...
                </div>
              )}

              {!loadingHistorico && erroHistorico && (
                <div className="arma-view-error">
                  {erroHistorico}
                </div>
              )}

              {!loadingHistorico &&
                !erroHistorico &&
                historicoManutencoes.length === 0 && (
                  <div className="arma-view-message">
                    Esta arma ainda não possui manutenções registradas.
                  </div>
                )}

              {!loadingHistorico &&
                !erroHistorico &&
                historicoManutencoes.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gap: '12px'
                    }}
                  >
                    {historicoManutencoes.map(
                      (manutencao, index) => {
                        const fotosManutencao =
                          fotosHistorico[manutencao.id] || []

                        return (
                          <article
                            key={manutencao.id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              padding: '12px',
                              background: '#f8fafc'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '12px'
                              }}
                            >
                              <div>
                                <small
                                  style={{
                                    display: 'block',
                                    color: '#64748b',
                                    marginBottom: '3px'
                                  }}
                                >
                                  Manutenção #{historicoManutencoes.length - index}
                                </small>

                                <strong>
                                  {String(
                                    manutencao.tipo_novidade ||
                                    manutencao.tipo_material ||
                                    'MANUTENÇÃO'
                                  ).replaceAll('_', ' ')}
                                </strong>
                              </div>

                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '5px 8px',
                                  borderRadius: '999px',
                                  background:
                                    manutencao.status === 'CONCLUIDA'
                                      ? '#dcfce7'
                                      : manutencao.status === 'CANCELADA'
                                        ? '#fee2e2'
                                        : '#ffedd5',
                                  color:
                                    manutencao.status === 'CONCLUIDA'
                                      ? '#166534'
                                      : manutencao.status === 'CANCELADA'
                                        ? '#991b1b'
                                        : '#9a3412'
                                }}
                              >
                                {statusManutencaoLabel(
                                  manutencao.status
                                )}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '8px',
                                marginTop: '10px',
                                fontSize: '12px'
                              }}
                            >
                              <span>
                                Entrada:{' '}
                                <strong>
                                  {formatarDataHora(
                                    manutencao.registrada_em ||
                                    manutencao.created_at
                                  )}
                                </strong>
                              </span>

                              <span>
                                Conclusão:{' '}
                                <strong>
                                  {formatarDataHora(
                                    manutencao.concluida_em
                                  )}
                                </strong>
                              </span>

                              <span>
                                Registrada por:{' '}
                                <strong>
                                  {manutencao.registrada_por_nome ||
                                    'SIGMO'}
                                </strong>
                              </span>

                              <span>
                                Concluída por:{' '}
                                <strong>
                                  {manutencao.concluida_por_nome ||
                                    '—'}
                                </strong>
                              </span>
                            </div>

                            <div
                              style={{
                                marginTop: '10px',
                                fontSize: '13px',
                                lineHeight: 1.5
                              }}
                            >
                              <p style={{ margin: 0 }}>
                                <strong>Ocorrência:</strong>{' '}
                                {manutencao.descricao ||
                                  'Não informada.'}
                              </p>

                              <p
                                style={{
                                  margin: '5px 0 0'
                                }}
                              >
                                <strong>Observações:</strong>{' '}
                                {manutencao.observacoes ||
                                  'Sem observações.'}
                              </p>
                            </div>

                            {fotosManutencao.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '8px',
                                  flexWrap: 'wrap',
                                  marginTop: '10px'
                                }}
                              >
                                {fotosManutencao.map(
                                  (foto) => (
                                    <button
                                      key={foto.id}
                                      type="button"
                                      onClick={() =>
                                        setFotoManutencaoAmpliada({
                                          ...foto,
                                          manutencao
                                        })
                                      }
                                      title={
                                        foto.legenda ||
                                        'Visualizar foto da manutenção'
                                      }
                                      style={{
                                        padding: 0,
                                        border: 0,
                                        background: 'transparent',
                                        cursor: 'zoom-in'
                                      }}
                                    >
                                      <img
                                        src={foto.foto_url}
                                        alt="Registro da manutenção"
                                        style={{
                                          width: '72px',
                                          height: '72px',
                                          objectFit: 'cover',
                                          borderRadius: '9px',
                                          border:
                                            '1px solid #cbd5e1',
                                          display: 'block'
                                        }}
                                      />
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </article>
                        )
                      }
                    )}
                  </div>
                )}
            </div>
          </section>

          <div className="arma-view-observacoes">
            <strong>Observações</strong>
            <p>{arma.observacoes || 'Sem observações.'}</p>
          </div>
        </div>

        {fotoCadastroAmpliada && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setFotoCadastroAmpliada(null)
              }
            }}
            onWheel={(event) => {
              event.preventDefault()
              event.stopPropagation()

              const delta =
                event.deltaY < 0 ? 0.15 : -0.15

              setZoomFotoCadastro((atual) =>
                Math.min(
                  3,
                  Math.max(
                    0.6,
                    Number(
                      (atual + delta).toFixed(2)
                    )
                  )
                )
              )
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              background:
                'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 64, 175, 0.88) 48%, rgba(14, 116, 144, 0.88) 100%)',
              overscrollBehavior: 'contain'
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Foto ampliada da arma"
              style={{
                width: 'min(1080px, 96vw)',
                maxHeight: '94vh',
                overflow: 'hidden',
                borderRadius: '18px',
                background: '#ffffff',
                boxShadow:
                  '0 28px 90px rgba(15, 23, 42, .45)',
                border: '1px solid rgba(255,255,255,.35)'
              }}
            >
              <header
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px 18px',
                  color: '#fff',
                  background:
                    'linear-gradient(135deg, #0f3b82 0%, #1d4ed8 52%, #0e7490 100%)'
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '.08em',
                      opacity: .85
                    }}
                  >
                    FOTO CADASTRAL DA ARMA
                  </span>

                  <strong
                    style={{
                      display: 'block',
                      marginTop: '4px',
                      fontSize: '17px'
                    }}
                  >
                    {arma.patrimonio ||
                      arma.numero_serie ||
                      'ARMA'}
                  </strong>

                  <small
                    style={{
                      display: 'block',
                      marginTop: '3px',
                      opacity: .85
                    }}
                  >
                    Use a roda do mouse para ampliar ou reduzir.
                  </small>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFotoCadastroAmpliada(null)
                  }
                  aria-label="Fechar foto"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border:
                      '1px solid rgba(255,255,255,.45)',
                    background:
                      'rgba(255,255,255,.14)',
                    color: '#fff',
                    fontSize: '24px',
                    lineHeight: 1,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </header>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '420px',
                  maxHeight: 'calc(94vh - 88px)',
                  background:
                    'radial-gradient(circle at top, #eff6ff 0%, #dbeafe 45%, #cbd5e1 100%)'
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '22px',
                    overscrollBehavior: 'contain'
                  }}
                >
                  <img
                    src={fotoCadastroAmpliada.url}
                    alt="Foto ampliada da arma"
                    draggable="false"
                    style={{
                      display: 'block',
                      maxWidth: zoomFotoCadastro <= 1
                        ? '100%'
                        : 'none',
                      maxHeight: zoomFotoCadastro <= 1
                        ? '68vh'
                        : 'none',
                      width:
                        zoomFotoCadastro > 1
                          ? `${zoomFotoCadastro * 100}%`
                          : 'auto',
                      transformOrigin: 'center center',
                      objectFit: 'contain',
                      borderRadius: '12px',
                      boxShadow:
                        '0 10px 32px rgba(15, 23, 42, .22)',
                      userSelect: 'none'
                    }}
                  />
                </div>

                <footer
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderTop:
                      '1px solid rgba(148,163,184,.55)',
                    background:
                      'rgba(255,255,255,.92)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <button
                      type="button"
                      className="armas-btn-secondary"
                      onClick={() =>
                        setZoomFotoCadastro((atual) =>
                          Math.max(
                            0.6,
                            Number(
                              (atual - 0.2).toFixed(2)
                            )
                          )
                        )
                      }
                    >
                      −
                    </button>

                    <strong
                      style={{
                        minWidth: '64px',
                        textAlign: 'center'
                      }}
                    >
                      {Math.round(
                        zoomFotoCadastro * 100
                      )}%
                    </strong>

                    <button
                      type="button"
                      className="armas-btn-secondary"
                      onClick={() =>
                        setZoomFotoCadastro((atual) =>
                          Math.min(
                            3,
                            Number(
                              (atual + 0.2).toFixed(2)
                            )
                          )
                        )
                      }
                    >
                      +
                    </button>

                    <button
                      type="button"
                      className="armas-btn-secondary"
                      onClick={() =>
                        setZoomFotoCadastro(1)
                      }
                    >
                      100%
                    </button>
                  </div>

                  <button
                    type="button"
                    className="armas-btn-primary"
                    onClick={() =>
                      setFotoCadastroAmpliada(null)
                    }
                  >
                    Fechar
                  </button>
                </footer>
              </div>
            </section>
          </div>
        )}

        {fotoManutencaoAmpliada && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setFotoManutencaoAmpliada(null)
              }
            }}
            onWheel={(event) => {
              event.preventDefault()
              event.stopPropagation()

              const delta =
                event.deltaY < 0 ? 0.15 : -0.15

              setZoomFotoManutencao((atual) =>
                Math.min(
                  3,
                  Math.max(
                    0.6,
                    Number(
                      (atual + delta).toFixed(2)
                    )
                  )
                )
              )
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              background:
                'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 64, 175, 0.88) 48%, rgba(14, 116, 144, 0.88) 100%)',
              overscrollBehavior: 'contain'
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Foto ampliada da manutenção"
              style={{
                width: 'min(1080px, 96vw)',
                maxHeight: '94vh',
                overflow: 'hidden',
                borderRadius: '18px',
                background: '#ffffff',
                boxShadow:
                  '0 28px 90px rgba(15, 23, 42, .45)',
                border: '1px solid rgba(255,255,255,.35)'
              }}
            >
              <header
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px 18px',
                  color: '#fff',
                  background:
                    'linear-gradient(135deg, #0f3b82 0%, #1d4ed8 52%, #0e7490 100%)'
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '.08em',
                      opacity: .85
                    }}
                  >
                    FOTO DA MANUTENÇÃO
                  </span>

                  <strong
                    style={{
                      display: 'block',
                      marginTop: '4px',
                      fontSize: '17px'
                    }}
                  >
                    {String(
                      fotoManutencaoAmpliada?.manutencao?.tipo_novidade ||
                      fotoManutencaoAmpliada?.manutencao?.tipo_material ||
                      'MANUTENÇÃO'
                    ).replaceAll('_', ' ')}
                  </strong>

                  <small
                    style={{
                      display: 'block',
                      marginTop: '3px',
                      opacity: .85
                    }}
                  >
                    {fotoManutencaoAmpliada?.legenda ||
                      fotoManutencaoAmpliada?.manutencao?.descricao ||
                      'Use a roda do mouse para ampliar ou reduzir.'}
                  </small>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFotoManutencaoAmpliada(null)
                  }
                  aria-label="Fechar foto"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border:
                      '1px solid rgba(255,255,255,.45)',
                    background:
                      'rgba(255,255,255,.14)',
                    color: '#fff',
                    fontSize: '24px',
                    lineHeight: 1,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </header>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '420px',
                  maxHeight: 'calc(94vh - 88px)',
                  background:
                    'radial-gradient(circle at top, #eff6ff 0%, #dbeafe 45%, #cbd5e1 100%)'
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '22px',
                    overscrollBehavior: 'contain'
                  }}
                >
                  <img
                    src={fotoManutencaoAmpliada.foto_url}
                    alt="Foto ampliada da manutenção"
                    draggable="false"
                    style={{
                      display: 'block',
                      maxWidth: zoomFotoManutencao <= 1
                        ? '100%'
                        : 'none',
                      maxHeight: zoomFotoManutencao <= 1
                        ? '68vh'
                        : 'none',
                      width:
                        zoomFotoManutencao > 1
                          ? `${zoomFotoManutencao * 100}%`
                          : 'auto',
                      objectFit: 'contain',
                      borderRadius: '12px',
                      boxShadow:
                        '0 10px 32px rgba(15, 23, 42, .22)',
                      userSelect: 'none'
                    }}
                  />
                </div>

                <footer
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderTop:
                      '1px solid rgba(148,163,184,.55)',
                    background:
                      'rgba(255,255,255,.92)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <button
                      type="button"
                      className="armas-btn-secondary"
                      onClick={() =>
                        setZoomFotoManutencao((atual) =>
                          Math.max(
                            0.6,
                            Number(
                              (atual - 0.2).toFixed(2)
                            )
                          )
                        )
                      }
                    >
                      −
                    </button>

                    <strong
                      style={{
                        minWidth: '64px',
                        textAlign: 'center'
                      }}
                    >
                      {Math.round(
                        zoomFotoManutencao * 100
                      )}%
                    </strong>

                    <button
                      type="button"
                      className="armas-btn-secondary"
                      onClick={() =>
                        setZoomFotoManutencao((atual) =>
                          Math.min(
                            3,
                            Number(
                              (atual + 0.2).toFixed(2)
                            )
                          )
                        )
                      }
                    >
                      +
                    </button>

                    <button
                      type="button"
                      className="armas-btn-secondary"
                      onClick={() =>
                        setZoomFotoManutencao(1)
                      }
                    >
                      100%
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <small style={{ color: '#64748b' }}>
                      {fotoManutencaoAmpliada?.categoria
                        ? `Categoria: ${String(
                            fotoManutencaoAmpliada.categoria
                          ).replaceAll('_', ' ')}`
                        : 'Registro da manutenção'}
                    </small>

                    <button
                      type="button"
                      className="armas-btn-primary"
                      onClick={() =>
                        setFotoManutencaoAmpliada(null)
                      }
                    >
                      Fechar
                    </button>
                  </div>
                </footer>
              </div>
            </section>
          </div>
        )}

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
