import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  listarFotosManutencao,
  listarManutencoes
} from '../../../services/manutencoesService'

import '../styles/HT.css'

export default function HTDetalhesModal({
  ht,
  fotos = [],
  carregandoFotos = false,
  erroFotos = '',
  onClose,
  onEdit,
  onReturnMaintenance
}) {
  const fotoPrincipal = useMemo(() => {
    return (
      fotos.find(
        (foto) => foto.principal
      ) ||
      fotos[0] ||
      (ht.foto_url
        ? {
            id: 'foto-principal-ht',
            url: ht.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, ht.foto_url])

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
    setZoomFoto((atual) => Math.max(0.5, Math.min(4, Number((atual + delta).toFixed(2)))))
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
      className="ht-modal-backdrop"
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
        className="ht-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do HT"
      >
        <header>
          <div>
            <span>
              {ht.tipo_ht ||
                'HT'}
            </span>

            <h2>
              {ht.patrimonio ||
                ht.numero_serie ||
                'Rádio Portátil'}
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

        <div className="ht-modal-content">
          <div className="ht-modal-grid">
            <Info label="Patrimônio" value={ht.patrimonio} />
            <Info label="Número de série" value={ht.numero_serie} />
            <Info label="Marca" value={ht.marca} />
            <Info label="Modelo" value={ht.modelo} />
            <Info label="Tipo" value={ht.tipo_ht} />
            <Info label="Unidade" value={ht.unidade} />
            <Info label="Status operacional" value={ht.status_operacional} />
            <Info label="Local atual" value={ht.local_atual} />
            <Info label="Equipe vinculada" value={ht.equipe_vinculada} />
            <Info label="Viatura vinculada" value={ht.viatura_vinculada} />
            <Info
              label="Situação do cadastro"
              value={
                ht.ativo === false
                  ? 'INATIVO'
                  : 'ATIVO'
              }
            />
          </div>

          <div className="ht-modal-media-grid">
            {ht.qr_code && (
              <div className="ht-modal-media-card">
                <span className="ht-modal-media-title">
                  QR Code
                </span>

                <div className="ht-modal-qr-box">
                  <QRCodeCanvas
                    value={ht.qr_code}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>

                <strong>
                  {ht.numero_serie ||
                    ht.patrimonio}
                </strong>
              </div>
            )}

            <div className="ht-modal-media-card ht-modal-gallery-card">
              <span className="ht-modal-media-title">
                Fotos do equipamento
              </span>

              {carregandoFotos && (
                <div className="ht-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="ht-gallery-error">
                    {erroFotos}
                  </div>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                fotoSelecionada && (
                  <>
                    <div className="ht-modal-photo-wrap">
                      <button
                        type="button"
                        onClick={() => setFotoAmpliada(fotoSelecionada)}
                        title="Clique para ampliar a foto"
                        aria-label="Ampliar foto do HT"
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
                          alt={
                            ht.patrimonio ||
                            ht.numero_serie ||
                            'HT'
                          }
                          className="ht-modal-photo"
                        />
                      </button>

                      {fotoSelecionada.principal && (
                        <span className="ht-modal-principal-badge">
                          Principal
                        </span>
                      )}
                    </div>

                    {fotosDisponiveis.length > 1 && (
                      <div className="ht-modal-thumbnails">
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
                                    ? 'ht-modal-thumbnail is-selected'
                                    : 'ht-modal-thumbnail'
                                }
                                onClick={() =>
                                  setFotoSelecionada(foto)
                                }
                                aria-label={`Visualizar foto ${index + 1}`}
                              >
                                <img
                                  src={foto.url}
                                  alt={`Miniatura ${index + 1} do HT`}
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

                    <small className="ht-gallery-counter">
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
                  <div className="ht-gallery-message">
                    Nenhuma foto cadastrada.
                  </div>
                )}
            </div>
          </div>

          <HistoricoManutencoesHT htId={ht.id} />

          <div className="ht-modal-observacoes">
            <strong>
              Observações do equipamento
            </strong>

            <p>
              {ht.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        {fotoAmpliada && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setFotoAmpliada(null)
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(5, 18, 43, 0.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Foto ampliada do HT"
              style={{
                width: 'min(1080px, 96vw)',
                maxHeight: '94vh',
                background: '#eef5ff',
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: '0 24px 70px rgba(0,0,0,.35)'
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: 'linear-gradient(90deg, #2146c7, #147f9c)',
                  color: '#fff'
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase' }}>
                    Foto cadastral do HT
                  </strong>
                  <b style={{ fontSize: '18px' }}>
                    {ht.patrimonio || ht.numero_serie || 'Rádio HT'}
                  </b>
                  <small style={{ display: 'block', marginTop: '3px' }}>
                    Use a roda do mouse para ampliar ou reduzir.
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => setFotoAmpliada(null)}
                  aria-label="Fechar foto ampliada"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,.55)',
                    background: 'rgba(255,255,255,.12)',
                    color: '#fff',
                    fontSize: '24px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </header>

              <div
                onWheel={handleWheelFoto}
                style={{
                  height: 'min(62vh, 620px)',
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '22px',
                  background: '#dce9f8'
                }}
              >
                <img
                  src={fotoAmpliada.url}
                  alt={`Foto ampliada do HT ${ht.patrimonio || ht.numero_serie || ''}`}
                  style={{
                    maxWidth: '92%',
                    maxHeight: '54vh',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    transform: `scale(${zoomFoto})`,
                    transformOrigin: 'center center',
                    transition: 'transform .12s ease'
                  }}
                />
              </div>

              <footer
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 18px',
                  background: '#fff'
                }}
              >
                <button type="button" className="ht-btn-secondary" onClick={() => alterarZoom(-0.1)}>−</button>
                <strong>{Math.round(zoomFoto * 100)}%</strong>
                <button type="button" className="ht-btn-secondary" onClick={() => alterarZoom(0.1)}>+</button>
                <button type="button" className="ht-btn-secondary" onClick={() => setZoomFoto(1)}>100%</button>
                <button
                  type="button"
                  className="ht-btn-primary"
                  onClick={() => setFotoAmpliada(null)}
                  style={{ marginLeft: 'auto' }}
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
            className="ht-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          {String(ht.status_operacional || '').toUpperCase() === 'MANUTENCAO'
            ? onReturnMaintenance && (
                <button
                  type="button"
                  className="ht-btn-primary"
                  onClick={onReturnMaintenance}
                >
                  Retornar da manutenção
                </button>
              )
            : onEdit && (
                <button
                  type="button"
                  className="ht-btn-primary"
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

function HistoricoManutencoesHT({ htId }) {
  const [itens, setItens] = useState([])
  const [fotosPorManutencao, setFotosPorManutencao] = useState({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!htId) {
        setItens([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErro('')

        const resultado = await listarManutencoes({
          modulo: 'HT',
          status: null,
          referenciaId: htId,
          pagina: 1,
          limite: 100
        })

        const manutencoes = resultado?.data || []
        if (!ativo) return

        setItens(manutencoes)

        const pares = await Promise.all(
          manutencoes.map(async (item) => {
            try {
              const fotos = await listarFotosManutencao(item.id)
              return [item.id, fotos || []]
            } catch (error) {
              console.warn('Não foi possível carregar fotos da manutenção:', error)
              return [item.id, []]
            }
          })
        )

        if (ativo) setFotosPorManutencao(Object.fromEntries(pares))
      } catch (error) {
        console.error('Erro ao carregar histórico de manutenções do HT:', error)
        if (ativo) setErro(error?.message || 'Não foi possível carregar o histórico de manutenções.')
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [htId])

  function dataHora(valor) {
    if (!valor) return '—'
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) return '—'

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(data)
  }

  return (
    <section className="ht-maintenance-history">
      <div className="ht-maintenance-history-head">
        <div>
          <span>Histórico permanente</span>
          <h3>Manutenções do equipamento</h3>
        </div>

        <strong>{itens.length}</strong>
      </div>

      {loading && (
        <div className="ht-maintenance-history-state">
          Carregando histórico de manutenções...
        </div>
      )}

      {!loading && erro && (
        <div className="ht-maintenance-history-state is-error">{erro}</div>
      )}

      {!loading && !erro && itens.length === 0 && (
        <div className="ht-maintenance-history-state">
          Este HT ainda não possui manutenções registradas.
        </div>
      )}

      {!loading && !erro && itens.length > 0 && (
        <div className="ht-maintenance-history-list">
          {itens.map((item, index) => {
            const fotos = fotosPorManutencao[item.id] || []

            return (
              <article key={item.id} className="ht-maintenance-history-item">
                <header>
                  <div>
                    <span>Manutenção #{itens.length - index}</span>
                    <strong>{item.tipo_novidade || item.tipo_material || 'MANUTENÇÃO'}</strong>
                  </div>

                  <em className={`is-${String(item.status || '').toLowerCase()}`}>
                    {item.status || 'SEM STATUS'}
                  </em>
                </header>

                <div className="ht-maintenance-history-meta">
                  <span>Entrada: <b>{dataHora(item.registrada_em)}</b></span>
                  <span>Conclusão: <b>{dataHora(item.concluida_em)}</b></span>
                  <span>Registrado por: <b>{item.registrada_por_nome || 'SIGMO'}</b></span>
                  <span>Concluído por: <b>{item.concluida_por_nome || '—'}</b></span>
                </div>

                <div className="ht-maintenance-history-copy">
                  <p><strong>Defeito / novidade:</strong> {item.descricao || 'Não informado.'}</p>
                  <p><strong>Observações:</strong> {item.observacoes || 'Sem observações.'}</p>
                </div>

                {fotos.length > 0 && (
                  <div className="ht-maintenance-history-photos">
                    {fotos.map((foto) => (
                      <a
                        key={foto.id}
                        href={foto.foto_url}
                        target="_blank"
                        rel="noreferrer"
                        title={foto.legenda || 'Abrir foto da manutenção'}
                      >
                        <img src={foto.foto_url} alt="Registro fotográfico da manutenção" />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Info({
  label,
  value
}) {
  return (
    <div className="ht-info">
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