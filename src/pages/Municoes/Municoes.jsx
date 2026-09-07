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
  transferirMunicaoP4ParaSvdd,
  transferirMunicaoSvddParaP4
} from '../../services/municoesMovimentacoesService'

import { supabase } from '../../services/supabaseClient'
import { loadSessionToken } from '../../services/authService'

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

  const disponiveis =
    resumo.filter(
      (item) =>
        numero(
          p4ParaSvdd
            ? item.quantidade_p4
            : item.quantidade_svdd
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
      {disponiveis.length === 0 ? (
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
                        p4ParaSvdd
                          ? item.quantidade_p4
                          : item.quantidade_svdd
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
    p4ParaSvdd
      ? numero(municao.quantidade_p4)
      : numero(municao.quantidade_svdd)

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
  origem = 'P4',
  destinoPadrao = '',
  onClose
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

  const [documento, setDocumento] =
    useState('')

  const [observacoes, setObservacoes] =
    useState('')

  const [fotos, setFotos] =
    useState([])

  const origemNormalizada =
    normalizar(origem)

  const campoSaldo =
    origemNormalizada.includes(
      'SVDD'
    )
      ? 'quantidade_svdd'
      : 'quantidade_p4'

  const disponiveis =
    resumo.filter(
      (item) =>
        numero(
          item?.[campoSaldo]
        ) > 0
    )

  const municao =
    disponiveis.find(
      (item) =>
        String(item.id) ===
        String(municaoId)
    ) || null

  const saldoDisponivel =
    numero(
      municao?.[campoSaldo]
    )

  const ehManutencao =
    tipo === 'MANUTENCAO'

  const ehTransferencia =
    tipo === 'TRANSFERENCIA_EXTERNA'

  const ehDescarga =
    tipo === 'DESCARGA'

  const config =
    ehManutencao
      ? {
          titulo:
            origemNormalizada.includes(
              'SVDD'
            )
              ? 'Enviar munição ao P4 para manutenção'
              : 'Enviar munição para manutenção',

          subtitulo:
            origemNormalizada.includes(
              'SVDD'
            )
              ? 'A munição sai do saldo disponível do SVDD e segue para análise do P4.'
              : 'Registre munições avariadas, deterioradas ou impróprias para uso.',

          confirmar:
            'Confirmar envio para manutenção'
        }
      : ehTransferencia
        ? {
            titulo:
              'Transferir para outra unidade',

            subtitulo:
              'Selecione calibre, quantidade e destino da transferência.',

            confirmar:
              'Confirmar transferência'
          }
        : {
            titulo:
              'Registrar descarga',

            subtitulo:
              'Retirada definitiva do estoque ativo, com justificativa e rastreabilidade.',

            confirmar:
              'Confirmar descarga'
          }

  return (
    <Modal
      titulo={config.titulo}
      subtitulo={config.subtitulo}
      onClose={onClose}
      amplo
    >
      <form
        onSubmit={(event) =>
          event.preventDefault()
        }
      >
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
              onChange={(event) => {
                setMunicaoId(
                  event.target.value
                )
                setQuantidade(
                  ''
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
                      item?.[campoSaldo]
                    )} disponível(is)
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="QUANTIDADE">
            <input
              className="municoes-input"
              type="number"
              min="1"
              max={saldoDisponivel || undefined}
              value={quantidade}
              onChange={(event) =>
                setQuantidade(
                  event.target.value
                )
              }
              disabled={!municao}
            />
          </Campo>

          <Campo label="DISPONÍVEL NA ORIGEM">
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

              <Campo label="DESTINO">
                <input
                  className="municoes-input municoes-input-readonly"
                  value={
                    origemNormalizada.includes(
                      'SVDD'
                    )
                      ? 'P4 / MANUTENÇÃO'
                      : 'MANUTENÇÃO P4'
                  }
                  readOnly
                />
              </Campo>
            </>
          )}

          {ehTransferencia && (
            <>
              <Campo label="TIPO DE DESTINO">
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

                  <option value="CARGA_PERMANENTE">
                    CARGA PERMANENTE
                  </option>

                  <option value="OUTRAS_CIAS">
                    OUTRAS CIAS
                  </option>

                  <option value="BATALHAO">
                    BATALHÃO
                  </option>

                  <option value="OUTRA_UNIDADE">
                    OUTRA UNIDADE
                  </option>
                </select>
              </Campo>

              <Campo label="UNIDADE / DESTINO">
                <input
                  className="municoes-input"
                  value={destino}
                  onChange={(event) =>
                    setDestino(
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="Ex.: 1ª CIA, 27º BPM/M, unidade externa..."
                />
              </Campo>
            </>
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
              ehManutencao
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
                ehManutencao
                  ? 'Descreva o dano, condição, lote envolvido ou motivo do envio.'
                  : 'Registre informações complementares desta operação.'
              }
            />
          </Campo>

          {(ehManutencao ||
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
                    )
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

        <div
          className="municoes-alert"
          style={{
            marginTop: '16px',
            marginBottom: 0,
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1e4f8f'
          }}
        >
          Estrutura visual pronta. A gravação desta operação será ligada ao backend no próximo passo.
        </div>

        <footer className="municoes-modal-actions">
          <button
            type="button"
            className="municoes-btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="municoes-btn-primary"
            disabled
            title="Será habilitado quando conectarmos o backend desta operação."
          >
            {config.confirmar}
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
  resumo,
  onClose
}) {
  const emManutencao =
    resumo.filter(
      (item) =>
        numero(
          item.quantidade_manutencao
        ) > 0
    )

  return (
    <Modal
      titulo="Receber manutenção"
      subtitulo="Visualizar munições em manutenção e acompanhar o retorno ao estoque."
      onClose={onClose}
      amplo
    >
      {emManutencao.length === 0 ? (
        <div className="municoes-modal-empty">
          Nenhuma munição está registrada em manutenção.
        </div>
      ) : (
        <div className="municoes-table-wrap">
          <table className="municoes-table">
            <thead>
              <tr>
                <th>CALIBRE</th>
                <th>EM MANUTENÇÃO</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {emManutencao.map(
                (item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.calibre}
                      </strong>
                    </td>

                    <td>
                      {numero(
                        item.quantidade_manutencao
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="municoes-btn-primary municoes-btn-small"
                        disabled
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

  const carregar =
    useCallback(async () => {
      try {
        setLoading(true)
        setErro('')

        const [
          resumoData,
          lotesData
        ] = await Promise.all([
          listarResumoMunicoes(),

          gerenciaLotes
            ? listarLotesResumo()
            : Promise.resolve([])
        ])

        setResumo(
          resumoData || []
        )

        setLotes(
          lotesData || []
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
    }, [gerenciaLotes])

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
            'Manutenção',
          valor:
            manutencao,
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

      if (!gerenciaLotes) {
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
              manutencao,
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
      gerenciaLotes,
      resumo,
      totais.p4,
      totais.servico,
      totais.svdd
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
              numero(
                gerenciaLotes
                  ? item.quantidade_total_atual
                  : item.quantidade_svdd
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
        gerenciaLotes,
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
        {gerenciaLotes && (
          <CardResumo
            titulo="TOTAL CONTROLADO"
            valor={totais.total}
            subtitulo="Cofre P4 + Cofre SVDD + cautelas"
          />
        )}

        {gerenciaLotes && (
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
          subtitulo="Saldo por calibre"
        />

        {gerenciaLotes && (
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
            distribuicaoPorLocal.manutencao
          }
          subtitulo="Material indisponível"
        />

        {gerenciaLotes && (
          <CardDistribuicao
            titulo="OUTRAS CIAS"
            itens={
              distribuicaoPorLocal.outrasCias
            }
            subtitulo="Outras companhias"
          />
        )}

        {gerenciaLotes && (
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

        {gerenciaLotes && (
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
            gerenciaLotes
              ? 'Estoque controlado'
              : 'Estoque do SVDD'
          }
        />
      </section>

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
                  : totais.svdd <= 0
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
                Enviar para manutenção
              </strong>

              <span>
                {gerenciaLotes
                  ? 'Registrar munição avariada ou deteriorada sob responsabilidade do P4'
                  : 'Encaminhar ao P4 munição avariada ou imprópria identificada no SVDD'}
              </span>
            </button>

            {gerenciaLotes && (
              <button
                type="button"
                disabled={
                  totais.p4 <= 0
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
                gerenciaLotes
                  ? 'min(760px, 100%)'
                  : 'min(470px, 100%)',
              display: 'grid',
              gridTemplateColumns:
                gerenciaLotes
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

            {gerenciaLotes && (
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

            {gerenciaLotes && (
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
                  gerenciaLotes
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
                        gerenciaLotes
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

                      {gerenciaLotes && (
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

                    {gerenciaLotes && (
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
          resumo={resumo}
          onClose={() =>
            setRetornoManutencao(
              false
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
          onClose={() =>
            setOperacaoEspecial(
              null
            )
          }
        />
      )}

      {gerenciaLotes && modalOutros && (
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
