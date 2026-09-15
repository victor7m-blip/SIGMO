import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ALERTAS_VALIDADE_DIAS_PADRAO,
  CALIBRES_MUNICAO,
  MUNICAO_FORM_INICIAL,
  MUNICAO_LOTE_FORM_INICIAL
} from '../../constants/municoesConstants'

import {
  buscarMunicaoPorCalibre,
  cadastrarLoteMunicao,
  cadastrarMunicao,
  listarLotesResumo,
  listarPoliciaisComLote,
  listarResumoMunicoes
} from '../../services/municoesService'

import {
  criarTransferenciaManutencaoMunicaoPendente,
  registrarDescargaManutencaoMunicaoP4,
  transferirMunicaoP4ParaSvdd,
  transferirMunicaoSvddParaP4,
  transferirMunicaoExterna
} from '../../services/municoesMovimentacoesService'

import { supabase } from '../../services/supabaseClient'
import { loadSessionToken } from '../../services/authService'
import {
  concluirManutencao,
  listarManutencoes,
  MODULOS_MANUTENCAO,
  registrarManutencao
} from '../../services/manutencoesService'

import './Municoes.css'

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function obterPerfil(user) {
  return normalizar(
    user?.perfil ||
    user?.perfil_efetivo ||
    user?.role ||
    user?.user_metadata?.perfil ||
    ''
  )
}

function podeGerenciarLotes(user) {
  const perfil = obterPerfil(user)

  return (
    perfil === 'P4' ||
    perfil.includes('ADMINISTRADOR')
  )
}


function podeVerVisaoP4(user) {
  const perfil = obterPerfil(user)

  return (
    perfil === 'P4' ||
    perfil.includes('ADMINISTRADOR') ||
    perfil.includes('COMANDANTE')
  )
}

function numero(valor) {
  const n = Number(valor || 0)

  return Number.isFinite(n)
    ? Math.max(0, Math.trunc(n))
    : 0
}

function dataLocal(valor) {
  if (!valor) {
    return null
  }

  const textoData =
    String(valor).slice(0, 10)

  const data = new Date(
    `${textoData}T12:00:00`
  )

  if (Number.isNaN(data.getTime())) {
    return null
  }

  return data
}

function formatarData(valor) {
  const data =
    dataLocal(valor)

  if (!data) {
    return '—'
  }

  return data.toLocaleDateString(
    'pt-BR'
  )
}

function diasAteData(valor) {
  const data =
    dataLocal(valor)

  if (!data) {
    return null
  }

  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)

  return Math.ceil(
    (
      data.getTime() -
      hoje.getTime()
    ) /
    86400000
  )
}

function situacaoValidade(lote) {
  if (!lote?.validade) {
    return 'SEM_VALIDADE'
  }

  const dias =
    diasAteData(
      lote.validade
    )

  if (dias === null) {
    return 'SEM_VALIDADE'
  }

  if (dias < 0) {
    return 'VENCIDA'
  }

  if (
    lote.alerta_validade_ativo &&
    numero(
      lote.alerta_validade_dias_antes
    ) > 0 &&
    dias <=
      numero(
        lote.alerta_validade_dias_antes
      )
  ) {
    return 'ALERTA'
  }

  return 'OK'
}

function classeValidade(lote) {
  const situacao =
    situacaoValidade(lote)

  if (situacao === 'VENCIDA') {
    return 'municoes-validade-badge municoes-validade-vencida'
  }

  if (situacao === 'ALERTA') {
    return 'municoes-validade-badge municoes-validade-alerta'
  }

  if (situacao === 'OK') {
    return 'municoes-validade-badge municoes-validade-ok'
  }

  return ''
}

function percentual(
  valor,
  total
) {
  if (!Number(total)) {
    return 0
  }

  return Math.max(
    0,
    Math.min(
      100,
      (
        Number(valor || 0) /
        Number(total)
      ) * 100
    )
  )
}

