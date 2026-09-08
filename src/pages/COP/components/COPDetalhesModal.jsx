import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarManutencoes
} from '../../../services/manutencoesService'

import '../styles/COP.css'

function formatarDataHora(valor) {
  if (!valor) return '—'

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return String(valor)
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function normalizarComparacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function valorAposDoisPontos(valor) {
  const texto = String(valor || '')
  const indice = texto.indexOf(':')

  if (indice < 0) return ''

  return texto.slice(indice + 1).trim()
}

function extrairDadosLegados(valor) {
  const resultado = {
    observacoesEntrada: [],
    statusAnterior: '',
    localAnterior: '',
    servicoExecutado: '',
    observacoesRetorno: ''
  }

  const partes = String(valor || '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)

  for (const parte of partes) {
    const comparacao =
      normalizarComparacao(parte)

    if (
      comparacao.startsWith(
        'STATUS ANTERIOR:'
      )
    ) {
      resultado.statusAnterior =
        valorAposDoisPontos(parte)
      continue
    }

    if (
      comparacao.startsWith(
        'LOCAL ANTERIOR:'
      )
    ) {
      resultado.localAnterior =
        valorAposDoisPontos(parte)
      continue
    }

    if (
      comparacao.startsWith(
        'NOVIDADE PATRIMONIAL:'
      ) ||
      comparacao.startsWith(
        'RETORNO REGISTRADO EM:'
      )
    ) {
      continue
    }

    if (
      comparacao.startsWith(
        'SERVICO EXECUTADO:'
      )
    ) {
      resultado.servicoExecutado =
        valorAposDoisPontos(parte)
      continue
    }

    if (
      comparacao.startsWith(
        'OBSERVACOES DO RETORNO:'
      )
    ) {
      resultado.observacoesRetorno =
        valorAposDoisPontos(parte)
      continue
    }

    resultado.observacoesEntrada.push(
      parte
    )
  }

  return resultado
}

function dadosHistoricoManutencao(item) {
  const legados =
    extrairDadosLegados(
      item?.observacoes
    )

  const observacaoEntradaEstruturada =
    String(
      item?.observacoes_entrada ||
      ''
    ).trim()

  const observacoesEntrada =
    observacaoEntradaEstruturada
      ? [observacaoEntradaEstruturada]
      : legados.observacoesEntrada

  const descricao =
    String(
      item?.descricao ||
      ''
    ).trim()

  const observacoesEntradaLimpas =
    observacoesEntrada.filter(
      (valor) =>
        normalizarComparacao(valor) !==
        normalizarComparacao(descricao)
    )

  return {
    observacoesEntrada:
      observacoesEntradaLimpas.join(
        ' | '
      ),

    statusAnterior:
      item?.status_anterior ||
      legados.statusAnterior ||
      '',

    localAnterior:
      item?.local_anterior ||
      legados.localAnterior ||
      '',

    servicoExecutado:
      item?.servico_executado ||
      legados.servicoExecutado ||
      '',

    observacoesRetorno:
      item?.observacoes_retorno ||
      legados.observacoesRetorno ||
      ''
  }
}

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

  const [
    historicoAberto,
    setHistoricoAberto
  ] = useState(false)

  const [
    historicoManutencoes,
    setHistoricoManutencoes
  ] = useState([])

  const [
    carregandoHistorico,
    setCarregandoHistorico
  ] = useState(false)

  const [
    erroHistorico,
    setErroHistorico
  ] = useState('')

  useEffect(() => {
    setFotoSelecionada(fotoPrincipal)
  }, [fotoPrincipal])

  useEffect(() => {
    setHistoricoAberto(false)
    setHistoricoManutencoes([])
    setCarregandoHistorico(false)
    setErroHistorico('')
  }, [cop.id])

  const fotosDisponiveis =
    fotos.length > 0
      ? fotos
      : fotoPrincipal
        ? [fotoPrincipal]
        : []

  async function alternarHistorico() {
    if (historicoAberto) {
      setHistoricoAberto(false)
      return
    }

    setHistoricoAberto(true)

    if (
      historicoManutencoes.length > 0 ||
      carregandoHistorico
    ) {
      return
    }

    try {
      setCarregandoHistorico(true)
      setErroHistorico('')

      const resposta =
        await listarManutencoes({
          modulo: 'COP',
          status: null,
          referenciaId: cop.id,
          pagina: 1,
          limite: 100
        })

      setHistoricoManutencoes(
        Array.isArray(resposta?.data)
          ? resposta.data
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar histórico de manutenção da COP:',
        error
      )

      setErroHistorico(
        error?.message ||
        'Não foi possível carregar o histórico de manutenções.'
      )
    } finally {
      setCarregandoHistorico(false)
    }
  }

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

          <div
            style={{
              marginTop: '18px',
              borderTop:
                '1px solid #e2e8f0',
              paddingTop: '18px'
            }}
          >
            <button
              type="button"
              className="cop-btn-secondary"
              onClick={alternarHistorico}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                gap: '12px'
              }}
            >
              <span>
                Histórico de manutenções
              </span>

              <span aria-hidden="true">
                {historicoAberto
                  ? '▲'
                  : '▼'}
              </span>
            </button>

            {historicoAberto && (
              <div
                style={{
                  marginTop: '14px',
                  display: 'grid',
                  gap: '12px'
                }}
              >
                {carregandoHistorico && (
                  <div className="cop-gallery-message">
                    Carregando histórico...
                  </div>
                )}

                {!carregandoHistorico &&
                  erroHistorico && (
                    <div className="cop-gallery-error">
                      {erroHistorico}
                    </div>
                  )}

                {!carregandoHistorico &&
                  !erroHistorico &&
                  historicoManutencoes.length ===
                    0 && (
                    <div className="cop-gallery-message">
                      Nenhuma manutenção registrada para esta COP.
                    </div>
                  )}

                {!carregandoHistorico &&
                  !erroHistorico &&
                  historicoManutencoes.map(
                    (manutencao) => {
                      const dados =
                        dadosHistoricoManutencao(
                          manutencao
                        )

                      const concluida =
                        normalizarComparacao(
                          manutencao.status
                        ) === 'CONCLUIDA'

                      return (
                        <article
                          key={manutencao.id}
                          style={{
                            border:
                              '1px solid #dbe4ee',
                            borderRadius:
                              '12px',
                            padding: '14px',
                            background:
                              '#f8fafc'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems:
                                'flex-start',
                              justifyContent:
                                'space-between',
                              gap: '12px',
                              flexWrap:
                                'wrap'
                            }}
                          >
                            <div>
                              <small
                                style={{
                                  display:
                                    'block',
                                  marginBottom:
                                    '4px',
                                  color:
                                    '#64748b',
                                  fontWeight:
                                    700
                                }}
                              >
                                {formatarDataHora(
                                  manutencao.registrada_em ||
                                  manutencao.created_at
                                )}
                              </small>

                              <strong>
                                {String(
                                  manutencao.tipo_novidade ||
                                  'MANUTENÇÃO'
                                ).replaceAll(
                                  '_',
                                  ' '
                                )}
                              </strong>
                            </div>

                            <span
                              style={{
                                display:
                                  'inline-flex',
                                alignItems:
                                  'center',
                                padding:
                                  '5px 9px',
                                borderRadius:
                                  '999px',
                                fontSize:
                                  '12px',
                                fontWeight:
                                  800,
                                background:
                                  concluida
                                    ? '#dcfce7'
                                    : '#fef3c7',
                                color:
                                  concluida
                                    ? '#166534'
                                    : '#92400e'
                              }}
                            >
                              {String(
                                manutencao.status ||
                                '—'
                              ).replaceAll(
                                '_',
                                ' '
                              )}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop:
                                '12px',
                              display:
                                'grid',
                              gap: '8px'
                            }}
                          >
                            <div>
                              <small
                                style={{
                                  display:
                                    'block',
                                  color:
                                    '#64748b',
                                  fontWeight:
                                    700
                                }}
                              >
                                Descrição da entrada
                              </small>

                              <span>
                                {manutencao.descricao ||
                                  'Não informada'}
                              </span>
                            </div>

                            {dados.observacoesEntrada && (
                              <div>
                                <small
                                  style={{
                                    display:
                                      'block',
                                    color:
                                      '#64748b',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  Observações da entrada
                                </small>

                                <span>
                                  {dados.observacoesEntrada}
                                </span>
                              </div>
                            )}

                            {(dados.statusAnterior ||
                              dados.localAnterior) && (
                              <div>
                                <small
                                  style={{
                                    display:
                                      'block',
                                    color:
                                      '#64748b',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  Situação anterior
                                </small>

                                <span>
                                  {[
                                    dados.statusAnterior,
                                    dados.localAnterior
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      ' · '
                                    )}
                                </span>
                              </div>
                            )}

                            {dados.servicoExecutado && (
                              <div
                                style={{
                                  padding:
                                    '10px 12px',
                                  borderRadius:
                                    '9px',
                                  background:
                                    '#f0fdf4',
                                  border:
                                    '1px solid #bbf7d0'
                                }}
                              >
                                <small
                                  style={{
                                    display:
                                      'block',
                                    color:
                                      '#166534',
                                    fontWeight:
                                      800
                                  }}
                                >
                                  Serviço executado
                                </small>

                                <span>
                                  {dados.servicoExecutado}
                                </span>
                              </div>
                            )}

                            {dados.observacoesRetorno && (
                              <div>
                                <small
                                  style={{
                                    display:
                                      'block',
                                    color:
                                      '#64748b',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  Observações do retorno
                                </small>

                                <span>
                                  {dados.observacoesRetorno}
                                </span>
                              </div>
                            )}

                            {manutencao.concluida_em && (
                              <div>
                                <small
                                  style={{
                                    display:
                                      'block',
                                    color:
                                      '#64748b',
                                    fontWeight:
                                      700
                                  }}
                                >
                                  Conclusão
                                </small>

                                <span>
                                  {formatarDataHora(
                                    manutencao.concluida_em
                                  )}

                                  {manutencao.concluida_por_nome
                                    ? ` · ${manutencao.concluida_por_nome}`
                                    : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </article>
                      )
                    }
                  )}
              </div>
            )}
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