function GraficoRoscaMunicoes({
  total,
  itens
}) {
  let acumulado = 0

  const segmentos =
    itens.map((item) => {
      const inicio =
        acumulado

      acumulado +=
        percentual(
          item.valor,
          total
        )

      return `${item.cor} ${inicio}% ${acumulado}%`
    })

  if (acumulado < 100) {
    segmentos.push(
      `#e8edf4 ${acumulado}% 100%`
    )
  }

  return (
    <section className="municoes-chart-card">
      <div className="municoes-chart-header">
        <div>
          <span>
            Distribuição do estoque
          </span>

          <h2>
            Situação das munições
          </h2>
        </div>
      </div>

      <div className="municoes-chart-donut-layout">
        <div
          className="municoes-chart-donut"
          style={{
            background:
              `conic-gradient(${segmentos.join(', ')})`
          }}
          aria-label={`Total de ${total} munições controladas`}
        >
          <div>
            <strong>
              {numero(total).toLocaleString(
                'pt-BR'
              )}
            </strong>

            <span>
              TOTAL ATUAL
            </span>
          </div>
        </div>

        <div className="municoes-chart-legend">
          {itens.map((item) => (
            <div key={item.label}>
              <i
                style={{
                  background:
                    item.cor
                }}
              />

              <span>
                {item.label}
              </span>

              <strong>
                {numero(
                  item.valor
                ).toLocaleString(
                  'pt-BR'
                )}
              </strong>

              <small>
                {percentual(
                  item.valor,
                  total
                ).toLocaleString(
                  'pt-BR',
                  {
                    maximumFractionDigits:
                      1
                  }
                )}
                %
              </small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GraficoBarrasMunicoes({
  total,
  itens,
  rotulo = 'Estoque controlado'
}) {
  const maior =
    Math.max(
      1,
      ...itens.map(
        (item) =>
          Number(
            item.valor || 0
          )
      )
    )

  return (
    <section className="municoes-chart-card">
      <div className="municoes-chart-header">
        <div>
          <span>
            {rotulo}
          </span>

          <h2>
            Munições por calibre
          </h2>
        </div>
      </div>

      <div className="municoes-chart-bars">
        {itens.map((item) => (
          <div
            className="municoes-chart-bar-item"
            key={item.label}
          >
            <div className="municoes-chart-bar-value">
              {numero(
                item.valor
              ).toLocaleString(
                'pt-BR'
              )}
            </div>

            <div className="municoes-chart-bar-track">
              <i
                style={{
                  height:
                    `${Math.max(
                      item.valor
                        ? 9
                        : 2,
                      (
                        Number(
                          item.valor || 0
                        ) /
                        maior
                      ) * 100
                    )}%`,
                  background:
                    item.cor
                }}
              />
            </div>

            <strong>
              {item.label}
            </strong>

            <small>
              {percentual(
                item.valor,
                total
              ).toLocaleString(
                'pt-BR',
                {
                  maximumFractionDigits:
                    1
                }
              )}
              %
            </small>
          </div>
        ))}
      </div>
    </section>
  )
}

function GrupoOperacao({
  icone,
  titulo,
  descricao,
  children
}) {
  return (
    <div className="municoes-operation-group">
      <div className="municoes-operation-group-header">
        <div
          className="municoes-operation-group-icon"
          aria-hidden="true"
        >
          {icone}
        </div>

        <div>
          <h3>
            {titulo}
          </h3>

          <p>
            {descricao}
          </p>
        </div>
      </div>

      <div className="municoes-operation-actions">
        {children}
      </div>
    </div>
  )
}

function SelecionarTransferenciaModal({
  resumo,
  sentido,
  onClose,
  onSelecionar
}) {
  const p4ParaSvdd =
    sentido === 'P4_SVDD'

  const [
    pendentesSaida,
    setPendentesSaida
  ] = useState([])

  const [
    carregandoPendentes,
    setCarregandoPendentes
  ] = useState(true)

  const [
    erroPendentes,
    setErroPendentes
  ] = useState('')

  useEffect(() => {
    let ativo = true

    setCarregandoPendentes(true)
    setErroPendentes('')

    listarTransferenciasPendentes(
      'SAIDA'
    )
      .then((resultado) => {
        if (ativo) {
          setPendentesSaida(
            Array.isArray(resultado)
              ? resultado
              : []
          )
        }
      })
      .catch((error) => {
        if (ativo) {
          setErroPendentes(
            error?.message ||
            'Não foi possível calcular as quantidades já reservadas em transferências pendentes.'
          )
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregandoPendentes(false)
        }
      })

    return () => {
      ativo = false
    }
  }, [])

  const origemEsperada =
    p4ParaSvdd
      ? 'COFRE_P4'
      : 'COFRE_SVDD'

  function quantidadeReservada(
    municaoId
  ) {
    return pendentesSaida.reduce(
      (total, item) => {
        if (
          String(
            item?.municao_id ||
            ''
          ) !==
          String(
            municaoId ||
            ''
          )
        ) {
          return total
        }

        if (
          normalizar(
            item?.origem_tipo
          ) !==
          normalizar(
            origemEsperada
          )
        ) {
          return total
        }

        return (
          total +
          numero(
            item?.quantidade_total
          )
        )
      },
      0
    )
  }

  function quantidadeDisponivel(
    item
  ) {
    const fisica =
      numero(
        p4ParaSvdd
          ? item.quantidade_p4
          : item.quantidade_svdd
      )

    const reservada =
      quantidadeReservada(
        item?.id
      )

    return Math.max(
      0,
      fisica -
      reservada
    )
  }

  const disponiveis =
    resumo
      .map((item) => ({
        ...item,
        quantidade_disponivel_origem:
          quantidadeDisponivel(
            item
          )
      }))
      .filter(
        (item) =>
          numero(
            item
              .quantidade_disponivel_origem
          ) > 0
      )

  return (
    <Modal
      titulo={
        p4ParaSvdd
          ? 'Enviar munição ao SVDD'
          : 'Retornar munição ao P4'
      }
      subtitulo="Selecione o calibre que será movimentado."
      onClose={onClose}
      amplo
    >
      {erroPendentes && (
        <div className="municoes-alert municoes-alert-error">
          {erroPendentes}
        </div>
      )}

      {carregandoPendentes ? (
        <div className="municoes-loading">
          Atualizando disponibilidade...
        </div>
      ) : disponiveis.length === 0 ? (
        <div className="municoes-modal-empty">
          Nenhum calibre possui saldo disponível na origem.
        </div>
      ) : (
        <div className="municoes-table-wrap">
          <table className="municoes-table">
            <thead>
              <tr>
                <th>
                  CALIBRE
                </th>

                <th>
                  DISPONÍVEL
                </th>

                <th>
                  AÇÃO
                </th>
              </tr>
            </thead>

            <tbody>
              {disponiveis.map(
                (item) => (
                  <tr
                    key={
                      item.id
                    }
                  >
                    <td>
                      <strong>
                        {
                          item.calibre
                        }
                      </strong>
                    </td>

                    <td>
                      {numero(
                        item
                          .quantidade_disponivel_origem
                      ).toLocaleString(
                        'pt-BR'
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="municoes-btn-primary municoes-btn-small"
                        onClick={() =>
                          onSelecionar?.(
                            item
                          )
                        }
                      >
                        Selecionar
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function Modal({
  titulo,
  subtitulo = '',
  onClose,
  children,
  amplo = false
}) {
  return (
    <div
      className="municoes-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <section
        className={`municoes-modal ${amplo ? 'municoes-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="municoes-modal-header">
          <div>
            <span className="municoes-eyebrow">
              SIGMO • MUNIÇÕES
            </span>

            <h2>{titulo}</h2>

            {subtitulo && (
              <p>{subtitulo}</p>
            )}
          </div>

          <button
            type="button"
            className="municoes-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="municoes-modal-body">
          {children}
        </div>
      </section>
    </div>
  )
}

function Campo({
  label,
  children,
  full = false
}) {
  return (
    <label
      className={`municoes-field ${full ? 'municoes-field-full' : ''}`}
    >
      <span>{label}</span>
      {children}
    </label>
  )
}

function ComboFiltro({
  label,
  value,
  options,
  onChange,
  placeholder = 'Digite ou selecione...'
}) {
  const [aberto, setAberto] =
    useState(false)

  const [
    mostrarTodas,
    setMostrarTodas
  ] = useState(true)

  const termo =
    normalizar(value)

  const opcoesVisiveis =
    useMemo(() => {
      if (
        mostrarTodas ||
        !termo
      ) {
        return options
      }

      return options.filter(
        (opcao) =>
          normalizar(
            opcao.value
          ).includes(
            termo
          ) ||
          normalizar(
            opcao.secondary
          ).includes(
            termo
          )
      )
    }, [
      options,
      termo,
      mostrarTodas
    ])

  function abrir() {
    setMostrarTodas(true)
    setAberto(true)
  }

  function selecionar(opcao) {
    onChange?.(
      opcao.value
    )
    setAberto(false)
    setMostrarTodas(true)
  }

  return (
    <div
      className="municoes-field"
      style={{
        minWidth: 0,
        position: 'relative'
      }}
    >
      <span>
        {label}
      </span>

      <div
        style={{
          position: 'relative'
        }}
      >
        <input
          className="municoes-input"
          value={value}
          autoComplete="off"
          onFocus={abrir}
          onClick={abrir}
          onChange={(event) => {
            setMostrarTodas(false)
            setAberto(true)

            onChange?.(
              event.target.value
            )
          }}
          onKeyDown={(event) => {
            if (
              event.key ===
              'Escape'
            ) {
              setAberto(false)
            }

            if (
              event.key ===
              'ArrowDown'
            ) {
              setMostrarTodas(true)
              setAberto(true)
            }
          }}
          onBlur={() => {
            window.setTimeout(
              () =>
                setAberto(
                  false
                ),
              120
            )
          }}
          placeholder={placeholder}
          style={{
            paddingRight: '38px'
          }}
        />

        <button
          type="button"
          aria-label={`Abrir opções de ${label}`}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            setMostrarTodas(true)
            setAberto(
              (atual) =>
                !atual
            )
          }}
          style={{
            position: 'absolute',
            inset: '0 0 0 auto',
            width: '38px',
            border: 0,
            background: 'transparent',
            color: '#344054',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ▼
        </button>
      </div>

      {aberto && (
        <div
          style={{
            position: 'absolute',
            zIndex: 120,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '240px',
            overflowY: 'auto',
            border: '1px solid #cbd6e3',
            borderRadius: '10px',
            background: '#ffffff',
            boxShadow:
              '0 14px 32px rgba(15, 23, 42, 0.18)'
          }}
        >
          {opcoesVisiveis.length === 0 ? (
            <div
              style={{
                padding: '11px 12px',
                color: '#667085',
                fontSize: '0.78rem'
              }}
            >
              Nenhuma opção encontrada.
            </div>
          ) : (
            opcoesVisiveis.map(
              (opcao) => (
                <button
                  type="button"
                  key={
                    opcao.key ||
                    opcao.value
                  }
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onClick={() =>
                    selecionar(
                      opcao
                    )
                  }
                  style={{
                    width: '100%',
                    display: 'grid',
                    gap: '2px',
                    padding: '10px 12px',
                    border: 0,
                    borderBottom:
                      '1px solid #eef2f7',
                    background:
                      normalizar(
                        opcao.value
                      ) ===
                      normalizar(
                        value
                      )
                        ? '#eef5ff'
                        : '#ffffff',
                    color: '#172033',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit'
                  }}
                >
                  <strong
                    style={{
                      fontSize: '0.8rem'
                    }}
                  >
                    {opcao.label}
                  </strong>

                  {opcao.secondary && (
                    <small
                      style={{
                        color: '#667085',
                        fontSize: '0.7rem'
                      }}
                    >
                      {opcao.secondary}
                    </small>
                  )}
                </button>
              )
            )
          )}
        </div>
      )}
    </div>
  )
}

async function listarPoliciaisMunicaoPorCalibre(
  calibre
) {
  const calibreNormalizado =
    normalizar(
      calibre
    )

  if (!calibreNormalizado) {
    return []
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_policiais_calibre',
    {
      p_token:
        token,

      p_calibre:
        calibreNormalizado
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

async function listarTransferenciasPendentes(
  direcao
) {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_transferencias_pendentes',
    {
      p_token:
        token,
      p_direcao:
        direcao
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

async function receberTransferenciaPendente(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_transferencia',
    {
      p_token:
        token,
      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}

async function receberTransferenciaSvddP4(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_transferencia_svdd_p4',
    {
      p_token:
        token,
      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}


async function listarDevolucoesMunicaoPendentesSvdd() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_devolucoes_pendentes_svdd',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}


async function receberDevolucaoMunicaoSvdd(
  devolucaoId
) {
  if (!devolucaoId) {
    throw new Error(
      'Devolução de munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_devolucao',
    {
      p_token:
        token,

      p_devolucao_id:
        devolucaoId
    }
  )

  if (error) {
    throw error
  }

  return data
}

async function cancelarTransferenciaPendente(
  transferenciaId,
  motivo = ''
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_cancelar_transferencia',
    {
      p_token:
        token,
      p_transferencia_id:
        transferenciaId,
      p_motivo:
        String(
          motivo || ''
        ).trim() ||
        null
    }
  )

  if (error) {
    throw error
  }

  return data
}

function CardResumo({
  titulo,
  valor,
  subtitulo
}) {
  return (
    <article className="municoes-resumo-card">
      <span>{titulo}</span>

      <strong>
        {numero(valor).toLocaleString('pt-BR')}
      </strong>

      {subtitulo && (
        <small>{subtitulo}</small>
      )}
    </article>
  )
}

function CardDistribuicao({
  titulo,
  itens,
  subtitulo = ''
}) {
  const total =
    itens.reduce(
      (soma, item) =>
        soma +
        numero(item.quantidade),
      0
    )

  return (
    <article className="municoes-resumo-card">
      <span>{titulo}</span>

      <strong>
        {total.toLocaleString('pt-BR')}
      </strong>

      {subtitulo && (
        <small>{subtitulo}</small>
      )}

      <div
        style={{
          width: '100%',
          display: 'grid',
          gap: '5px',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid #e5eaf1'
        }}
      >
        {itens.length === 0 ? (
          <div
            style={{
              color: '#98a2b3',
              fontSize: '0.72rem'
            }}
          >
            Sem saldo
          </div>
        ) : (
          itens.map((item) => (
            <div
              key={`${titulo}-${item.calibre}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                color: '#475467',
                fontSize: '0.72rem'
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.calibre}
              </span>

              <strong
                style={{
                  color: '#172033',
                  fontSize: '0.76rem'
                }}
              >
                {numero(
                  item.quantidade
                ).toLocaleString(
                  'pt-BR'
                )}
              </strong>
            </div>
          ))
        )}
      </div>
    </article>
  )
}

function NovoCalibreModal({
  user,
  onClose,
  onSalvo
}) {
  const [formMunicao, setFormMunicao] =
    useState(MUNICAO_FORM_INICIAL)

  const [formLote, setFormLote] =
    useState(MUNICAO_LOTE_FORM_INICIAL)

  const [salvando, setSalvando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  async function salvar(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')

      if (!formMunicao.calibre) {
        throw new Error(
          'Selecione o calibre da munição.'
        )
      }

      if (!formLote.numero_lote?.trim()) {
        throw new Error(
          'Informe o número do lote.'
        )
      }

      if (
        numero(
          formLote.quantidade_inicial
        ) <= 0
      ) {
        throw new Error(
          'Informe uma quantidade maior que zero.'
        )
      }

      let municao =
        await buscarMunicaoPorCalibre(
          formMunicao.calibre
        )

      if (!municao) {
        municao =
          await cadastrarMunicao({
            dados: formMunicao,
            user
          })
      }

      await cadastrarLoteMunicao({
        municaoId: municao.id,

        dados: {
          ...formLote,

          quantidade_inicial:
            numero(
              formLote.quantidade_inicial
            ),

          quantidade_p4: 0,
          quantidade_svdd: 0,

          alerta_validade_ativo:
            formLote.alerta_validade_ativo === true,

          alerta_validade_dias_antes:
            formLote.alerta_validade_ativo
              ? numero(
                  formLote.alerta_validade_dias_antes
                )
              : null
        },

        user
      })

      await onSalvo?.()
      onClose?.()
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível cadastrar a munição.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo="Cadastrar munição"
      subtitulo="Cadastre o calibre e a carga recebida pelo respectivo lote."
      onClose={onClose}
      amplo
    >
      <form onSubmit={salvar}>
        <div className="municoes-form-grid">
          <Campo label="CALIBRE">
            <select
              autoFocus
              className="municoes-select"
              value={formMunicao.calibre}
              onChange={(event) =>
                setFormMunicao((atual) => ({
                  ...atual,
                  calibre: event.target.value
                }))
              }
            >
              <option value="">
                Selecione o calibre
              </option>

              {[
                ...new Set(
                  CALIBRES_MUNICAO.map(
                    (item) => item.grupo
                  )
                )
              ].map((grupo) => (
                <optgroup
                  key={grupo}
                  label={grupo}
                >
                  {CALIBRES_MUNICAO
                    .filter(
                      (item) =>
                        item.grupo === grupo
                    )
                    .map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Campo>

          <Campo label="NÚMERO DO LOTE">
            <input
              className="municoes-input"
              value={formLote.numero_lote}
              onChange={(event) =>
                setFormLote((atual) => ({
                  ...atual,
                  numero_lote:
                    event.target.value.toUpperCase()
                }))
              }
              placeholder="Identificação do lote"
            />
          </Campo>

          <Campo label="QUANTIDADE RECEBIDA">
            <input
              className="municoes-input"
              type="number"
              min="1"
              value={formLote.quantidade_inicial}
              onChange={(event) =>
                setFormLote((atual) => ({
                  ...atual,
                  quantidade_inicial:
                    event.target.value
                }))
              }
            />
          </Campo>

          <Campo label="DATA DE ENTREGA">
            <input
              className="municoes-input"
              type="date"
              value={formLote.data_entrega}
              onChange={(event) =>
                setFormLote((atual) => ({
                  ...atual,
                  data_entrega:
                    event.target.value
                }))
              }
            />
          </Campo>

          <Campo label="VALIDADE">
            <input
              className="municoes-input"
              type="date"
              value={formLote.validade}
              onChange={(event) =>
                setFormLote((atual) => ({
                  ...atual,
                  validade:
                    event.target.value
                }))
              }
            />
          </Campo>

          <Campo label="STATUS">
            <select
              className="municoes-select"
              value={
                formMunicao.status_operacional
              }
              onChange={(event) =>
                setFormMunicao((atual) => ({
                  ...atual,
                  status_operacional:
                    event.target.value
                }))
              }
            >
              <option value="RESERVA">
                RESERVA
              </option>

              <option value="EM_SERVICO">
                EM SERVIÇO
              </option>

              <option value="RECOLHIDO">
                RECOLHIDO
              </option>

              <option value="BAIXADO">
                BAIXADO
              </option>
            </select>
          </Campo>

          <Campo
            label="LEMBRETE DE VALIDADE"
            full
          >
            <div
              style={{
                display: 'grid',
                gap: '10px'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  fontWeight: 700,
                  letterSpacing: 0,
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    formLote.alerta_validade_ativo === true
                  }
                  disabled={!formLote.validade}
                  onChange={(event) =>
                    setFormLote((atual) => ({
                      ...atual,
                      alerta_validade_ativo:
                        event.target.checked,
                      alerta_validade_dias_antes:
                        event.target.checked
                          ? atual.alerta_validade_dias_antes
                          : ''
                    }))
                  }
                />

                Lembrar antes do vencimento
              </label>

              {formLote.alerta_validade_ativo && (
                <>
                  <input
                    className="municoes-input"
                    type="number"
                    min="1"
                    step="1"
                    list="municoes-alertas-validade-cadastro"
                    value={
                      formLote.alerta_validade_dias_antes
                    }
                    onChange={(event) =>
                      setFormLote((atual) => ({
                        ...atual,
                        alerta_validade_dias_antes:
                          event.target.value
                      }))
                    }
                    placeholder="Ex.: 60 dias antes"
                  />

                  <datalist id="municoes-alertas-validade-cadastro">
                    {ALERTAS_VALIDADE_DIAS_PADRAO.map(
                      (opcao) => (
                        <option
                          key={opcao.value}
                          value={opcao.value}
                        >
                          {opcao.label}
                        </option>
                      )
                    )}
                  </datalist>
                </>
              )}

              {!formLote.validade && (
                <small
                  style={{
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: 0
                  }}
                >
                  Informe uma validade para ativar o lembrete.
                </small>
              )}
            </div>
          </Campo>

          <Campo
            label="OBSERVAÇÕES"
            full
          >
            <textarea
              className="municoes-textarea"
              rows={3}
              value={formLote.observacoes}
              onChange={(event) =>
                setFormLote((atual) => ({
                  ...atual,
                  observacoes:
                    event.target.value.toUpperCase()
                }))
              }
            />
          </Campo>
        </div>

        {erro && (
          <div className="municoes-alert municoes-alert-error">
            {erro}
          </div>
        )}

        <footer className="municoes-modal-actions">
          <button
            type="button"
            className="municoes-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="municoes-btn-primary"
            disabled={salvando}
          >
            {salvando
              ? 'Salvando...'
              : 'Cadastrar munição'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

function TransferenciaModal({
  municao,
  sentido,
  user,
  onClose,
  onSalvo
}) {
  const [quantidade, setQuantidade] =
    useState('')

  const [documento, setDocumento] =
    useState('')

  const [observacoes, setObservacoes] =
    useState('')

  const [salvando, setSalvando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const p4ParaSvdd =
    sentido === 'P4_SVDD'

  const disponivel =
    municao
      ?.quantidade_disponivel_origem !==
    undefined
      ? numero(
          municao
            .quantidade_disponivel_origem
        )
      : (
          p4ParaSvdd
            ? numero(
                municao.quantidade_p4
              )
            : numero(
                municao.quantidade_svdd
              )
        )

  async function salvar(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')

      const args = {
        municaoId:
          municao.id,

        quantidade:
          numero(quantidade),

        documento,
        observacoes,
        user
      }

      if (p4ParaSvdd) {
        await transferirMunicaoP4ParaSvdd(
          args
        )
      } else {
        await transferirMunicaoSvddParaP4(
          args
        )
      }

      await onSalvo?.()
      onClose?.()
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível transferir a munição.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={
        p4ParaSvdd
          ? 'Enviar ao SVDD'
          : 'Retornar ao P4'
      }
      subtitulo={`${municao.calibre} • disponível na origem: ${disponivel}`}
      onClose={onClose}
    >
      <form onSubmit={salvar}>
        <div className="municoes-form-grid">
          <Campo label="QUANTIDADE">
            <input
              autoFocus
              className="municoes-input"
              type="number"
              min="1"
              max={disponivel}
              value={quantidade}
              onChange={(event) =>
                setQuantidade(
                  event.target.value
                )
              }
            />
          </Campo>

          <Campo label="DOCUMENTO">
            <input
              className="municoes-input"
              value={documento}
              onChange={(event) =>
                setDocumento(
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo
            label="OBSERVAÇÕES"
            full
          >
            <textarea
              className="municoes-textarea"
              rows={3}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>
        </div>

        {erro && (
          <div className="municoes-alert municoes-alert-error">
            {erro}
          </div>
        )}

        <footer className="municoes-modal-actions">
          <button
            type="button"
            className="municoes-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="municoes-btn-primary"
            disabled={
              salvando ||
              numero(quantidade) <= 0
            }
          >
            {salvando
              ? 'Transferindo...'
              : 'Confirmar transferência'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

function OperacaoEspecialModal({
  tipo,
  resumo,
  manutencoesAtivas = [],
  origem = 'P4',
  destinoPadrao = '',
  user,
  onClose,
  onSalvo
}) {
  const [municaoId, setMunicaoId] =
    useState('')

  const [quantidade, setQuantidade] =
    useState('')

  const [classificacao, setClassificacao] =
    useState(
      destinoPadrao || ''
    )

  const [destino, setDestino] =
    useState('')

  const [reDestinatario, setReDestinatario] =
    useState('')

  const [
    policialDestinatario,
    setPolicialDestinatario
  ] = useState(null)

  const [
    buscandoPolicial,
    setBuscandoPolicial
  ] = useState(false)

  const [documento, setDocumento] =
    useState('')

  const [observacoes, setObservacoes] =
    useState('')

  const [fotos, setFotos] =
    useState([])

  const [salvando, setSalvando] =
    useState(false)

  const [erroAcao, setErroAcao] =
    useState('')

  const [
    transferenciasPendentesSaida,
    setTransferenciasPendentesSaida
  ] = useState([])

  const [
    carregandoReservas,
    setCarregandoReservas
  ] = useState(
    tipo === 'TRANSFERENCIA_EXTERNA' &&
    normalizar(origem).includes('P4')
  )

  const [
    erroReservas,
    setErroReservas
  ] = useState('')

  const origemNormalizada =
    normalizar(origem)

  const campoSaldo =
    origemNormalizada.includes(
      'SVDD'
    )
      ? 'quantidade_svdd'
      : 'quantidade_p4'

  const deveDescontarReservasP4 =
    tipo === 'TRANSFERENCIA_EXTERNA' &&
    !origemNormalizada.includes('SVDD')

  useEffect(() => {
    let ativo = true

    if (!deveDescontarReservasP4) {
      setTransferenciasPendentesSaida([])
      setCarregandoReservas(false)
      setErroReservas('')

      return () => {
        ativo = false
      }
    }

    setCarregandoReservas(true)
    setErroReservas('')

    listarTransferenciasPendentes(
      'SAIDA'
    )
      .then((resultado) => {
        if (!ativo) {
          return
        }

        setTransferenciasPendentesSaida(
          Array.isArray(resultado)
            ? resultado
            : []
        )
      })
      .catch((error) => {
        if (!ativo) {
          return
        }

        setTransferenciasPendentesSaida([])
        setErroReservas(
          error?.message ||
          'Não foi possível calcular as munições já reservadas em transferências pendentes.'
        )
      })
      .finally(() => {
        if (ativo) {
          setCarregandoReservas(false)
        }
      })

    return () => {
      ativo = false
    }
  }, [
    deveDescontarReservasP4
  ])

  function quantidadeReservadaP4(
    item
  ) {
    if (!deveDescontarReservasP4) {
      return 0
    }

    const municaoIdItem =
      String(
        item?.id ||
        ''
      )

    if (!municaoIdItem) {
      return 0
    }

    return transferenciasPendentesSaida.reduce(
      (total, transferencia) => {
        const mesmaMunicao =
          String(
            transferencia?.municao_id ||
            ''
          ) === municaoIdItem

        const origemP4 =
          normalizar(
            transferencia?.origem_tipo
          ) === 'COFRE_P4'

        if (
          !mesmaMunicao ||
          !origemP4
        ) {
          return total
        }

        return (
          total +
          numero(
            transferencia?.quantidade_total
          )
        )
      },
      0
    )
  }

  const ehManutencao =
    tipo === 'MANUTENCAO'

  const encaminhaManutencaoSvdd =
    ehManutencao &&
    origemNormalizada.includes(
      'SVDD'
    )

  const manutencaoSvddDisponivelPorMunicao =
    useMemo(() => {
      const mapa = new Map()

      if (!encaminhaManutencaoSvdd) {
        return mapa
      }

      for (const item of manutencoesAtivas) {
        const status =
          normalizar(
            item?.status
          )

        const origemItem =
          normalizar(
            item?.origem
          )

        const referenciaId =
          String(
            item?.referencia_id ||
            ''
          )

        if (
          status !== 'EM_MANUTENCAO' ||
          !referenciaId ||
          !(
            origemItem.includes(
              'SVDD'
            ) ||
            origemItem.includes(
              'SERVICO DE DIA'
            )
          )
        ) {
          continue
        }

        mapa.set(
          referenciaId,
          numero(
            mapa.get(
              referenciaId
            )
          ) +
          numero(
            item?.quantidade
          )
        )
      }

      return mapa
    }, [
      encaminhaManutencaoSvdd,
      manutencoesAtivas
    ])

  const manutencaoP4DisponivelPorMunicao =
    useMemo(() => {
      const mapa = new Map()

      if (tipo !== 'DESCARGA') {
        return mapa
      }

      for (const item of manutencoesAtivas) {
        const status =
          normalizar(
            item?.status
          )

        const origemItem =
          normalizar(
            item?.origem
          )

        const referenciaId =
          String(
            item?.referencia_id ||
            ''
          )

        if (
          status !== 'EM_MANUTENCAO' ||
          !referenciaId ||
          !origemItem.includes('P4')
        ) {
          continue
        }

        mapa.set(
          referenciaId,
          numero(
            mapa.get(
              referenciaId
            )
          ) +
          numero(
            item?.quantidade
          )
        )
      }

      return mapa
    }, [
      tipo,
      manutencoesAtivas
    ])

  const disponiveis =
    resumo
      .map((item) => {
        const saldoFisico =
          encaminhaManutencaoSvdd
            ? numero(
                manutencaoSvddDisponivelPorMunicao.get(
                  String(item.id)
                )
              )
            : tipo === 'DESCARGA'
              ? numero(
                  manutencaoP4DisponivelPorMunicao.get(
                    String(item.id)
                  )
                )
              : numero(
                  item?.[campoSaldo]
                )

        const reservado =
          encaminhaManutencaoSvdd
            ? 0
            : quantidadeReservadaP4(
                item
              )

        return {
          ...item,

          quantidade_disponivel_origem:
            Math.max(
              0,
              saldoFisico -
              reservado
            )
        }
      })
      .filter(
        (item) =>
          numero(
            item
              .quantidade_disponivel_origem
          ) > 0
      )

  const municao =
    disponiveis.find(
      (item) =>
        String(item.id) ===
        String(municaoId)
    ) || null

  const saldoDisponivel =
    carregandoReservas &&
    deveDescontarReservasP4
      ? 0
      : numero(
          municao
            ?.quantidade_disponivel_origem
        )

  const ehTransferencia =
    tipo === 'TRANSFERENCIA_EXTERNA'

  const ehDescarga =
    tipo === 'DESCARGA'

  const ehCargaPermanente =
    ehTransferencia &&
    classificacao ===
      'CARGA_PERMANENTE'

  useEffect(() => {
    if (!ehCargaPermanente) {
      setReDestinatario('')
      setPolicialDestinatario(null)
      setBuscandoPolicial(false)
      return
    }

    const reBase =
      String(
        reDestinatario ||
        ''
      )
        .replace(/\D/g, '')
        .slice(0, 6)

    if (reBase.length !== 6) {
      setPolicialDestinatario(null)
      setBuscandoPolicial(false)
      return
    }

    let ativo = true

    async function localizarPolicial() {
      try {
        setBuscandoPolicial(true)
        setPolicialDestinatario(null)
        setErroAcao('')

        const {
          data,
          error
        } = await supabase
          .from('policiais')
          .select(
            'id, re, nome, nome_guerra, posto_graduacao, situacao'
          )
          .ilike(
            're',
            `${reBase}%`
          )
          .limit(10)

        if (error) {
          throw error
        }

        if (!ativo) {
          return
        }

        const policial =
          (data || []).find(
            (item) => {
              const reItem =
                String(
                  item?.re ||
                  ''
                )
                  .replace(/\D/g, '')
                  .slice(0, 6)

              return (
                reItem === reBase &&
                normalizar(
                  item?.situacao
                ) !== 'INATIVO'
              )
            }
          ) ||
          null

        if (!policial) {
          setErroAcao(
            `RE ${reBase} não localizado entre os policiais ativos.`
          )
          return
        }

        setPolicialDestinatario(
          policial
        )
      } catch (error) {
        if (!ativo) {
          return
        }

        setErroAcao(
          error?.message ||
          'Não foi possível localizar o policial pelo RE.'
        )
      } finally {
        if (ativo) {
          setBuscandoPolicial(false)
        }
      }
    }

    localizarPolicial()

    return () => {
      ativo = false
    }
  }, [
    ehCargaPermanente,
    reDestinatario
  ])

  const config =
    ehManutencao
      ? encaminhaManutencaoSvdd
        ? {
            titulo:
              'Encaminhar manutenção ao P4',

            subtitulo:
              'Selecione somente munições que já estão em manutenção sob responsabilidade do SVDD. Você pode encaminhar uma, várias ou todas ao P4 sem alterar o saldo apto do cofre.',

            confirmar:
              'Encaminhar ao P4'
          }
        : {
            titulo:
              'Enviar munição para manutenção',

            subtitulo:
              'Registre munições avariadas, deterioradas ou impróprias para uso.',

            confirmar:
              'Confirmar envio para manutenção'
          }
      : ehTransferencia
        ? {
            titulo:
              classificacao ===
              'CARGA_PERMANENTE'
                ? 'Carga permanente'
                : classificacao ===
                  'OUTRAS_CIAS'
                  ? 'Transferir para outra Cia'
                  : classificacao ===
                    'BATALHAO'
                    ? 'Transferir para o Batalhão'
                    : 'Transferir para outra unidade',

            subtitulo:
              classificacao ===
              'CARGA_PERMANENTE'
                ? 'Informe o policial destinatário pelo RE, o calibre e a quantidade.'
                : 'Selecione calibre, quantidade e informe o destino da transferência.',

            confirmar:
              classificacao ===
              'CARGA_PERMANENTE'
                ? 'Confirmar carga permanente'
                : 'Confirmar transferência'
          }
        : {
            titulo:
              'Registrar descarga',

            subtitulo:
              'Retirada definitiva do estoque ativo, com justificativa e rastreabilidade.',

            confirmar:
              'Confirmar descarga'
          }

  async function salvarTransferencia(event) {
    event.preventDefault()

    if (!ehTransferencia) {
      return
    }

    try {
      setSalvando(true)
      setErroAcao('')

      if (!municao?.id) {
        throw new Error(
          'Selecione o calibre da munição.'
        )
      }

      const quantidadeFinal =
        numero(
          quantidade
        )

      if (quantidadeFinal <= 0) {
        throw new Error(
          'Informe uma quantidade maior que zero.'
        )
      }

      if (
        quantidadeFinal >
        saldoDisponivel
      ) {
        throw new Error(
          `Existem apenas ${saldoDisponivel} unidade(s) disponíveis no P4.`
        )
      }

      if (!classificacao) {
        throw new Error(
          'Destino da transferência não informado.'
        )
      }

      let destinoNome =
        classificacao ===
        'BATALHAO'
          ? '27º BPM/M'
          : String(
              destino ||
              ''
            )
              .trim()
              .toUpperCase()

      if (ehCargaPermanente) {
        const reBase =
          String(
            reDestinatario ||
            ''
          )
            .replace(/\D/g, '')
            .slice(0, 6)

        if (reBase.length !== 6) {
          throw new Error(
            'Informe os 6 dígitos do RE do destinatário.'
          )
        }

        if (!policialDestinatario?.id) {
          throw new Error(
            'Aguarde a localização de um policial válido para este RE.'
          )
        }

        const nome =
          policialDestinatario?.nome_guerra ||
          policialDestinatario?.nome ||
          'POLICIAL'

        destinoNome =
          `RE ${
            policialDestinatario?.re ||
            reBase
          } - ${nome}`
            .trim()
            .toUpperCase()
      } else if (!destinoNome) {
        throw new Error(
          'Informe a unidade ou destino da transferência.'
        )
      }

      await transferirMunicaoExterna({
        municaoId:
          municao.id,

        calibre:
          municao.calibre,

        quantidade:
          quantidadeFinal,

        destinoTipo:
          classificacao,

        destinoNome,

        documento,
        observacoes,
        user
      })

      await onSalvo?.()
      onClose?.()
    } catch (error) {
      setErroAcao(
        error?.message ||
        'Não foi possível registrar a transferência.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function encaminharManutencaoSvddAoP4(quantidadeSolicitada) {
    let restante =
      numero(
        quantidadeSolicitada
      )

    if (restante <= 0) {
      throw new Error(
        'Informe uma quantidade maior que zero.'
      )
    }

    const candidatos =
      [...manutencoesAtivas]
        .filter((item) => {
          const mesmaMunicao =
            String(
              item?.referencia_id ||
              ''
            ) ===
            String(
              municao?.id ||
              ''
            )

          const origemItem =
            normalizar(
              item?.origem
            )

          return (
            mesmaMunicao &&
            normalizar(
              item?.status
            ) === 'EM_MANUTENCAO' &&
            numero(
              item?.quantidade
            ) > 0 &&
            (
              origemItem.includes(
                'SVDD'
              ) ||
              origemItem.includes(
                'SERVICO DE DIA'
              )
            )
          )
        })
        .sort((a, b) => {
          const dataA =
            new Date(
              a?.criado_em ||
              a?.registrada_em ||
              a?.created_at ||
              0
            ).getTime()

          const dataB =
            new Date(
              b?.criado_em ||
              b?.registrada_em ||
              b?.created_at ||
              0
            ).getTime()

          return dataA - dataB
        })

    const totalDisponivel =
      candidatos.reduce(
        (soma, item) =>
          soma +
          numero(
            item?.quantidade
          ),
        0
      )

    if (restante > totalDisponivel) {
      throw new Error(
        `Existem apenas ${totalDisponivel} unidade(s) deste calibre em manutenção no SVDD.`
      )
    }

    for (const manutencao of candidatos) {
      if (restante <= 0) {
        break
      }

      const quantidadeRegistro =
        numero(
          manutencao?.quantidade
        )

      if (quantidadeRegistro <= 0) {
        continue
      }

      const quantidadeEncaminhar =
        Math.min(
          quantidadeRegistro,
          restante
        )

      await criarTransferenciaManutencaoMunicaoPendente({
        manutencaoId:
          manutencao.id,

        quantidade:
          quantidadeEncaminhar,

        observacoes:
          [
            documento
              ? `DOCUMENTO: ${String(documento).trim().toUpperCase()}`
              : null,

            String(observacoes || '').trim()
              ? `OBSERVAÇÃO DO ENCAMINHAMENTO: ${String(observacoes).trim().toUpperCase()}`
              : null
          ]
            .filter(Boolean)
            .join(' | ') ||
          null,

        user
      })

      restante -=
        quantidadeEncaminhar
    }

    if (restante > 0) {
      throw new Error(
        'Não foi possível criar toda a solicitação de encaminhamento ao P4.'
      )
    }
  }

  async function salvarDescarga(event) {
    event.preventDefault()

    if (!ehDescarga) {
      return
    }

    try {
      setSalvando(true)
      setErroAcao('')

      if (!municao?.id) {
        throw new Error(
          'Selecione o calibre da munição.'
        )
      }

      const quantidadeFinal =
        numero(
          quantidade
        )

      if (quantidadeFinal <= 0) {
        throw new Error(
          'Informe uma quantidade maior que zero.'
        )
      }

      if (
        quantidadeFinal >
        saldoDisponivel
      ) {
        throw new Error(
          `Existem apenas ${saldoDisponivel} unidade(s) deste calibre em manutenção no P4.`
        )
      }

      if (!classificacao) {
        throw new Error(
          'Selecione o motivo da descarga.'
        )
      }

      const destinoFinal =
        String(
          destino ||
          ''
        )
          .trim()
          .toUpperCase()

      if (!destinoFinal) {
        throw new Error(
          'Informe o destino final da descarga.'
        )
      }

      await registrarDescargaManutencaoMunicaoP4({
        municaoId:
          municao.id,

        quantidade:
          quantidadeFinal,

        motivo:
          classificacao,

        destinoFinal,

        documento,
        observacoes,
        fotos:
          fotos.slice(0, 6),
        user
      })

      await onSalvo?.()
      onClose?.()
    } catch (error) {
      setErroAcao(
        error?.message ||
        'Não foi possível registrar a descarga.'
      )
    } finally {
      setSalvando(false)
    }
  }

  async function salvarManutencao(event) {
    event.preventDefault()

    if (!ehManutencao) {
      return
    }

    try {
      setSalvando(true)
      setErroAcao('')

      if (!municao?.id) {
        throw new Error(
          'Selecione o calibre da munição.'
        )
      }

      const quantidadeFinal =
        numero(
          quantidade
        )

      if (quantidadeFinal <= 0) {
        throw new Error(
          'Informe uma quantidade maior que zero.'
        )
      }

      if (
        quantidadeFinal >
        saldoDisponivel
      ) {
        throw new Error(
          encaminhaManutencaoSvdd
            ? `Existem apenas ${saldoDisponivel} unidade(s) deste calibre em manutenção no SVDD.`
            : `Existem apenas ${saldoDisponivel} unidade(s) disponíveis na origem.`
        )
      }

      if (encaminhaManutencaoSvdd) {
        await encaminharManutencaoSvddAoP4(
          quantidadeFinal
        )

        await onSalvo?.()
        onClose?.()
        return
      }

      if (!classificacao) {
        throw new Error(
          'Selecione o tipo da ocorrência.'
        )
      }

      if (!String(observacoes || '').trim()) {
        throw new Error(
          'Descreva a avaria, deterioração ou condição da munição.'
        )
      }

      const origemManutencao =
        'COFRE DO P4'

      await registrarManutencao({
        modulo:
          MODULOS_MANUTENCAO.MUNICAO,

        tipoMaterial:
          'MUNICAO',

        referenciaId:
          municao.id,

        quantidade:
          quantidadeFinal,

        tipoNovidade:
          classificacao,

        descricao:
          String(
            observacoes
          )
            .trim()
            .toUpperCase(),

        observacoes:
          [
            documento
              ? `DOCUMENTO: ${String(documento).trim().toUpperCase()}`
              : null,
            `CALIBRE: ${municao.calibre || 'NÃO INFORMADO'}`
          ]
            .filter(Boolean)
            .join(' | '),

        origem:
          origemManutencao,

        destino:
          'MANUTENCAO',

        fotos,
        user
      })

      await onSalvo?.()
      onClose?.()
    } catch (error) {
      setErroAcao(
        error?.message ||
        (
          encaminhaManutencaoSvdd
            ? 'Não foi possível encaminhar a manutenção ao P4.'
            : 'Não foi possível enviar a munição para manutenção.'
        )
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={config.titulo}
      subtitulo={config.subtitulo}
      onClose={onClose}
      amplo
    >
      <form
        onSubmit={
          ehTransferencia
            ? salvarTransferencia
            : ehManutencao
              ? salvarManutencao
              : ehDescarga
                ? salvarDescarga
                : (event) =>
                    event.preventDefault()
        }
      >
        {erroReservas && (
          <div
            className="municoes-alert municoes-alert-error"
            style={{
              marginBottom: '14px'
            }}
          >
            {erroReservas}
          </div>
        )}

        <div className="municoes-form-grid">
          <Campo label="ORIGEM">
            <input
              className="municoes-input municoes-input-readonly"
              value={
                origemNormalizada.includes(
                  'SVDD'
                )
                  ? 'SVDD'
                  : 'P4'
              }
              readOnly
            />
          </Campo>

          <Campo label="CALIBRE">
            <select
              autoFocus
              className="municoes-select"
              value={municaoId}
              disabled={
                carregandoReservas &&
                deveDescontarReservasP4
              }
              onChange={(event) => {
                setMunicaoId(
                  event.target.value
                )
                setQuantidade(
                  encaminhaManutencaoSvdd &&
                  event.target.value
                    ? ''
                    : ''
                )
              }}
            >
              <option value="">
                Selecione
              </option>

              {disponiveis.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.calibre} — {numero(
                      item
                        ?.quantidade_disponivel_origem
                    )}{encaminhaManutencaoSvdd
                      ? ' em manutenção no SVDD'
                      : ehDescarga
                        ? ' em manutenção no P4'
                        : ' disponível(is)'}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo
            label={
              encaminhaManutencaoSvdd
                ? 'QUANTIDADE A ENCAMINHAR'
                : 'QUANTIDADE'
            }
          >
            <input
              className="municoes-input"
              type="number"
              min="1"
              max={
                saldoDisponivel || undefined
              }
              value={quantidade}
              onChange={(event) => {
                setQuantidade(
                  event.target.value
                )
              }}
              disabled={!municao}
            />
          </Campo>

          <Campo
            label={
              encaminhaManutencaoSvdd
                ? 'EM MANUTENÇÃO NO SVDD'
                : ehDescarga
                  ? 'EM MANUTENÇÃO NO P4'
                  : 'DISPONÍVEL NA ORIGEM'
            }
          >
            <input
              className="municoes-input municoes-input-readonly"
              value={
                saldoDisponivel.toLocaleString(
                  'pt-BR'
                )
              }
              readOnly
            />
          </Campo>

          {ehManutencao && (
            <>
              {!encaminhaManutencaoSvdd && (
                <Campo label="TIPO DE OCORRÊNCIA">
                  <select
                    className="municoes-select"
                    value={classificacao}
                    onChange={(event) =>
                      setClassificacao(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Selecione
                    </option>

                    <option value="AVARIA">
                      AVARIA
                    </option>

                    <option value="DETERIORACAO">
                      DETERIORAÇÃO
                    </option>

                    <option value="UMIDADE_OXIDACAO">
                      UMIDADE / OXIDAÇÃO
                    </option>

                    <option value="EMBALAGEM_DANIFICADA">
                      EMBALAGEM DANIFICADA
                    </option>

                    <option value="VALIDADE">
                      VALIDADE / CONDIÇÃO
                    </option>

                    <option value="OUTRO">
                      OUTRO
                    </option>
                  </select>
                </Campo>
              )}

              <Campo label="DESTINO">
                <input
                  className="municoes-input municoes-input-readonly"
                  value="MANUTENÇÃO P4"
                  readOnly
                />
              </Campo>
            </>
          )}

          {ehTransferencia && ehCargaPermanente && (
            <>
              <Campo label="RE DO DESTINATÁRIO">
                <input
                  className="municoes-input"
                  inputMode="numeric"
                  maxLength={6}
                  value={reDestinatario}
                  onChange={(event) => {
                    setReDestinatario(
                      String(
                        event.target.value ||
                        ''
                      )
                        .replace(/\D/g, '')
                        .slice(0, 6)
                    )

                    setPolicialDestinatario(
                      null
                    )
                    setErroAcao('')
                  }}
                  placeholder="6 dígitos do RE"
                />
              </Campo>

              <Campo label="POLICIAL DESTINATÁRIO">
                <input
                  className="municoes-input municoes-input-readonly"
                  value={
                    buscandoPolicial
                      ? 'LOCALIZANDO...'
                      : policialDestinatario
                        ? [
                            policialDestinatario.posto_graduacao,
                            policialDestinatario.nome_guerra ||
                            policialDestinatario.nome
                          ]
                            .filter(Boolean)
                            .join(' ')
                        : 'AGUARDANDO RE VÁLIDO'
                  }
                  readOnly
                />
              </Campo>
            </>
          )}

          {ehTransferencia && !ehCargaPermanente && (
            <Campo
              label={
                classificacao ===
                'OUTRAS_CIAS'
                  ? 'CIA / DESTINO'
                  : classificacao ===
                    'BATALHAO'
                    ? 'BATALHÃO / DESTINO'
                    : 'UNIDADE / DESTINO'
              }
              full
            >
              <input
                className={
                  classificacao ===
                  'BATALHAO'
                    ? 'municoes-input municoes-input-readonly'
                    : 'municoes-input'
                }
                value={
                  classificacao ===
                  'BATALHAO'
                    ? '27º BPM/M'
                    : destino
                }
                onChange={(event) => {
                  if (
                    classificacao ===
                    'BATALHAO'
                  ) {
                    return
                  }

                  setDestino(
                    event.target.value.toUpperCase()
                  )
                }}
                readOnly={
                  classificacao ===
                  'BATALHAO'
                }
                placeholder={
                  classificacao ===
                  'OUTRAS_CIAS'
                    ? 'Ex.: 1ª CIA'
                    : 'Informe a unidade ou destino'
                }
              />
            </Campo>
          )}

          {ehDescarga && (
            <>
              <Campo label="MOTIVO DA DESCARGA">
                <select
                  className="municoes-select"
                  value={classificacao}
                  onChange={(event) =>
                    setClassificacao(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Selecione
                  </option>

                  <option value="DANIFICADA">
                    DANIFICADA
                  </option>

                  <option value="DETERIORADA">
                    DETERIORADA
                  </option>

                  <option value="VENCIDA">
                    VENCIDA
                  </option>

                  <option value="RECOLHIMENTO">
                    RECOLHIMENTO / DEVOLUÇÃO
                  </option>

                  <option value="OUTRO">
                    OUTRO
                  </option>
                </select>
              </Campo>

              <Campo label="DESTINO FINAL">
                <input
                  className="municoes-input"
                  value={destino}
                  onChange={(event) =>
                    setDestino(
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="Destino, recolhimento ou órgão responsável"
                />
              </Campo>
            </>
          )}

          <Campo label="DOCUMENTO">
            <input
              className="municoes-input"
              value={documento}
              onChange={(event) =>
                setDocumento(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="Ofício, memorando, termo..."
            />
          </Campo>

          <Campo
            label={
              encaminhaManutencaoSvdd
                ? 'OBSERVAÇÃO DO ENCAMINHAMENTO'
                : ehManutencao
                  ? 'DESCRIÇÃO / OBSERVAÇÕES'
                  : 'OBSERVAÇÕES'
            }
            full
          >
            <textarea
              className="municoes-textarea"
              rows={4}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value.toUpperCase()
                )
              }
              placeholder={
                encaminhaManutencaoSvdd
                  ? 'Opcional: registre documento, orientação ou observação do encaminhamento ao P4.'
                  : ehManutencao
                    ? 'Descreva o dano, condição, lote envolvido ou motivo do envio.'
                    : 'Registre informações complementares desta operação.'
              }
            />
          </Campo>

          {((
            ehManutencao &&
            !encaminhaManutencaoSvdd
          ) ||
            ehDescarga) && (
            <Campo
              label="FOTOS"
              full
            >
              <input
                className="municoes-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setFotos(
                    Array.from(
                      event.target.files ||
                      []
                    ).slice(0, 6)
                  )
                }
              />

              <small
                style={{
                  color: '#667085',
                  fontWeight: 600,
                  letterSpacing: 0
                }}
              >
                {fotos.length
                  ? `${fotos.length} foto(s) selecionada(s).`
                  : 'Fotos da condição do material poderão compor o histórico da operação.'}
              </small>
            </Campo>
          )}
        </div>

        {erroAcao && (
          <div className="municoes-alert municoes-alert-error">
            {erroAcao}
          </div>
        )}

        <footer className="municoes-modal-actions">
          <button
            type="button"
            className="municoes-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type={
              ehTransferencia ||
              ehManutencao ||
              ehDescarga
                ? 'submit'
                : 'button'
            }
            className="municoes-btn-primary"
            disabled={
              ehTransferencia
                ? (
                    salvando ||
                    !municao ||
                    numero(
                      quantidade
                    ) <= 0 ||
                    (
                      ehCargaPermanente &&
                      (
                        buscandoPolicial ||
                        !policialDestinatario?.id
                      )
                    ) ||
                    (
                      !ehCargaPermanente &&
                      classificacao !==
                        'BATALHAO' &&
                      !String(
                        destino ||
                        ''
                      ).trim()
                    )
                  )
                : ehManutencao
                  ? encaminhaManutencaoSvdd
                    ? (
                        salvando ||
                        !municao ||
                        saldoDisponivel <= 0
                      )
                    : (
                        salvando ||
                        !municao ||
                        numero(
                          quantidade
                        ) <= 0 ||
                        !classificacao ||
                        !String(
                          observacoes ||
                          ''
                        ).trim()
                      )
                  : ehDescarga
                    ? (
                        salvando ||
                        !municao ||
                        numero(
                          quantidade
                        ) <= 0 ||
                        numero(
                          quantidade
                        ) > saldoDisponivel ||
                        !classificacao ||
                        !String(
                          destino ||
                          ''
                        ).trim()
                      )
                    : true
            }
            title=""
          >
            {salvando
              ? 'Salvando...'
              : config.confirmar}
          </button>
        </footer>
      </form>
    </Modal>
  )
}


function DestinoTransferenciaModal({
  onClose,
  onSelecionar
}) {
  const destinos = [
    {
      id: 'SVDD',
      titulo: 'SVDD',
      descricao:
        'Transferir munições para o Serviço de Dia.'
    },
    {
      id: 'CARGA_PERMANENTE',
      titulo: 'Carga permanente',
      descricao:
        'Destinar munições para carga permanente.'
    },
    {
      id: 'OUTRAS_CIAS',
      titulo: 'Outras Cias',
      descricao:
        'Transferir para outra Companhia.'
    },
    {
      id: 'BATALHAO',
      titulo: 'Batalhão',
      descricao:
        'Transferir para carga do Batalhão.'
    },
    {
      id: 'OUTRA_UNIDADE',
      titulo: 'Outra unidade / Outros',
      descricao:
        'Registrar transferência para outro destino ou unidade.'
    }
  ]

  return (
    <Modal
      titulo="Transferir munição"
      subtitulo="Escolha o destino da movimentação."
      onClose={onClose}
      amplo
    >
      <div className="municoes-operation-actions">
        {destinos.map(
          (destino) => (
            <button
              type="button"
              key={destino.id}
              onClick={() =>
                onSelecionar?.(
                  destino.id
                )
              }
            >
              <strong>
                {destino.titulo}
              </strong>

              <span>
                {destino.descricao}
              </span>
            </button>
          )
        )}
      </div>
    </Modal>
  )
}

function CancelarMovimentacaoModal({
  onClose,
  onSalvo
}) {
  const [lista, setLista] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const [
    cancelandoId,
    setCancelandoId
  ] = useState(null)

  const [
    erroAcao,
    setErroAcao
  ] = useState('')

  useEffect(() => {
    let ativo = true

    listarTransferenciasPendentes(
      'SAIDA'
    )
      .then((resultado) => {
        if (ativo) {
          setLista(
            resultado || []
          )
        }
      })
      .catch((error) => {
        if (ativo) {
          setErro(
            error?.message ||
            'Não foi possível consultar as movimentações pendentes.'
          )
        }
      })
      .finally(() => {
        if (ativo) {
          setLoading(false)
        }
      })

    return () => {
      ativo = false
    }
  }, [])

  async function cancelar(item) {
    if (
      !item?.transferencia_id
    ) {
      return
    }

    try {
      setCancelandoId(
        item.transferencia_id
      )
      setErroAcao('')

      await cancelarTransferenciaPendente(
        item.transferencia_id
      )

      await onSalvo?.()

      onClose?.()
    } catch (error) {
      setErroAcao(
        error?.message ||
        'Não foi possível cancelar a movimentação.'
      )
    } finally {
      setCancelandoId(
        null
      )
    }
  }

  return (
    <Modal
      titulo="Cancelar movimentação"
      subtitulo="Transferências enviadas e ainda não recebidas pelo destino."
      onClose={onClose}
      amplo
    >
      {loading ? (
        <div className="municoes-loading">
          Carregando movimentações...
        </div>
      ) : erro ? (
        <div className="municoes-alert municoes-alert-error">
          {erro}
        </div>
      ) : lista.length === 0 ? (
        <div className="municoes-modal-empty">
          Nenhuma movimentação pendente para cancelamento.
        </div>
      ) : (
        <>
          {erroAcao && (
            <div className="municoes-alert municoes-alert-error">
              {erroAcao}
            </div>
          )}

          <div className="municoes-table-wrap">
          <table className="municoes-table">
            <thead>
              <tr>
                <th>CALIBRE</th>
                <th>QUANTIDADE</th>
                <th>ORIGEM</th>
                <th>DESTINO</th>
                <th>STATUS</th>
                <th>DATA</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {lista.map(
                (item) => (
                  <tr
                    key={
                      item.transferencia_id
                    }
                  >
                    <td>
                      <strong>
                        {item.calibre}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {numero(
                          item.quantidade_total
                        )}
                      </strong>
                    </td>

                    <td>
                      {item.origem_nome || '—'}
                    </td>

                    <td>
                      {item.destino_nome || '—'}
                    </td>

                    <td>
                      <span className="municoes-validade-badge municoes-validade-alerta">
                        {item.status}
                      </span>
                    </td>

                    <td>
                      {item.criado_em
                        ? new Date(
                            item.criado_em
                          ).toLocaleString(
                            'pt-BR'
                          )
                        : '—'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="municoes-btn-secondary municoes-btn-small"
                        disabled={
                          cancelandoId ===
                          item.transferencia_id
                        }
                        onClick={() =>
                          cancelar(
                            item
                          )
                        }
                        title="Cancelar esta transferência pendente"
                      >
                        {cancelandoId ===
                        item.transferencia_id
                          ? 'Cancelando...'
                          : 'Cancelar'}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          </div>
        </>
      )}
    </Modal>
  )
}

function RecebimentoMunicaoModal({
  tipo,
  perfilP4,
  onClose,
  onSalvo
}) {
  const [lista, setLista] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const [
    recebendoId,
    setRecebendoId
  ] = useState(null)

  const [
    erroAcao,
    setErroAcao
  ] = useState('')

  const ehDevolucao =
    tipo === 'DEVOLUCAO'

  useEffect(() => {
    let ativo = true

    setLoading(true)
    setErro('')
    setErroAcao('')

    const consulta =
      ehDevolucao
        ? listarDevolucoesMunicaoPendentesSvdd()
        : listarTransferenciasPendentes(
            'ENTRADA'
          )

    consulta
      .then((resultado) => {
        if (ativo) {
          setLista(
            resultado || []
          )
        }
      })
      .catch((error) => {
        if (ativo) {
          setErro(
            error?.message ||
            (
              ehDevolucao
                ? 'Não foi possível consultar as devoluções pendentes de munição.'
                : 'Não foi possível consultar as munições pendentes de recebimento.'
            )
          )
        }
      })
      .finally(() => {
        if (ativo) {
          setLoading(false)
        }
      })

    return () => {
      ativo = false
    }
  }, [
    tipo,
    ehDevolucao
  ])

  async function receber(item) {
    const idOperacao =
      ehDevolucao
        ? item?.devolucao_id
        : item?.transferencia_id

    if (!idOperacao) {
      return
    }

    try {
      setRecebendoId(
        idOperacao
      )
      setErroAcao('')

      if (ehDevolucao) {
        await receberDevolucaoMunicaoSvdd(
          idOperacao
        )
      } else if (
        item.destino_tipo ===
        'COFRE_SVDD'
      ) {
        await receberTransferenciaPendente(
          item.transferencia_id
        )
      } else if (
        item.destino_tipo ===
        'COFRE_P4'
      ) {
        await receberTransferenciaSvddP4(
          item.transferencia_id
        )
      } else {
        throw new Error(
          'Destino de transferência ainda não suportado para recebimento.'
        )
      }

      await onSalvo?.()

      onClose?.()
    } catch (error) {
      setErroAcao(
        error?.message ||
        (
          ehDevolucao
            ? 'Não foi possível receber a devolução de munição.'
            : 'Não foi possível receber a transferência.'
        )
      )
    } finally {
      setRecebendoId(
        null
      )
    }
  }

  const config =
    ehDevolucao
      ? {
          titulo:
            'Receber devolução',

          subtitulo:
            'Confira fisicamente a munição devolvida pelo policial. O saldo só retorna ao SVDD após a confirmação.'
        }
      : {
          titulo:
            perfilP4
              ? 'Receber do SVDD'
              : 'Receber do P4',

          subtitulo:
            perfilP4
              ? 'Transferências devolvidas pelo SVDD e pendentes de recebimento.'
              : 'Transferências enviadas pelo P4 e pendentes de recebimento.'
        }

  return (
    <Modal
      titulo={config.titulo}
      subtitulo={config.subtitulo}
      onClose={onClose}
      amplo
    >
      {loading ? (
        <div className="municoes-loading">
          {ehDevolucao
            ? 'Carregando devoluções...'
            : 'Carregando recebimentos...'}
        </div>
      ) : erro ? (
        <div className="municoes-alert municoes-alert-error">
          {erro}
        </div>
      ) : lista.length === 0 ? (
        <div className="municoes-modal-empty">
          {ehDevolucao
            ? 'Nenhuma devolução de munição está pendente para o SVDD.'
            : 'Nenhuma munição pendente de recebimento.'}
        </div>
      ) : ehDevolucao ? (
        <>
          {erroAcao && (
            <div className="municoes-alert municoes-alert-error">
              {erroAcao}
            </div>
          )}

          <div className="municoes-table-wrap">
            <table className="municoes-table">
              <thead>
                <tr>
                  <th>RE</th>
                  <th>POLICIAL</th>
                  <th>CALIBRE</th>
                  <th>QUANTIDADE</th>
                  <th>SOLICITADO EM</th>
                  <th>OBSERVAÇÕES</th>
                  <th>AÇÃO</th>
                </tr>
              </thead>

              <tbody>
                {lista.map(
                  (item) => (
                    <tr
                      key={
                        item.devolucao_id
                      }
                    >
                      <td>
                        {item.policial_re || '—'}
                      </td>

                      <td>
                        <strong>
                          {item.policial_nome || '—'}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {item.calibre || '—'}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {numero(
                            item.quantidade
                          )}
                        </strong>
                      </td>

                      <td>
                        {item.solicitado_em
                          ? new Date(
                              item.solicitado_em
                            ).toLocaleString(
                              'pt-BR'
                            )
                          : '—'}
                      </td>

                      <td>
                        {item.observacoes || '—'}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="municoes-btn-primary municoes-btn-small"
                          disabled={
                            recebendoId ===
                            item.devolucao_id
                          }
                          onClick={() =>
                            receber(
                              item
                            )
                          }
                          title="Confirmar recebimento físico da munição no SVDD"
                        >
                          {recebendoId ===
                          item.devolucao_id
                            ? 'Recebendo...'
                            : 'Receber'}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {erroAcao && (
            <div className="municoes-alert municoes-alert-error">
              {erroAcao}
            </div>
          )}

          <div className="municoes-table-wrap">
            <table className="municoes-table">
              <thead>
                <tr>
                  <th>CALIBRE</th>
                  <th>QUANTIDADE</th>
                  <th>ORIGEM</th>
                  <th>DESTINO</th>
                  <th>STATUS</th>
                  <th>DATA</th>
                  <th>AÇÃO</th>
                </tr>
              </thead>

              <tbody>
                {lista.map(
                  (item) => (
                    <tr
                      key={
                        item.transferencia_id
                      }
                    >
                      <td>
                        <strong>
                          {item.calibre}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {numero(
                            item.quantidade_total
                          )}
                        </strong>
                      </td>

                      <td>
                        {item.origem_nome || '—'}
                      </td>

                      <td>
                        {item.destino_nome || '—'}
                      </td>

                      <td>
                        <span className="municoes-validade-badge municoes-validade-alerta">
                          {item.status}
                        </span>
                      </td>

                      <td>
                        {item.criado_em
                          ? new Date(
                              item.criado_em
                            ).toLocaleString(
                              'pt-BR'
                            )
                          : '—'}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="municoes-btn-primary municoes-btn-small"
                          disabled={
                            recebendoId ===
                              item.transferencia_id ||
                            ![
                              'COFRE_SVDD',
                              'COFRE_P4'
                            ].includes(
                              item.destino_tipo
                            )
                          }
                          onClick={() =>
                            receber(
                              item
                            )
                          }
                          title={
                            item.destino_tipo ===
                            'COFRE_SVDD'
                              ? 'Confirmar recebimento no Cofre do SVDD'
                              : item.destino_tipo ===
                                'COFRE_P4'
                                ? 'Confirmar recebimento no Cofre do P4'
                                : 'Este fluxo de recebimento será ligado em etapa própria.'
                          }
                        >
                          {recebendoId ===
                          item.transferencia_id
                            ? 'Recebendo...'
                            : 'Receber'}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}

function RetornoManutencaoModal({
  user,
  onClose,
  onSalvo
}) {
  const [lista, setLista] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const [
    selecionada,
    setSelecionada
  ] = useState(null)

  const [
    servicoExecutado,
    setServicoExecutado
  ] = useState('')

  const [
    observacoesRetorno,
    setObservacoesRetorno
  ] = useState('')

  const [fotosRetorno, setFotosRetorno] =
    useState([])

  const [salvando, setSalvando] =
    useState(false)

  async function carregarManutencoes() {
    try {
      setLoading(true)
      setErro('')

      const resultado =
        await listarManutencoes({
          modulo:
            MODULOS_MANUTENCAO.MUNICAO,
          status:
            'EM_MANUTENCAO',
          pagina:
            1,
          limite:
            200
        })

      const perfilAtual =
        obterPerfil(user)

      const manutencoesDoGuardiao =
        (resultado?.data || []).filter(
          (item) => {
            const origemItem =
              normalizar(item?.origem)

            if (
              perfilAtual === 'P4' ||
              perfilAtual.includes('ADMINISTRADOR')
            ) {
              return origemItem.includes('P4')
            }

            if (
              perfilAtual.includes('SVDD') ||
              perfilAtual.includes('SERVICO DE DIA')
            ) {
              return (
                origemItem.includes('SVDD') ||
                origemItem.includes('SERVICO DE DIA')
              )
            }

            return false
          }
        )

      setLista(
        manutencoesDoGuardiao
      )
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível carregar as munições em manutenção.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarManutencoes()
  }, [])

  function abrirRetorno(item) {
    setSelecionada(
      item
    )
    setServicoExecutado('')
    setObservacoesRetorno('')
    setFotosRetorno([])
    setErro('')
  }

  async function confirmarRetorno(event) {
    event.preventDefault()

    if (!selecionada?.id) {
      return
    }

    if (!String(
      servicoExecutado ||
      ''
    ).trim()) {
      setErro(
        'Informe o serviço executado ou a solução adotada.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await concluirManutencao({
        manutencaoId:
          selecionada.id,

        servicoExecutado:
          servicoExecutado
            .trim()
            .toUpperCase(),

        observacoes:
          observacoesRetorno
            .trim()
            .toUpperCase(),

        fotos:
          fotosRetorno,

        user
      })

      setSelecionada(null)
      setServicoExecutado('')
      setObservacoesRetorno('')
      setFotosRetorno([])

      await carregarManutencoes()
      await onSalvo?.()
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível registrar o retorno da manutenção.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo="Receber manutenção"
      subtitulo="Mesmo fluxo de retorno usado pelo módulo de HT: registrar o serviço executado e devolver a munição ao guardião de origem."
      onClose={onClose}
      amplo
    >
      {erro && (
        <div className="municoes-alert municoes-alert-error">
          {erro}
        </div>
      )}

      {selecionada ? (
        <form
          onSubmit={
            confirmarRetorno
          }
        >
          <div className="municoes-form-grid">
            <Campo label="CALIBRE">
              <input
                className="municoes-input municoes-input-readonly"
                value={
                  selecionada.calibre ||
                  selecionada.descricao_municao ||
                  'MUNIÇÃO'
                }
                readOnly
              />
            </Campo>

            <Campo label="QUANTIDADE">
              <input
                className="municoes-input municoes-input-readonly"
                value={
                  numero(
                    selecionada.quantidade
                  )
                }
                readOnly
              />
            </Campo>

            <Campo label="OCORRÊNCIA">
              <input
                className="municoes-input municoes-input-readonly"
                value={
                  selecionada.tipo_novidade ||
                  'MANUTENÇÃO'
                }
                readOnly
              />
            </Campo>

            <Campo label="RETORNO PREVISTO">
              <input
                className="municoes-input municoes-input-readonly"
                value={
                  normalizar(
                    selecionada.origem
                  ).includes('SVDD')
                    ? 'COFRE DO SVDD'
                    : 'COFRE DO P4'
                }
                readOnly
              />
            </Campo>

            <Campo
              label="DESCRIÇÃO DA ENTRADA"
              full
            >
              <textarea
                className="municoes-textarea"
                rows={3}
                value={
                  selecionada.descricao ||
                  ''
                }
                readOnly
              />
            </Campo>

            <Campo
              label="SERVIÇO EXECUTADO *"
              full
            >
              <textarea
                className="municoes-textarea"
                rows={3}
                value={
                  servicoExecutado
                }
                onChange={(event) =>
                  setServicoExecutado(
                    event.target.value.toUpperCase()
                  )
                }
                placeholder="Descreva a providência adotada, conferência, separação ou solução."
                disabled={
                  salvando
                }
              />
            </Campo>

            <Campo
              label="OBSERVAÇÕES DO RETORNO"
              full
            >
              <textarea
                className="municoes-textarea"
                rows={3}
                value={
                  observacoesRetorno
                }
                onChange={(event) =>
                  setObservacoesRetorno(
                    event.target.value.toUpperCase()
                  )
                }
                placeholder="Condição final e demais informações."
                disabled={
                  salvando
                }
              />
            </Campo>

            <Campo
              label="FOTOS DO RETORNO"
              full
            >
              <input
                className="municoes-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setFotosRetorno(
                    Array.from(
                      event.target.files ||
                      []
                    ).slice(0, 6)
                  )
                }
                disabled={
                  salvando
                }
              />
            </Campo>
          </div>

          <footer className="municoes-modal-actions">
            <button
              type="button"
              className="municoes-btn-secondary"
              onClick={() =>
                setSelecionada(
                  null
                )
              }
              disabled={
                salvando
              }
            >
              Voltar
            </button>

            <button
              type="submit"
              className="municoes-btn-primary"
              disabled={
                salvando ||
                !String(
                  servicoExecutado ||
                  ''
                ).trim()
              }
            >
              {salvando
                ? 'Registrando retorno...'
                : 'Tornar disponível'}
            </button>
          </footer>
        </form>
      ) : loading ? (
        <div className="municoes-modal-empty">
          Carregando manutenções...
        </div>
      ) : lista.length === 0 ? (
        <div className="municoes-modal-empty">
          Nenhuma manutenção ativa de munição.
        </div>
      ) : (
        <div className="municoes-table-wrap">
          <table className="municoes-table">
            <thead>
              <tr>
                <th>CALIBRE</th>
                <th>QUANTIDADE</th>
                <th>OCORRÊNCIA</th>
                <th>ORIGEM</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {lista.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.calibre ||
                        item.descricao_municao ||
                        'MUNIÇÃO'}
                      </strong>
                    </td>

                    <td>
                      {numero(
                        item.quantidade
                      )}
                    </td>

                    <td>
                      {item.tipo_novidade ||
                      'MANUTENÇÃO'}
                    </td>

                    <td>
                      {item.origem ||
                      '—'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="municoes-btn-primary municoes-btn-small"
                        onClick={() =>
                          abrirRetorno(
                            item
                          )
                        }
                      >
                        Receber
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}


function PoliciaisLoteModal({
  lote = null,
  calibre = '',
  onClose
}) {
  const [lista, setLista] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const consultaPorLote =
    Boolean(
      lote?.lote_id
    )

  const calibreConsulta =
    normalizar(
      lote?.calibre ||
      calibre
    )

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        setLoading(true)
        setErro('')

        if (consultaPorLote) {
          const resultado =
            await listarPoliciaisComLote({
              loteId:
                lote.lote_id
            })

          if (ativo) {
            setLista(
              resultado || []
            )
          }

          return
        }

        if (!calibreConsulta) {
          if (ativo) {
            setLista([])
          }
          return
        }

        /*
         * Consulta por calibre via RPC segura.
         * Funciona no P4 e no SVDD sem expor lote.
         */
        const resultado =
          await listarPoliciaisMunicaoPorCalibre(
            calibreConsulta
          )

        if (ativo) {
          setLista(
            (resultado || [])
              .filter(
                (item) =>
                  numero(
                    item?.quantidade_em_posse
                  ) > 0
              )
              .sort(
                (a, b) =>
                  String(
                    a?.policial_nome ||
                    ''
                  ).localeCompare(
                    String(
                      b?.policial_nome ||
                      ''
                    ),
                    'pt-BR'
                  )
              )
          )
        }
      } catch (error) {
        if (ativo) {
          setErro(
            error?.message ||
            'Não foi possível consultar os policiais.'
          )
        }
      } finally {
        if (ativo) {
          setLoading(false)
        }
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [
    lote,
    calibreConsulta,
    consultaPorLote
  ])

  return (
    <Modal
      titulo={
        consultaPorLote
          ? `Rastreio do lote ${lote.numero_lote}`
          : `Policiais com munição • ${calibreConsulta}`
      }
      subtitulo={
        consultaPorLote
          ? `${lote.calibre} • Lote ${lote.numero_lote}`
          : `${calibreConsulta} • todos os lotes`
      }
      onClose={onClose}
      amplo
    >
      {loading ? (
        <div className="municoes-loading">
          Carregando...
        </div>
      ) : erro ? (
        <div className="municoes-alert municoes-alert-error">
          {erro}
        </div>
      ) : lista.length === 0 ? (
        <div className="municoes-modal-empty">
          {consultaPorLote
            ? 'Nenhum policial está com munição deste lote.'
            : 'Nenhum policial está com munição deste calibre.'}
        </div>
      ) : (
        <div className="municoes-table-wrap">
          <table className="municoes-table">
            <thead>
              <tr>
                <th>RE</th>
                <th>POLICIAL</th>
                <th>QUANTIDADE</th>
                <th>PRIMEIRA RETIRADA</th>
                <th>DEVOLUÇÃO PREVISTA</th>
              </tr>
            </thead>

            <tbody>
              {lista.map(
                (item) => (
                  <tr
                    key={`${item.policial_id || item.policial_re}-${item.lote_id || calibreConsulta}`}
                  >
                    <td>
                      {item.policial_re || '—'}
                    </td>

                    <td>
                      <strong>
                        {item.policial_nome || '—'}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {numero(
                          item.quantidade_em_posse
                        )}
                      </strong>
                    </td>

                    <td>
                      {formatarData(
                        item.primeira_retirada
                      )}
                    </td>

                    <td>
                      {formatarData(
                        item.devolucao_prevista
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function OutrosLocaisModal({
  resumo,
  lotes,
  onClose
}) {
  const itens =
    useMemo(
      () =>
        resumo
          .map((item) => ({
            ...item,
            quantidade_outros:
              numero(
                item.quantidade_outros
              )
          }))
          .filter(
            (item) =>
              item.quantidade_outros > 0
          )
          .sort(
            (a, b) =>
              b.quantidade_outros -
              a.quantidade_outros
          ),
      [resumo]
    )

  function lotesOutros(
    municaoId
  ) {
    return lotes.filter(
      (lote) =>
        String(
          lote.municao_id
        ) ===
          String(
            municaoId
          ) &&
        numero(
          lote.quantidade_outros
        ) > 0
    )
  }

  const total =
    itens.reduce(
      (soma, item) =>
        soma +
        numero(
          item.quantidade_outros
        ),
      0
    )

  return (
    <Modal
      titulo="Munições em outros locais"
      subtitulo="Materiais temporariamente fora do P4, SVDD, carga permanente ou cautela individual."
      onClose={onClose}
      amplo
    >
      {itens.length === 0 ? (
        <div className="municoes-modal-empty">
          Nenhuma munição está registrada em outros locais.
        </div>
      ) : (
        <>
          <div
            className="municoes-resumo-card"
            style={{
              marginBottom: '14px'
            }}
          >
            <span>
              TOTAL EM OUTROS
            </span>

            <strong>
              {total.toLocaleString(
                'pt-BR'
              )}
            </strong>

            <small>
              Quantidade atualmente fora dos locais principais
            </small>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '10px'
            }}
          >
            {itens.map(
              (item) => {
                const lotesItem =
                  lotesOutros(
                    item.id
                  )

                return (
                  <article
                    key={
                      item.id
                    }
                    className="municoes-calibre-card"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        padding: '14px 16px'
                      }}
                    >
                      <div>
                        <small
                          style={{
                            display: 'block',
                            color: '#64748b',
                            fontWeight: 800,
                            fontSize: '0.7rem'
                          }}
                        >
                          CALIBRE
                        </small>

                        <strong
                          style={{
                            color: '#153f70',
                            fontSize: '1rem'
                          }}
                        >
                          {item.calibre}
                        </strong>
                      </div>

                      <div
                        style={{
                          textAlign: 'right'
                        }}
                      >
                        <small
                          style={{
                            display: 'block',
                            color: '#64748b',
                            fontWeight: 800,
                            fontSize: '0.7rem'
                          }}
                        >
                          EM OUTROS
                        </small>

                        <strong
                          style={{
                            color: '#172033',
                            fontSize: '1.2rem'
                          }}
                        >
                          {numero(
                            item.quantidade_outros
                          ).toLocaleString(
                            'pt-BR'
                          )}
                        </strong>
                      </div>
                    </div>

                    {lotesItem.length > 0 && (
                      <div className="municoes-lotes-area">
                        <div className="municoes-lotes-box">
                          <div className="municoes-table-wrap">
                            <table className="municoes-table">
                              <thead>
                                <tr>
                                  <th>LOTE</th>
                                  <th>QUANTIDADE</th>
                                </tr>
                              </thead>

                              <tbody>
                                {lotesItem.map(
                                  (lote) => (
                                    <tr
                                      key={
                                        lote.lote_id ||
                                        `${item.id}-${lote.numero_lote}`
                                      }
                                    >
                                      <td>
                                        <strong>
                                          {lote.numero_lote}
                                        </strong>
                                      </td>

                                      <td>
                                        {numero(
                                          lote.quantidade_outros
                                        )}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                )
              }
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

export default function Municoes({
  user,
  onVoltar = null
}) {
  const [resumo, setResumo] =
    useState([])

  const [lotes, setLotes] =
    useState([])

  const [
    manutencoesAtivas,
    setManutencoesAtivas
  ] = useState([])

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const [mensagem, setMensagem] =
    useState('')

  const [
    filtroCalibre,
    setFiltroCalibre
  ] = useState('')

  const [
    filtroLote,
    setFiltroLote
  ] = useState('')

  const [modalCalibre, setModalCalibre] =
    useState(false)

  const [
    transferencia,
    setTransferencia
  ] = useState(null)

  const [
    seletorTransferencia,
    setSeletorTransferencia
  ] = useState(null)

  const [
    loteRastreio,
    setLoteRastreio
  ] = useState(null)

  const [
    modalOutros,
    setModalOutros
  ] = useState(false)

  const [
    operacaoEspecial,
    setOperacaoEspecial
  ] = useState(null)

  const [
    destinoTransferenciaAberto,
    setDestinoTransferenciaAberto
  ] = useState(false)

  const [
    cancelamentoMovimentacao,
    setCancelamentoMovimentacao
  ] = useState(false)

  const [
    recebimentoOperacao,
    setRecebimentoOperacao
  ] = useState(null)

  const [
    retornoManutencao,
    setRetornoManutencao
  ] = useState(false)

  const gerenciaLotes =
    useMemo(
      () => podeGerenciarLotes(user),
      [user]
    )

  const visaoP4 =
    useMemo(
      () => podeVerVisaoP4(user),
      [user]
    )

  const carregar =
    useCallback(async () => {
      try {
        setLoading(true)
        setErro('')

        const [
          resumoData,
          lotesData,
          manutencoesData
        ] = await Promise.all([
          listarResumoMunicoes(),

          visaoP4
            ? listarLotesResumo()
            : Promise.resolve([]),

          listarManutencoes({
            modulo:
              MODULOS_MANUTENCAO.MUNICAO,
            status:
              'EM_MANUTENCAO',
            pagina:
              1,
            limite:
              500
          })
        ])

        setResumo(
          resumoData || []
        )

        setLotes(
          lotesData || []
        )

        setManutencoesAtivas(
          manutencoesData?.data || []
        )
      } catch (error) {
        console.error(error)

        setErro(
          error?.message ||
          'Não foi possível carregar o módulo de munições.'
        )
      } finally {
        setLoading(false)
      }
    }, [visaoP4])

  useEffect(() => {
    carregar()
  }, [carregar])

  const calibresDisponiveis =
    useMemo(
      () =>
        [...resumo]
          .map(
            (item) =>
              item.calibre
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              String(a).localeCompare(
                String(b),
                'pt-BR'
              )
          ),
      [resumo]
    )

  const lotesDisponiveis =
    useMemo(() => {
      const calibre =
        normalizar(
          filtroCalibre
        )

      return [...lotes]
        .filter(
          (item) =>
            item.numero_lote &&
            (
              !calibre ||
              normalizar(
                item.calibre
              ) === calibre
            )
        )
        .sort(
          (a, b) =>
            String(
              a.numero_lote
            ).localeCompare(
              String(
                b.numero_lote
              ),
              'pt-BR'
            )
        )
    }, [
      lotes,
      filtroCalibre
    ])

  const loteSelecionado =
    useMemo(() => {
      const termo =
        normalizar(
          filtroLote
        )

      if (!termo) {
        return null
      }

      const calibre =
        normalizar(
          filtroCalibre
        )

      return (
        lotes.find(
          (item) =>
            normalizar(
              item.numero_lote
            ) === termo &&
            (
              !calibre ||
              normalizar(
                item.calibre
              ) === calibre
            )
        ) ||
        null
      )
    }, [
      filtroLote,
      filtroCalibre,
      lotes
    ])

  const resumoFiltrado =
    useMemo(() => {
      const calibre =
        normalizar(
          filtroCalibre
        )

      const lote =
        normalizar(
          filtroLote
        )

      const municoesDosLotes =
        lote
          ? new Set(
              lotes
                .filter(
                  (item) =>
                    normalizar(
                      item.numero_lote
                    ).includes(
                      lote
                    )
                )
                .map(
                  (item) =>
                    String(
                      item.municao_id
                    )
                )
            )
          : null

      return resumo.filter(
        (item) => {
          const atendeCalibre =
            !calibre ||
            normalizar(
              item.calibre
            ).includes(
              calibre
            )

          const atendeLote =
            !lote ||
            municoesDosLotes.has(
              String(
                item.id
              )
            )

          return (
            atendeCalibre &&
            atendeLote
          )
        }
      )
    }, [
      resumo,
      lotes,
      filtroCalibre,
      filtroLote
    ])

  const manutencaoSvddPorMunicao =
    useMemo(() => {
      const mapa = new Map()

      for (const item of manutencoesAtivas) {
        const origemManutencao =
          normalizar(
            item?.origem
          )

        const sobResponsabilidadeSvdd =
          origemManutencao.includes(
            'SVDD'
          ) ||
          origemManutencao.includes(
            'SERVICO DE DIA'
          )

        if (!sobResponsabilidadeSvdd) {
          continue
        }

        const referenciaId =
          String(
            item?.referencia_id ||
            ''
          )

        if (!referenciaId) {
          continue
        }

        mapa.set(
          referenciaId,
          numero(
            mapa.get(
              referenciaId
            )
          ) +
          numero(
            item?.quantidade
          )
        )
      }

      return mapa
    }, [manutencoesAtivas])

  const manutencaoSvddPorCalibre =
    useMemo(
      () =>
        resumo
          .map((item) => ({
            calibre:
              item.calibre ||
              'SEM CALIBRE',

            quantidade:
              numero(
                manutencaoSvddPorMunicao.get(
                  String(item.id)
                )
              )
          }))
          .filter(
            (item) =>
              item.quantidade > 0
          )
          .sort(
            (a, b) =>
              b.quantidade -
              a.quantidade
          ),
      [
        resumo,
        manutencaoSvddPorMunicao
      ]
    )

  const manutencaoP4PorMunicao =
    useMemo(() => {
      const mapa = new Map()

      for (const item of manutencoesAtivas) {
        const origemManutencao =
          normalizar(
            item?.origem
          )

        if (!origemManutencao.includes('P4')) {
          continue
        }

        const referenciaId =
          String(
            item?.referencia_id ||
            ''
          )

        if (!referenciaId) {
          continue
        }

        mapa.set(
          referenciaId,
          numero(
            mapa.get(
              referenciaId
            )
          ) +
          numero(
            item?.quantidade
          )
        )
      }

      return mapa
    }, [manutencoesAtivas])

  const manutencaoP4PorCalibre =
    useMemo(
      () =>
        resumo
          .map((item) => ({
            calibre:
              item.calibre ||
              'SEM CALIBRE',

            quantidade:
              numero(
                manutencaoP4PorMunicao.get(
                  String(item.id)
                )
              )
          }))
          .filter(
            (item) =>
              item.quantidade > 0
          )
          .sort(
            (a, b) =>
              b.quantidade -
              a.quantidade
          ),
      [
        resumo,
        manutencaoP4PorMunicao
      ]
    )

  const totalManutencaoSvdd =
    useMemo(
      () =>
        manutencaoSvddPorCalibre.reduce(
          (soma, item) =>
            soma +
            numero(
              item.quantidade
            ),
          0
        ),
      [manutencaoSvddPorCalibre]
    )

  const totalManutencaoP4 =
    useMemo(
      () =>
        manutencaoP4PorCalibre.reduce(
          (soma, item) =>
            soma +
            numero(
              item.quantidade
            ),
          0
        ),
      [manutencaoP4PorCalibre]
    )

  const totais =
    useMemo(
      () => ({
        total:
          resumo.reduce(
            (soma, item) =>
              soma +
              numero(
                item.quantidade_total_atual
              ),
            0
          ),

        p4:
          resumo.reduce(
            (soma, item) =>
              soma +
              numero(
                item.quantidade_p4
              ),
            0
          ),

        svdd:
          resumo.reduce(
            (soma, item) =>
              soma +
              numero(
                item.quantidade_svdd
              ),
            0
          ),

        servico:
          resumo.reduce(
            (soma, item) =>
              soma +
              numero(
                item.quantidade_em_servico
              ),
            0
          ),

        consumida:
          resumo.reduce(
            (soma, item) =>
              soma +
              numero(
                item.quantidade_consumida
              ),
            0
          )
      }),
      [resumo]
    )

  const validadeResumo =
    useMemo(() => {
      const resultado = {
        vencendo: 0,
        vencidas: 0
      }

      for (const lote of lotes) {
        const situacao =
          situacaoValidade(
            lote
          )

        if (
          situacao ===
          'VENCIDA'
        ) {
          resultado.vencidas += 1
        }

        if (
          situacao ===
          'ALERTA'
        ) {
          resultado.vencendo += 1
        }
      }

      return resultado
    }, [lotes])

  const dadosGrafico =
    useMemo(() => {
      const cargaPermanente =
        resumo.reduce(
          (soma, item) =>
            soma +
            numero(
              item.quantidade_carga_permanente
            ),
          0
        )

      const manutencao =
        resumo.reduce(
          (soma, item) =>
            soma +
            numero(
              item.quantidade_manutencao
            ),
          0
        )

      const outros =
        resumo.reduce(
          (soma, item) =>
            soma +
            numero(
              item.quantidade_outros
            ),
          0
        )

      const baixados =
        resumo.reduce(
          (soma, item) =>
            soma +
            numero(
              item.quantidade_baixada
            ),
          0
        )

      const comunsP4 = [
        {
          label:
            'Cofre do SVDD',
          valor:
            totais.svdd,
          cor:
            '#3b82f6'
        },
        {
          label:
            'Carga permanente',
          valor:
            cargaPermanente,
          cor:
            '#8b5cf6'
        },
        {
          label:
            'Em cautela',
          valor:
            totais.servico,
          cor:
            '#eab308'
        },
        {
          label:
            'Manutenção P4',
          valor:
            totalManutencaoP4,
          cor:
            '#ef4444'
        },
        {
          label:
            'Outros',
          valor:
            outros,
          cor:
            '#64748b'
        }
      ]

      if (!visaoP4) {
        return [
          {
            label:
              'Cofre do SVDD',
            valor:
              totais.svdd,
            cor:
              '#3b82f6'
          },
          {
            label:
              'Em cautela',
            valor:
              totais.servico,
            cor:
              '#eab308'
          },
          {
            label:
              'Manutenção',
            valor:
              totalManutencaoSvdd,
            cor:
              '#ef4444'
          },
          {
            label:
              'Baixados',
            valor:
              baixados,
            cor:
              '#f59e0b'
          },
        ]
      }

      return [
        {
          label:
            'Cofre do P4',
          valor:
            totais.p4,
          cor:
            '#22c55e'
        },
        ...comunsP4
      ]
    }, [
      visaoP4,
      resumo,
      totais.p4,
      totais.servico,
      totais.svdd,
      totalManutencaoP4,
      totalManutencaoSvdd
    ])

  const dadosGraficoCalibre =
    useMemo(
      () =>
        resumo
          .map((item) => ({
            label:
              item.calibre ||
              'SEM CALIBRE',

            valor:
              visaoP4
                ? numero(
                    item.quantidade_total_atual
                  )
                : numero(
                    item.quantidade_svdd
                  ),

            cor:
              '#1d5a9e'
          }))
          .filter(
            (item) =>
              item.valor > 0
          )
          .sort(
            (a, b) =>
              b.valor - a.valor
          ),
      [
        visaoP4,
        resumo
      ]
    )

  const distribuicaoPorLocal =
    useMemo(() => {
      const montar = (campo) =>
        resumo
          .map((item) => ({
            calibre:
              item.calibre ||
              'SEM CALIBRE',

            quantidade:
              numero(
                item[campo]
              )
          }))
          .filter(
            (item) =>
              item.quantidade > 0
          )
          .sort(
            (a, b) =>
              b.quantidade -
              a.quantidade
          )

      return {
        p4:
          montar(
            'quantidade_p4'
          ),

        svdd:
          montar(
            'quantidade_svdd'
          ),

        cargaPermanente:
          montar(
            'quantidade_carga_permanente'
          ),

        cautela:
          montar(
            'quantidade_em_servico'
          ),

        manutencao:
          montar(
            'quantidade_manutencao'
          ),

        outrasCias:
          montar(
            'quantidade_outras_cias'
          ),

        batalhao:
          montar(
            'quantidade_batalhao'
          ),

        baixados:
          montar(
            'quantidade_baixada'
          ),

        outros:
          montar(
            'quantidade_outros'
          )
      }
    }, [resumo])

  const totalGrafico =
    useMemo(
      () =>
        dadosGrafico.reduce(
          (soma, item) =>
            soma +
            numero(
              item.valor
            ),
          0
        ),
      [dadosGrafico]
    )

  const totalGraficoCalibre =
    useMemo(
      () =>
        dadosGraficoCalibre.reduce(
          (soma, item) =>
            soma +
            numero(
              item.valor
            ),
          0
        ),
      [dadosGraficoCalibre]
    )

  function lotesDoCalibre(
    municaoId
  ) {
    const termoLote =
      normalizar(
        filtroLote
      )

    return lotes.filter(
      (item) =>
        String(
          item.municao_id
        ) ===
          String(
            municaoId
          ) &&
        (
          !termoLote ||
          normalizar(
            item.numero_lote
          ).includes(
            termoLote
          )
        )
    )
  }

  async function aposAlteracao(
    mensagemSucesso
  ) {
    setMensagem(
      mensagemSucesso
    )

    await carregar()
  }

  return (
    <main className="municoes-page">
      <header className="municoes-header">
        <div>
          <span className="municoes-eyebrow">
            SIGMO • MATERIAL BÉLICO
          </span>

          <h1>Munições</h1>

          <p>
            Controle quantitativo por calibre com
            rastreabilidade interna por lote.
          </p>
        </div>

        <div className="municoes-header-actions">
          {typeof onVoltar === 'function' && (
            <button
              type="button"
              className="municoes-btn-secondary"
              onClick={onVoltar}
            >
              ← Voltar
            </button>
          )}

          <button
            type="button"
            className="municoes-btn-secondary"
            onClick={carregar}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>

          {gerenciaLotes && (
            <button
              type="button"
              className="municoes-btn-primary"
              onClick={() =>
                setModalCalibre(true)
              }
            >
              + Cadastrar munição
            </button>
          )}
        </div>
      </header>

      {erro && (
        <div className="municoes-alert municoes-alert-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="municoes-alert municoes-alert-success">
          {mensagem}
        </div>
      )}

      <section className="municoes-resumo-grid">
        {visaoP4 && (
          <CardResumo
            titulo="TOTAL CONTROLADO"
            valor={totais.total}
            subtitulo="Cofre P4 + Cofre SVDD + cautelas"
          />
        )}

        {visaoP4 && (
          <CardDistribuicao
            titulo="COFRE DO P4"
            itens={
              distribuicaoPorLocal.p4
            }
            subtitulo="Saldo por calibre"
          />
        )}

        <CardDistribuicao
          titulo="COFRE DO SVDD"
          itens={
            distribuicaoPorLocal.svdd
          }
          subtitulo="Saldo disponível por calibre"
        />

        {visaoP4 && (
          <CardDistribuicao
            titulo="CARGA PERMANENTE"
            itens={
              distribuicaoPorLocal.cargaPermanente
            }
            subtitulo="Saldo por calibre"
          />
        )}

        <CardDistribuicao
          titulo="CAUTELAS ATIVAS"
          itens={
            distribuicaoPorLocal.cautela
          }
          subtitulo="Com policiais"
        />

        <CardDistribuicao
          titulo="MANUTENÇÃO"
          itens={
            visaoP4
              ? manutencaoP4PorCalibre
              : manutencaoSvddPorCalibre
          }
          subtitulo={
            visaoP4
              ? 'Sob responsabilidade do P4'
              : 'Sob responsabilidade do SVDD'
          }
        />

        {visaoP4 && (
          <CardDistribuicao
            titulo="OUTRAS CIAS"
            itens={
              distribuicaoPorLocal.outrasCias
            }
            subtitulo="Outras companhias"
          />
        )}

        {visaoP4 && (
          <CardDistribuicao
            titulo="BATALHÃO"
            itens={
              distribuicaoPorLocal.batalhao
            }
            subtitulo="Carga do batalhão"
          />
        )}

        <CardDistribuicao
          titulo="BAIXADOS"
          itens={
            distribuicaoPorLocal.baixados
          }
          subtitulo="Baixas registradas"
        />

        {visaoP4 && (
          <CardDistribuicao
            titulo="OUTROS"
            itens={
              distribuicaoPorLocal.outros
            }
            subtitulo="Outra unidade ou destino"
          />
        )}
      </section>

      <section
        className="municoes-charts-grid"
        aria-label="Gráficos do estoque de munições"
      >
        <GraficoRoscaMunicoes
          total={totalGrafico}
          itens={dadosGrafico}
        />

        <GraficoBarrasMunicoes
          total={
            totalGraficoCalibre
          }
          itens={
            dadosGraficoCalibre
          }
          rotulo={
            visaoP4
              ? 'Estoque controlado'
              : 'Estoque do SVDD'
          }
        />
      </section>

      {visaoP4 && !gerenciaLotes ? (
        <section className="municoes-operations-section">
          <div className="municoes-operations-title">
            <div>
              <span>
                Acompanhamento
              </span>

              <h2>
                Movimentações de munições
              </h2>
            </div>
          </div>

          <div className="municoes-alert">
            O Comandante de Cia possui visão completa do estoque,
            lotes, distribuição e rastreabilidade. As ações de
            movimentação permanecem restritas ao perfil responsável.
          </div>
        </section>
      ) : (
      <section className="municoes-operations-section">
        <div className="municoes-operations-title">
          <div>
            <span>
              Operações permitidas
            </span>

            <h2>
              Movimentações de munições
            </h2>
          </div>
        </div>

        <div className="municoes-operation-groups">
          <GrupoOperacao
            icone="📦"
            titulo="Saídas e movimentações"
            descricao="Distribuição e movimentação de munições."
          >
            <button
              type="button"
              disabled={
                gerenciaLotes
                  ? totais.p4 <= 0
                  : totais.svdd <= 0
              }
              onClick={() => {
                if (gerenciaLotes) {
                  setDestinoTransferenciaAberto(
                    true
                  )
                } else {
                  setSeletorTransferencia(
                    'SVDD_P4'
                  )
                }
              }}
            >
              <strong>
                {gerenciaLotes
                  ? 'Transferir munição'
                  : 'Devolver ao P4'}
              </strong>

              <span>
                {gerenciaLotes
                  ? 'Escolher o destino e selecionar calibre e quantidade'
                  : 'Selecionar calibre e quantidade e devolver ao P4'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setCancelamentoMovimentacao(
                  true
                )
              }
            >
              <strong>
                Cancelar movimentação
              </strong>

              <span>
                Cancelar uma transferência que ainda não foi recebida
              </span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao
            icone="🛠️"
            titulo="Condição do material"
            descricao="Manutenção, recolhimento e descarga de munições."
          >
            <button
              type="button"
              disabled={
                gerenciaLotes
                  ? totais.p4 <= 0
                  : totalManutencaoSvdd <= 0
              }
              onClick={() =>
                setOperacaoEspecial({
                  tipo:
                    'MANUTENCAO',
                  origem:
                    gerenciaLotes
                      ? 'P4'
                      : 'SVDD'
                })
              }
            >
              <strong>
                {gerenciaLotes
                  ? 'Enviar para manutenção'
                  : 'Encaminhar manutenção ao P4'}
              </strong>

              <span>
                {gerenciaLotes
                  ? 'Registrar munição avariada ou deteriorada sob responsabilidade do P4'
                  : `${totalManutencaoSvdd} munição(ões) em manutenção no SVDD • envie uma, várias ou todas`}
              </span>
            </button>

            {gerenciaLotes && (
              <button
                type="button"
                disabled={
                  totalManutencaoP4 <= 0
                }
                onClick={() =>
                  setOperacaoEspecial({
                    tipo:
                      'DESCARGA',
                    origem:
                      'P4'
                  })
                }
              >
                <strong>
                  Descarga
                </strong>

                <span>
                  Retirar definitivamente munições do estoque ativo com justificativa e histórico
                </span>
              </button>
            )}
          </GrupoOperacao>

          <GrupoOperacao
            icone="📥"
            titulo="Entradas e recebimentos"
            descricao="Entrada, devolução e retorno de munições."
          >
            {gerenciaLotes && (
              <button
                type="button"
                onClick={() =>
                  setModalCalibre(
                    true
                  )
                }
              >
                <strong>
                  Receber material novo
                </strong>

                <span>
                  Cadastrar nova munição recebida pelo P4
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setRecebimentoOperacao(
                  'DEVOLUCAO'
                )
              }
            >
              <strong>
                Receber devolução
              </strong>

              <span>
                Encerrar carga ou cautela e receber novamente a munição
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setRecebimentoOperacao(
                  'ENTRE_ESTOQUES'
                )
              }
            >
              <strong>
                {gerenciaLotes
                  ? 'Receber do SVDD'
                  : 'Receber do P4'}
              </strong>

              <span>
                {gerenciaLotes
                  ? 'Confirmar munição devolvida pelo SVDD'
                  : 'Confirmar munição enviada pelo P4'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setRetornoManutencao(
                  true
                )
              }
            >
              <strong>
                Receber manutenção
              </strong>

              <span>
                Visualizar munições em reparo e acompanhar o retorno
              </span>
            </button>
          </GrupoOperacao>

          {gerenciaLotes && (
            <GrupoOperacao
              icone="🗂️"
              titulo="Gestão e rastreabilidade"
              descricao="Controle interno de lotes, validade e distribuição."
            >
              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector(
                      '.municoes-lotes-area'
                    )
                    ?.scrollIntoView({
                      behavior:
                        'smooth'
                    })
                }
              >
                <strong>
                  Validades e alertas
                </strong>

                <span>
                  Conferir lotes próximos do vencimento ou já vencidos
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector(
                      '.municoes-estoque-section'
                    )
                    ?.scrollIntoView({
                      behavior:
                        'smooth'
                    })
                }
              >
                <strong>
                  Rastreio por lote
                </strong>

                <span>
                  Selecionar calibre e lote para consultar policiais vinculados
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector(
                      '.municoes-resumo-grid'
                    )
                    ?.scrollIntoView({
                      behavior:
                        'smooth'
                    })
                }
              >
                <strong>
                  Acompanhar manutenção
                </strong>

                <span>
                  Consultar munições em manutenção e materiais indisponíveis
                </span>
              </button>
            </GrupoOperacao>
          )}
        </div>
      </section>

      )}

      <section className="municoes-estoque-section">
        <div className="municoes-section-header">
          <div>
            <span className="municoes-eyebrow">
              CONSULTA DE INVENTÁRIO
            </span>

            <h2>
              Carga de munições
            </h2>
          </div>

          <div
            style={{
              width:
                visaoP4
                  ? 'min(760px, 100%)'
                  : 'min(470px, 100%)',
              display: 'grid',
              gridTemplateColumns:
                visaoP4
                  ? 'minmax(145px, 170px) minmax(145px, 170px) auto auto auto'
                  : 'minmax(145px, 170px) auto auto',
              justifyContent: 'end',
              gap: '8px',
              alignItems: 'end'
            }}
          >
            <ComboFiltro
              label="CALIBRE"
              value={
                filtroCalibre
              }
              options={
                calibresDisponiveis.map(
                  (calibre) => ({
                    key:
                      calibre,
                    value:
                      calibre,
                    label:
                      calibre
                  })
                )
              }
              onChange={(valor) => {
                setFiltroCalibre(
                  valor
                )

                setFiltroLote(
                  ''
                )
              }}
            />

            {visaoP4 && (
              <ComboFiltro
                label="LOTE"
                value={
                  filtroLote
                }
                options={
                  lotesDisponiveis.map(
                    (lote) => ({
                      key:
                        lote.lote_id ||
                        `${lote.municao_id}-${lote.numero_lote}`,

                      value:
                        lote.numero_lote,

                      label:
                        lote.numero_lote,

                      secondary:
                        lote.calibre
                    })
                  )
                }
                onChange={(valor) =>
                  setFiltroLote(
                    String(
                      valor || ''
                    ).toUpperCase()
                  )
                }
              />
            )}

            <button
              type="button"
              className="municoes-btn-primary"
              disabled={
                !loteSelecionado &&
                !filtroCalibre
              }
              onClick={() =>
                setLoteRastreio(
                  loteSelecionado ||
                  {
                    consulta_calibre:
                      true,
                    calibre:
                      filtroCalibre
                  }
                )
              }
              title={
                loteSelecionado
                  ? `Ver policiais do lote ${loteSelecionado.numero_lote}`
                  : filtroCalibre
                    ? `Ver policiais com munição ${filtroCalibre} em todos os lotes`
                    : 'Selecione um calibre ou um lote para consultar os policiais'
              }
            >
              Policiais
            </button>

            {visaoP4 && (
              <button
                type="button"
                className="municoes-btn-secondary"
                onClick={() =>
                  setModalOutros(
                    true
                  )
                }
              >
                Outros
              </button>
            )}

            <button
              type="button"
              className="municoes-btn-secondary"
              disabled={
                !filtroCalibre &&
                !filtroLote
              }
              onClick={() => {
                setFiltroCalibre(
                  ''
                )
                setFiltroLote(
                  ''
                )
              }}
            >
              Limpar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="municoes-loading">
            Carregando munições...
          </div>
        ) : resumoFiltrado.length === 0 ? (
          <div className="municoes-empty">
            Nenhuma munição encontrada para os filtros informados.
          </div>
        ) : (
          <div className="municoes-calibres-list">
            {resumoFiltrado.map(
              (item) => {
                const lotesCalibre =
                  visaoP4
                    ? lotesDoCalibre(
                        item.id
                      )
                    : []

                return (
                  <article
                    key={item.id}
                    className="municoes-calibre-card"
                  >
                    <div
                      className={`municoes-calibre-main ${
                        visaoP4
                          ? ''
                          : 'municoes-calibre-main-svdd'
                      }`}
                    >
                      <div className="municoes-calibre-identificacao">
                        <small>
                          CALIBRE
                        </small>

                        <strong>
                          {item.calibre}
                        </strong>

                        {item.descricao && (
                          <span>
                            {item.descricao}
                          </span>
                        )}
                      </div>

                      {visaoP4 && (
                        <div className="municoes-saldo-item">
                          <small>
                            P4
                          </small>

                          <strong>
                            {numero(
                              item.quantidade_p4
                            )}
                          </strong>
                        </div>
                      )}

                      <div className="municoes-saldo-item">
                        <small>
                          SVDD
                        </small>

                        <strong>
                          {numero(
                            item.quantidade_svdd
                          )}
                        </strong>
                      </div>

                      <div className="municoes-saldo-item">
                        <small>
                          EM CAUTELA
                        </small>

                        <strong>
                          {numero(
                            item.quantidade_em_servico
                          )}
                        </strong>
                      </div>

                      <div className="municoes-saldo-item">
                        <small>
                          TOTAL ATUAL
                        </small>

                        <strong>
                          {numero(
                            item.quantidade_total_atual
                          )}
                        </strong>
                      </div>

                    </div>

                    {visaoP4 && (
                      <div className="municoes-lotes-area">
                        <div className="municoes-lotes-box">
                          <div className="municoes-lotes-header">
                            <strong>
                              LOTES • VISÃO P4
                            </strong>

                            <small>
                              {lotesCalibre.length}{' '}
                              lote(s)
                            </small>
                          </div>

                          {lotesCalibre.length === 0 ? (
                            <div className="municoes-empty">
                              Nenhum lote cadastrado
                              para este calibre.
                            </div>
                          ) : (
                            <div className="municoes-table-wrap">
                              <table className="municoes-table">
                                <thead>
                                  <tr>
                                    <th>
                                      LOTE
                                    </th>

                                    <th>
                                      ENTREGA
                                    </th>

                                    <th>
                                      P4
                                    </th>

                                    <th>
                                      SVDD
                                    </th>

                                    <th
                                      style={{
                                        width: '112px',
                                        paddingRight: '5px'
                                      }}
                                    >
                                      CARGA
                                      <br />
                                      PERMANENTE
                                    </th>

                                    <th
                                      style={{
                                        width: '88px',
                                        paddingLeft: '5px',
                                        paddingRight: '7px'
                                      }}
                                    >
                                      EM CAUTELA
                                    </th>

                                    <th
                                      style={{
                                        width: '76px',
                                        paddingLeft: '7px'
                                      }}
                                    >
                                      OUTROS
                                    </th>

                                    <th>
                                      TOTAL
                                    </th>

                                    <th>
                                      VALIDADE
                                    </th>

                                    <th>
                                      ALERTA
                                    </th>

                                  </tr>
                                </thead>

                                <tbody>
                                  {lotesCalibre.map(
                                    (lote) => (
                                      <tr
                                        key={
                                          lote.lote_id
                                        }
                                      >
                                        <td>
                                          <strong>
                                            {
                                              lote.numero_lote
                                            }
                                          </strong>
                                        </td>

                                        <td>
                                          {
                                            lote.data_entrega
                                              ? formatarData(
                                                  lote.data_entrega
                                                )
                                              : '—'
                                          }
                                        </td>

                                        <td>
                                          {numero(
                                            lote.quantidade_p4
                                          )}
                                        </td>

                                        <td>
                                          {numero(
                                            lote.quantidade_svdd
                                          )}
                                        </td>

                                        <td
                                          style={{
                                            paddingRight: '5px'
                                          }}
                                        >
                                          {numero(
                                            lote.quantidade_carga_permanente
                                          )}
                                        </td>

                                        <td
                                          style={{
                                            paddingLeft: '5px',
                                            paddingRight: '7px'
                                          }}
                                        >
                                          {numero(
                                            lote.quantidade_em_servico
                                          )}
                                        </td>

                                        <td
                                          style={{
                                            paddingLeft: '7px'
                                          }}
                                        >
                                          {numero(
                                            lote.quantidade_outros
                                          )}
                                        </td>

                                        <td>
                                          <strong>
                                            {numero(
                                              lote.quantidade_total_atual
                                            )}
                                          </strong>
                                        </td>

                                        <td>
                                          {lote.validade ? (
                                            <span
                                              className={
                                                classeValidade(
                                                  lote
                                                )
                                              }
                                            >
                                              {formatarData(
                                                lote.validade
                                              )}
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>

                                        <td>
                                          {
                                            lote.alerta_validade_ativo
                                              ? `${numero(
                                                  lote.alerta_validade_dias_antes
                                                )} dias antes`
                                              : '—'
                                          }
                                        </td>

                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                )
              }
            )}
          </div>
        )}
      </section>

      {modalCalibre && (
        <NovoCalibreModal
          user={user}
          onClose={() =>
            setModalCalibre(false)
          }
          onSalvo={() =>
            aposAlteracao(
              'Munição e lote cadastrados com sucesso.'
            )
          }
        />
      )}

      {seletorTransferencia && (
        <SelecionarTransferenciaModal
          resumo={resumo}
          sentido={
            seletorTransferencia
          }
          onClose={() =>
            setSeletorTransferencia(
              null
            )
          }
          onSelecionar={(municao) => {
            setTransferencia({
              municao,
              sentido:
                seletorTransferencia
            })

            setSeletorTransferencia(
              null
            )
          }}
        />
      )}

      {transferencia && (
        <TransferenciaModal
          municao={
            transferencia.municao
          }
          sentido={
            transferencia.sentido
          }
          user={user}
          onClose={() =>
            setTransferencia(null)
          }
          onSalvo={() =>
            aposAlteracao(
              'Transferência de munição registrada com sucesso.'
            )
          }
        />
      )}

      {destinoTransferenciaAberto && (
        <DestinoTransferenciaModal
          onClose={() =>
            setDestinoTransferenciaAberto(
              false
            )
          }
          onSelecionar={(destino) => {
            setDestinoTransferenciaAberto(
              false
            )

            if (
              destino ===
              'SVDD'
            ) {
              setSeletorTransferencia(
                'P4_SVDD'
              )
              return
            }

            setOperacaoEspecial({
              tipo:
                'TRANSFERENCIA_EXTERNA',
              origem:
                'P4',
              destinoPadrao:
                destino
            })
          }}
        />
      )}

      {cancelamentoMovimentacao && (
        <CancelarMovimentacaoModal
          onClose={() =>
            setCancelamentoMovimentacao(
              false
            )
          }
          onSalvo={() =>
            aposAlteracao(
              'Movimentação cancelada com sucesso.'
            )
          }
        />
      )}

      {recebimentoOperacao && (
        <RecebimentoMunicaoModal
          tipo={
            recebimentoOperacao
          }
          perfilP4={
            gerenciaLotes
          }
          onClose={() =>
            setRecebimentoOperacao(
              null
            )
          }
          onSalvo={() =>
            aposAlteracao(
              recebimentoOperacao ===
                'DEVOLUCAO'
                ? 'Devolução de munição recebida com sucesso.'
                : 'Transferência recebida com sucesso.'
            )
          }
        />
      )}

      {retornoManutencao && (
        <RetornoManutencaoModal
          user={user}
          onClose={() =>
            setRetornoManutencao(
              false
            )
          }
          onSalvo={() =>
            aposAlteracao(
              'Retorno da manutenção de munição registrado com sucesso.'
            )
          }
        />
      )}

      {operacaoEspecial && (
        <OperacaoEspecialModal
          tipo={
            operacaoEspecial.tipo
          }
          origem={
            operacaoEspecial.origem
          }
          destinoPadrao={
            operacaoEspecial.destinoPadrao ||
            ''
          }
          resumo={resumo}
          manutencoesAtivas={
            manutencoesAtivas
          }
          user={user}
          onClose={() =>
            setOperacaoEspecial(
              null
            )
          }
          onSalvo={() =>
            aposAlteracao(
              operacaoEspecial.tipo ===
                'MANUTENCAO'
                ? normalizar(
                    operacaoEspecial.origem
                  ).includes('SVDD')
                  ? 'Uma munição em manutenção foi encaminhada ao P4 com sucesso.'
                  : 'Munição enviada para manutenção com sucesso.'
                : operacaoEspecial.tipo ===
                    'DESCARGA'
                  ? 'Descarga de munição registrada com sucesso.'
                  : operacaoEspecial.destinoPadrao ===
                      'CARGA_PERMANENTE'
                    ? 'Carga permanente de munição registrada com sucesso.'
                    : 'Transferência de munição registrada com sucesso.'
            )
          }
        />
      )}

      {visaoP4 && modalOutros && (
        <OutrosLocaisModal
          resumo={resumo}
          lotes={lotes}
          onClose={() =>
            setModalOutros(
              false
            )
          }
        />
      )}

      {loteRastreio && (
        <PoliciaisLoteModal
          lote={
            loteRastreio?.lote_id
              ? loteRastreio
              : null
          }
          calibre={
            loteRastreio?.calibre ||
            filtroCalibre
          }
          onClose={() =>
            setLoteRastreio(null)
          }
        />
      )}
    </main>
  )
}
