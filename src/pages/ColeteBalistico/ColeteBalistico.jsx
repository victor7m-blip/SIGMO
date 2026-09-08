import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  COLETE_BALISTICO_ALERTA_VALIDADE_DIAS,
  COLETE_BALISTICO_FORM_INICIAL,
  COLETE_BALISTICO_MODELAGENS,
  COLETE_BALISTICO_SEXOS,
  COLETE_BALISTICO_TAMANHOS
} from '../../constants/coletesBalisticosConstants'

import {
  atualizarColeteBalistico,
  cadastrarColeteBalistico,
  coleteElegivelParaCarga,
  decidirDescargaColete,
  desativarColeteBalistico,
  listarColetesBalisticos,
  listarDescargasColetesPendentes,
  obterSituacaoValidadeColete,
  pagarColeteCargaIndividual
} from '../../services/coletesBalisticosService'

import {
  listarPoliciais
} from '../../services/policiaisService'

import {
  confirmarRecebimentoMovimentacao
} from '../../services/movimentacoesService'

import {
  supabase
} from '../../services/supabaseClient'

import './ColeteBalistico.css'

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


async function aplicarPendenciasRecebimentoCarga(
  lista
) {
  const coletes =
    Array.isArray(lista)
      ? lista
      : []

  const coleteIds =
    coletes
      .map(
        (item) =>
          item?.id
      )
      .filter(Boolean)

  if (
    coleteIds.length === 0
  ) {
    return coletes
  }

  const {
    data:
      patrimonios,
    error:
      patrimoniosError
  } = await supabase
    .from(
      'sigmo_patrimonios'
    )
    .select(
      'id, referencia_id'
    )
    .eq(
      'tipo',
      'colete_balistico'
    )
    .in(
      'referencia_id',
      coleteIds
    )

  if (patrimoniosError) {
    throw patrimoniosError
  }

  const patrimonioIds =
    (patrimonios || [])
      .map(
        (item) =>
          item?.id
      )
      .filter(Boolean)

  if (
    patrimonioIds.length === 0
  ) {
    return coletes
  }

  const {
    data:
      itensMovimentacao,
    error:
      itensError
  } = await supabase
    .from(
      'sigmo_movimentacao_itens'
    )
    .select(
      'movimentacao_id, patrimonio_id'
    )
    .in(
      'patrimonio_id',
      patrimonioIds
    )

  if (itensError) {
    throw itensError
  }

  const movimentacaoIds =
    [
      ...new Set(
        (itensMovimentacao || [])
          .map(
            (item) =>
              item?.movimentacao_id
          )
          .filter(Boolean)
      )
    ]

  if (
    movimentacaoIds.length === 0
  ) {
    return coletes
  }

  const {
    data:
      movimentacoes,
    error:
      movimentacoesError
  } = await supabase
    .from(
      'sigmo_movimentacoes'
    )
    .select(
      'id, tipo_movimentacao, status, origem_local, destino_local, created_at'
    )
    .in(
      'id',
      movimentacaoIds
    )
    .eq(
      'tipo_movimentacao',
      'ENTREGA'
    )
    .eq(
      'status',
      'aguardando_recebimento'
    )
    .eq(
      'destino_local',
      'CARGA PERMANENTE'
    )

  if (movimentacoesError) {
    throw movimentacoesError
  }

  const pendentes =
    new Set(
      (movimentacoes || [])
        .map(
          (item) =>
            String(
              item?.id ||
              ''
            )
        )
        .filter(Boolean)
    )

  if (
    pendentes.size === 0
  ) {
    return coletes
  }

  const patrimonioPorId =
    new Map(
      (patrimonios || [])
        .map(
          (item) => [
            String(
              item.id
            ),
            String(
              item.referencia_id
            )
          ]
        )
    )

  const coletesPendentes =
    new Set()

  for (
    const item of
    itensMovimentacao || []
  ) {
    if (
      !pendentes.has(
        String(
          item?.movimentacao_id ||
          ''
        )
      )
    ) {
      continue
    }

    const coleteId =
      patrimonioPorId.get(
        String(
          item?.patrimonio_id ||
          ''
        )
      )

    if (coleteId) {
      coletesPendentes.add(
        coleteId
      )
    }
  }

  return coletes.map(
    (colete) => {
      if (
        !coletesPendentes.has(
          String(
            colete.id
          )
        )
      ) {
        return colete
      }

      return {
        ...colete,
        status_operacional:
          'AGUARDANDO_RECEBIMENTO',
        local_atual:
          'AGUARDANDO RECEBIMENTO',
        pendente_recebimento:
          true
      }
    }
  )
}

function calcularResumoColetes(
  lista
) {
  const resumo = {
    total: 0,
    reserva: 0,
    cargaIndividual: 0,
    aguardandoRecebimento: 0,
    manutencao: 0,
    transferidos: 0,
    vencendo: 0,
    vencidos: 0
  }

  for (
    const colete of
    lista || []
  ) {
    if (
      colete?.ativo === false
    ) {
      continue
    }

    resumo.total += 1

    const status =
      normalizar(
        colete?.status_operacional
      )
        .replaceAll(
          ' ',
          '_'
        )

    if (
      status ===
      'RESERVA'
    ) {
      resumo.reserva += 1
    }

    if (
      status ===
      'CARGA_INDIVIDUAL'
    ) {
      resumo.cargaIndividual += 1
    }

    if (
      status ===
      'AGUARDANDO_RECEBIMENTO'
    ) {
      resumo.aguardandoRecebimento += 1
    }

    if (
      status ===
      'MANUTENCAO'
    ) {
      resumo.manutencao += 1
    }

    if (
      status ===
      'TRANSFERIDO'
    ) {
      resumo.transferidos += 1
    }

    const validade =
      obterSituacaoValidadeColete(
        colete
      )

    if (
      validade ===
      'VENCIDO'
    ) {
      resumo.vencidos += 1
    } else if (
      validade ===
      'ALERTA'
    ) {
      resumo.vencendo += 1
    }
  }

  return resumo
}

function podeGerenciar(user) {
  const perfil =
    obterPerfil(user)

  return (
    perfil === 'P4' ||
    perfil.includes(
      'ADMINISTRADOR'
    ) ||
    perfil.includes(
      'COMANDANTE'
    )
  )
}

function podePagarCarga(user) {
  return obterPerfil(user) === 'P4'
}

function podeDecidirDescarga(user) {
  const perfil =
    obterPerfil(user)

  return (
    perfil.includes(
      'COMANDANTE'
    ) ||
    perfil.includes(
      'ADMINISTRADOR'
    )
  )
}

function formatarStatus(valor) {
  return String(valor || '')
    .replaceAll('_', ' ')
}

function formatarModelagem(valor) {
  if (
    normalizar(valor) ===
    'PADRAO'
  ) {
    return 'PADRÃO'
  }

  return String(valor || '')
}

function formatarData(valor) {
  if (!valor) {
    return '—'
  }

  const data =
    new Date(
      `${String(valor).slice(0, 10)}T12:00:00`
    )

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return '—'
  }

  return data.toLocaleDateString(
    'pt-BR'
  )
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

function CardResumo({
  titulo,
  valor,
  subtitulo
}) {
  return (
    <article className="coletes-resumo-card">
      <span>{titulo}</span>

      <strong>
        {Number(
          valor || 0
        ).toLocaleString(
          'pt-BR'
        )}
      </strong>

      {subtitulo && (
        <small>
          {subtitulo}
        </small>
      )}
    </article>
  )
}

function GraficoRosca({
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
    <section className="coletes-chart-card">
      <div className="coletes-chart-header">
        <div>
          <span>
            Distribuição patrimonial e validade
          </span>

          <h2>
            Situação dos coletes
          </h2>
        </div>
      </div>

      <div className="coletes-chart-donut-layout">
        <div
          className="coletes-chart-donut"
          style={{
            background:
              `conic-gradient(${segmentos.join(', ')})`
          }}
        >
          <div>
            <strong>
              {Number(
                total || 0
              ).toLocaleString(
                'pt-BR'
              )}
            </strong>

            <span>
              TOTAL ATIVO
            </span>
          </div>
        </div>

        <div className="coletes-chart-legend">
          {itens.map(
            (item) => (
              <div
                key={
                  item.label
                }
              >
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
                  {Number(
                    item.valor || 0
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
            )
          )}
        </div>
      </div>
    </section>
  )
}

function GraficoBarras({
  itens
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
    <>
      {itens.length === 0 ? (
        <div className="coletes-empty">
          Nenhum colete encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="coletes-chart-bars">
          {itens.map(
            (item) => (
              <div
                className="coletes-chart-bar-item"
                key={
                  item.label
                }
              >
                <div className="coletes-chart-bar-value">
                  {item.valor}
                </div>

                <div className="coletes-chart-bar-track">
                  <i
                    style={{
                      height:
                        `${Math.max(
                          item.valor
                            ? 9
                            : 2,
                          (
                            item.valor /
                            maior
                          ) *
                            100
                        )}%`
                    }}
                  />
                </div>

                <strong>
                  {item.label}
                </strong>
              </div>
            )
          )}
        </div>
      )}
    </>
  )
}

function GrupoOperacao({
  icone,
  titulo,
  descricao,
  children
}) {
  return (
    <div className="coletes-operation-group">
      <div className="coletes-operation-group-header">
        <div className="coletes-operation-group-icon">
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

      <div className="coletes-operation-actions">
        {children}
      </div>
    </div>
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
      className="coletes-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.()
        }
      }}
    >
      <section
        className={`coletes-modal ${amplo ? 'coletes-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="coletes-modal-header">
          <div>
            <span className="coletes-eyebrow">
              SIGMO • COLETE BALÍSTICO
            </span>

            <h2>
              {titulo}
            </h2>

            {subtitulo && (
              <p>
                {subtitulo}
              </p>
            )}
          </div>

          <button
            type="button"
            className="coletes-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="coletes-modal-body">
          {children}
        </div>
      </section>
    </div>
  )
}

function Campo({
  label,
  full = false,
  children
}) {
  return (
    <label
      className={`coletes-field ${full ? 'coletes-field-full' : ''}`}
    >
      <span>
        {label}
      </span>

      {children}
    </label>
  )
}

function FormularioColete({
  user,
  colete = null,
  onClose,
  onSalvo
}) {
  const [
    form,
    setForm
  ] = useState(
    colete
      ? {
          ...COLETE_BALISTICO_FORM_INICIAL,
          ...colete
        }
      : COLETE_BALISTICO_FORM_INICIAL
  )

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  function alterar(
    campo,
    valor
  ) {
    setForm(
      (atual) => ({
        ...atual,
        [campo]:
          valor
      })
    )
  }

  async function salvar(
    event
  ) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')

      if (colete?.id) {
        await atualizarColeteBalistico(
          colete.id,
          form,
          user
        )
      } else {
        await cadastrarColeteBalistico({
          dados: form,
          user
        })
      }

      await onSalvo?.()
      onClose?.()
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível salvar o colete.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={
        colete
          ? 'Editar colete balístico'
          : 'Cadastrar colete balístico'
      }
      subtitulo="Cadastro individual por patrimônio, série e lote."
      onClose={onClose}
      amplo
    >
      <form onSubmit={salvar}>
        {erro && (
          <div className="coletes-alert coletes-alert-error">
            {erro}
          </div>
        )}

        <div className="coletes-form-grid">
          <Campo label="PATRIMÔNIO">
            <input
              autoFocus
              className="coletes-input"
              value={
                form.patrimonio
              }
              onChange={(event) =>
                alterar(
                  'patrimonio',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo label="NÚMERO DE SÉRIE">
            <input
              className="coletes-input"
              value={
                form.numero_serie
              }
              onChange={(event) =>
                alterar(
                  'numero_serie',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo label="NÚMERO DO LOTE">
            <input
              className="coletes-input"
              value={
                form.numero_lote
              }
              onChange={(event) =>
                alterar(
                  'numero_lote',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo label="FABRICANTE">
            <input
              className="coletes-input"
              value={
                form.fabricante
              }
              onChange={(event) =>
                alterar(
                  'fabricante',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo label="MODELO">
            <input
              className="coletes-input"
              value={
                form.modelo || ''
              }
              onChange={(event) =>
                alterar(
                  'modelo',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo label="NÍVEL DE PROTEÇÃO">
            <input
              className="coletes-input"
              value={
                form.nivel_protecao
              }
              onChange={(event) =>
                alterar(
                  'nivel_protecao',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>

          <Campo label="SEXO">
            <select
              className="coletes-select"
              value={
                form.sexo
              }
              onChange={(event) =>
                alterar(
                  'sexo',
                  event.target.value
                )
              }
            >
              <option value="">
                Selecione
              </option>

              {COLETE_BALISTICO_SEXOS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="TAMANHO">
            <select
              className="coletes-select"
              value={
                form.tamanho
              }
              onChange={(event) =>
                alterar(
                  'tamanho',
                  event.target.value
                )
              }
            >
              <option value="">
                Selecione
              </option>

              {COLETE_BALISTICO_TAMANHOS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="MODELAGEM">
            <select
              className="coletes-select"
              value={
                form.modelagem
              }
              onChange={(event) =>
                alterar(
                  'modelagem',
                  event.target.value
                )
              }
            >
              {COLETE_BALISTICO_MODELAGENS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="FABRICAÇÃO">
            <input
              className="coletes-input"
              type="date"
              value={
                form.data_fabricacao || ''
              }
              onChange={(event) =>
                alterar(
                  'data_fabricacao',
                  event.target.value
                )
              }
            />
          </Campo>

          <Campo label="VALIDADE">
            <input
              className="coletes-input"
              type="date"
              value={
                form.validade || ''
              }
              onChange={(event) =>
                alterar(
                  'validade',
                  event.target.value
                )
              }
            />
          </Campo>

          <Campo label="ENTRADA NA CARGA">
            <input
              className="coletes-input"
              type="date"
              value={
                form.data_entrada_carga || ''
              }
              onChange={(event) =>
                alterar(
                  'data_entrada_carga',
                  event.target.value
                )
              }
            />
          </Campo>

          <Campo
            label="CONTRATO / FORNECIMENTO"
            full
          >
            <input
              className="coletes-input"
              value={
                form.contrato_fornecimento || ''
              }
              onChange={(event) =>
                alterar(
                  'contrato_fornecimento',
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
              className="coletes-textarea"
              rows="4"
              value={
                form.observacoes || ''
              }
              onChange={(event) =>
                alterar(
                  'observacoes',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>
        </div>

        <div className="coletes-modal-actions">
          <button
            type="button"
            className="coletes-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="coletes-btn-primary"
            disabled={salvando}
          >
            {salvando
              ? 'Salvando...'
              : colete
                ? 'Salvar alterações'
                : 'Cadastrar colete'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DetalhesColete({
  colete,
  onClose,
  onEdit
}) {
  const situacao =
    obterSituacaoValidadeColete(
      colete
    )

  return (
    <Modal
      titulo={`Colete ${colete.patrimonio}`}
      subtitulo={`${colete.fabricante} · ${colete.nivel_protecao}`}
      onClose={onClose}
      amplo
    >
      <div className="coletes-details-grid">
        <Info
          label="Patrimônio"
          value={
            colete.patrimonio
          }
        />

        <Info
          label="Número de série"
          value={
            colete.numero_serie
          }
        />

        <Info
          label="Lote"
          value={
            colete.numero_lote
          }
        />

        <Info
          label="Fabricante"
          value={
            colete.fabricante
          }
        />

        <Info
          label="Modelo"
          value={
            colete.modelo
          }
        />

        <Info
          label="Nível"
          value={
            colete.nivel_protecao
          }
        />

        <Info
          label="Sexo"
          value={
            colete.sexo
          }
        />

        <Info
          label="Tamanho"
          value={
            `${colete.tamanho} · ${formatarModelagem(colete.modelagem)}`
          }
        />

        <Info
          label="Fabricação"
          value={
            formatarData(
              colete.data_fabricacao
            )
          }
        />

        <Info
          label="Validade"
          value={
            formatarData(
              colete.validade
            )
          }
        />

        <Info
          label="Situação da validade"
          value={
            situacao === 'ALERTA'
              ? 'PRÓXIMA DA VALIDADE'
              : situacao === 'VENCIDO'
                ? 'VENCIDO'
                : situacao
          }
        />

        <Info
          label="Status"
          value={
            formatarStatus(
              colete.status_operacional
            )
          }
        />

        <Info
          label="Local atual"
          value={
            colete.local_atual
          }
        />

        <Info
          label="Responsável atual"
          value={
            colete.carga_policial_nome
          }
        />

        <Info
          label="RE"
          value={
            colete.carga_policial_re
          }
        />

        <Info
          label="Contrato / fornecimento"
          value={
            colete.contrato_fornecimento
          }
        />
      </div>

      <div className="coletes-details-observacoes">
        <strong>
          Observações
        </strong>

        <p>
          {colete.observacoes ||
            'Sem observações.'}
        </p>
      </div>

      <div className="coletes-modal-actions">
        <button
          type="button"
          className="coletes-btn-secondary"
          onClick={onClose}
        >
          Fechar
        </button>

        <button
          type="button"
          className="coletes-btn-primary"
          onClick={onEdit}
        >
          Editar cadastro
        </button>
      </div>
    </Modal>
  )
}

function Info({
  label,
  value
}) {
  return (
    <div className="coletes-info">
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


function ModalPagarCargaColete({
  user,
  coletes,
  onClose,
  onConcluido
}) {
  const [
    re,
    setRe
  ] = useState('')

  const [
    policial,
    setPolicial
  ] = useState(null)

  const [
    buscandoPolicial,
    setBuscandoPolicial
  ] = useState(false)

  const [
    sexoColete,
    setSexoColete
  ] = useState('MASCULINO')

  const [
    coleteId,
    setColeteId
  ] = useState('')

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const disponiveis =
    useMemo(
      () =>
        (coletes || [])
          .filter(
            (colete) =>
              coleteElegivelParaCarga(
                colete
              ) &&
              normalizar(
                colete?.sexo
              ) ===
                sexoColete
          )
          .sort(
            (a, b) =>
              String(
                a?.patrimonio || ''
              ).localeCompare(
                String(
                  b?.patrimonio || ''
                ),
                'pt-BR',
                {
                  numeric: true
                }
              )
          ),
      [
        coletes,
        sexoColete
      ]
    )

  useEffect(() => {
    const numero =
      String(re || '')
        .replace(/\D/g, '')
        .slice(0, 6)

    if (numero.length < 6) {
      setPolicial(null)
      setErro('')
      return
    }

    let ativo = true

    const timer =
      window.setTimeout(
        async () => {
          try {
            setBuscandoPolicial(
              true
            )
            setErro('')

            const resultado =
              await listarPoliciais({
                filtros: {
                  re: numero
                },
                pagina: 1,
                limite: 20
              })

            if (!ativo) {
              return
            }

            const lista =
              resultado?.data ||
              []

            const encontrado =
              lista.find(
                (item) =>
                  String(
                    item?.re || ''
                  )
                    .replace(/\D/g, '')
                    .slice(0, 6) ===
                  numero
              ) || null

            if (!encontrado) {
              setPolicial(null)
              setErro(
                'Policial não encontrado para o RE informado.'
              )
              return
            }

            setPolicial(
              encontrado
            )
          } catch (error) {
            if (!ativo) {
              return
            }

            console.error(error)

            setPolicial(null)
            setErro(
              error?.message ||
              'Não foi possível consultar o policial.'
            )
          } finally {
            if (ativo) {
              setBuscandoPolicial(
                false
              )
            }
          }
        },
        300
      )

    return () => {
      ativo = false
      window.clearTimeout(
        timer
      )
    }
  }, [re])

  const coleteSelecionado =
    useMemo(
      () =>
        disponiveis.find(
          (colete) =>
            String(
              colete.id
            ) ===
            String(
              coleteId
            )
        ) || null,
      [
        disponiveis,
        coleteId
      ]
    )

  async function confirmar(
    event
  ) {
    event.preventDefault()

    if (!policial?.id) {
      setErro(
        'Informe um RE válido.'
      )
      return
    }

    if (!coleteSelecionado) {
      setErro(
        'Selecione um colete disponível.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await pagarColeteCargaIndividual({
        colete:
          coleteSelecionado,
        policial,
        observacoes,
        user
      })

      await onConcluido?.({
        colete:
          coleteSelecionado,
        policial
      })
    } catch (error) {
      console.error(error)

      setErro(
        error?.message ||
        'Não foi possível pagar o colete como carga individual.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo="Pagar carga individual"
      subtitulo="O colete permanece no P4 até o policial confirmar o recebimento."
      onClose={
        salvando
          ? undefined
          : onClose
      }
      amplo
    >
      <form onSubmit={confirmar}>
        {erro && (
          <div className="coletes-alert coletes-alert-error">
            {erro}
          </div>
        )}

        <div className="coletes-form-grid">
          <Campo label="RE DO POLICIAL">
            <input
              className="coletes-input"
              value={re}
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              onChange={(event) => {
                setRe(
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 6)
                )
                setPolicial(null)
              }}
            />
          </Campo>

          <Campo label="POLICIAL">
            <input
              className="coletes-input"
              value={
                buscandoPolicial
                  ? 'PESQUISANDO...'
                  : policial
                    ? [
                        policial.posto_graduacao,
                        policial.nome_guerra ||
                          policial.nome
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : ''
              }
              placeholder="Aguardando RE"
              readOnly
            />
          </Campo>

          <div
            className="coletes-field-full"
          >
            <span
              style={{
                display: 'block',
                marginBottom: '7px',
                color: '#344054',
                fontSize: '0.73rem',
                fontWeight: 800
              }}
            >
              SEXO DO COLETE
            </span>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >
              {[
                ['MASCULINO', 'Masculino'],
                ['FEMININO', 'Feminino']
              ].map(
                ([
                  valor,
                  label
                ]) => (
                  <button
                    key={valor}
                    type="button"
                    className={
                      sexoColete ===
                      valor
                        ? 'coletes-btn-primary'
                        : 'coletes-btn-secondary'
                    }
                    onClick={() => {
                      setSexoColete(
                        valor
                      )
                      setColeteId('')
                    }}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <Campo
            label="COLETE DISPONÍVEL"
            full
          >
            <select
              className="coletes-select"
              value={coleteId}
              onChange={(event) =>
                setColeteId(
                  event.target.value
                )
              }
            >
              <option value="">
                Selecione um colete {sexoColete.toLowerCase()}
              </option>

              {disponiveis.map(
                (colete) => (
                  <option
                    key={colete.id}
                    value={colete.id}
                  >
                    {[
                      colete.patrimonio,
                      `${colete.tamanho} · ${formatarModelagem(colete.modelagem)}`,
                      `LOTE ${colete.numero_lote}`
                    ]
                      .filter(Boolean)
                      .join(' — ')}
                  </option>
                )
              )}
            </select>
          </Campo>

          {coleteSelecionado && (
            <div
              className="coletes-field-full"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(4, minmax(0, 1fr))',
                gap: '10px'
              }}
            >
              <Info
                label="Patrimônio"
                value={
                  coleteSelecionado.patrimonio
                }
              />

              <Info
                label="Série"
                value={
                  coleteSelecionado.numero_serie
                }
              />

              <Info
                label="Tamanho"
                value={`${coleteSelecionado.tamanho} · ${formatarModelagem(coleteSelecionado.modelagem)}`}
              />

              <Info
                label="Validade"
                value={
                  formatarData(
                    coleteSelecionado.validade
                  )
                }
              />
            </div>
          )}

          <Campo
            label="OBSERVAÇÕES"
            full
          >
            <textarea
              className="coletes-textarea"
              rows="3"
              value={observacoes}
              placeholder="Informações adicionais sobre a carga"
              onChange={(event) =>
                setObservacoes(
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>
        </div>

        <div className="coletes-modal-actions">
          <button
            type="button"
            className="coletes-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="coletes-btn-primary"
            disabled={
              salvando ||
              !policial?.id ||
              !coleteSelecionado
            }
          >
            {salvando
              ? 'Pagando...'
              : 'Confirmar carga'}
          </button>
        </div>
      </form>
    </Modal>
  )
}


function ModalReceberDevolucaoColete({
  user,
  onClose,
  onConcluido
}) {
  const [
    lista,
    setLista
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    recebendoId,
    setRecebendoId
  ] = useState(null)

  const carregarPendentes =
    useCallback(async () => {
      try {
        setLoading(true)
        setErro('')

        const {
          data: movimentacoes,
          error: movimentacoesError
        } = await supabase
          .from('sigmo_movimentacoes')
          .select(
            'id, tipo_movimentacao, status, origem_local, destino_local, solicitante_id, solicitante_nome, observacoes, created_at'
          )
          .eq(
            'tipo_movimentacao',
            'TRANSFERÊNCIA PARA O P4'
          )
          .eq(
            'status',
            'aguardando_recebimento'
          )
          .eq(
            'destino_local',
            'COFRE DO P4'
          )
          .order(
            'created_at',
            {
              ascending: false
            }
          )

        if (movimentacoesError) {
          throw movimentacoesError
        }

        const idsMovimentacoes =
          (movimentacoes || [])
            .map(
              (item) =>
                item.id
            )

        if (
          idsMovimentacoes.length === 0
        ) {
          setLista([])
          return
        }

        const {
          data: itens,
          error: itensError
        } = await supabase
          .from(
            'sigmo_movimentacao_itens'
          )
          .select(
            'id, movimentacao_id, patrimonio_id, quantidade, observacao'
          )
          .in(
            'movimentacao_id',
            idsMovimentacoes
          )

        if (itensError) {
          throw itensError
        }

        const patrimonioIds =
          [
            ...new Set(
              (itens || [])
                .map(
                  (item) =>
                    item.patrimonio_id
                )
                .filter(Boolean)
            )
          ]

        if (
          patrimonioIds.length === 0
        ) {
          setLista([])
          return
        }

        const {
          data: patrimonios,
          error: patrimoniosError
        } = await supabase
          .from(
            'sigmo_patrimonios'
          )
          .select(
            'id, referencia_id, tipo, numero_patrimonio, numero_serie, status, local_atual, dados'
          )
          .in(
            'id',
            patrimonioIds
          )
          .eq(
            'tipo',
            'colete_balistico'
          )

        if (patrimoniosError) {
          throw patrimoniosError
        }

        const porPatrimonio =
          new Map(
            (patrimonios || [])
              .map(
                (item) => [
                  String(
                    item.id
                  ),
                  item
                ]
              )
          )

        const pendentes =
          (movimentacoes || [])
            .map(
              (movimentacao) => {
                const itensColete =
                  (itens || [])
                    .filter(
                      (item) =>
                        String(
                          item.movimentacao_id
                        ) ===
                        String(
                          movimentacao.id
                        )
                    )
                    .map(
                      (item) => ({
                        ...item,
                        patrimonio:
                          porPatrimonio.get(
                            String(
                              item.patrimonio_id
                            )
                          ) ||
                          null
                      })
                    )
                    .filter(
                      (item) =>
                        item.patrimonio
                    )

                if (
                  itensColete.length === 0
                ) {
                  return null
                }

                return {
                  ...movimentacao,
                  itens:
                    itensColete
                }
              }
            )
            .filter(Boolean)

        setLista(
          pendentes
        )
      } catch (error) {
        console.error(
          'Erro ao carregar devoluções de colete:',
          error
        )

        setLista([])
        setErro(
          error?.message ||
          'Não foi possível carregar as devoluções pendentes.'
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    carregarPendentes()
  }, [carregarPendentes])

  async function receber(
    movimentacao
  ) {
    if (!movimentacao?.id) {
      return
    }

    const identificacoes =
      (movimentacao.itens || [])
        .map(
          (item) =>
            item?.patrimonio
              ?.numero_patrimonio ||
            item?.patrimonio
              ?.numero_serie
        )
        .filter(Boolean)
        .join(', ')

    const confirmou =
      window.confirm(
        `Confirmar o recebimento de ${identificacoes || 'este colete'} no COFRE DO P4?`
      )

    if (!confirmou) {
      return
    }

    try {
      setRecebendoId(
        movimentacao.id
      )
      setErro('')

      await confirmarRecebimentoMovimentacao({
        movimentacao_id:
          movimentacao.id,
        recebedor:
          user,
        observacao:
          'DEVOLUÇÃO DE COLETE BALÍSTICO RECEBIDA FISICAMENTE PELO P4.'
      })

      for (
        const item of
        movimentacao.itens || []
      ) {
        const patrimonio =
          item?.patrimonio

        if (
          !patrimonio?.id
        ) {
          continue
        }

        const dadosAtuais =
          patrimonio?.dados &&
          typeof patrimonio.dados ===
            'object'
            ? patrimonio.dados
            : {}

        const {
          error:
            patrimonioUpdateError
        } = await supabase
          .from(
            'sigmo_patrimonios'
          )
          .update({
            status:
              'RESERVA',
            local_atual:
              'COFRE DO P4',
            responsavel_atual_id:
              null,
            responsavel_atual_nome:
              null,
            dados: {
              ...dadosAtuais,
              status:
                'RESERVA',
              status_operacional:
                'RESERVA',
              local_atual:
                'COFRE DO P4',
              carga_policial_id:
                null,
              carga_policial_re:
                null,
              carga_policial_nome:
                null,
              guardiao_atual:
                null
            },
            updated_at:
              new Date()
                .toISOString()
          })
          .eq(
            'id',
            patrimonio.id
          )

        if (
          patrimonioUpdateError
        ) {
          throw patrimonioUpdateError
        }

        if (
          patrimonio
            .referencia_id
        ) {
          const {
            error:
              coleteUpdateError
          } = await supabase
            .from(
              'sigmo_coletes_balisticos'
            )
            .update({
              status_operacional:
                'RESERVA',
              local_atual:
                'COFRE DO P4',
              carga_policial_id:
                null,
              carga_policial_re:
                null,
              carga_policial_nome:
                null,
              updated_at:
                new Date()
                  .toISOString()
            })
            .eq(
              'id',
              patrimonio
                .referencia_id
            )

          if (
            coleteUpdateError
          ) {
            throw coleteUpdateError
          }
        }
      }

      await onConcluido?.(
        movimentacao
      )
    } catch (error) {
      console.error(
        'Erro ao receber devolução de colete:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível receber a devolução do colete.'
      )
    } finally {
      setRecebendoId(
        null
      )
    }
  }

  return (
    <Modal
      titulo="Receber devolução"
      subtitulo="Confira fisicamente o colete devolvido pelo policial antes de confirmar o retorno ao COFRE DO P4."
      onClose={
        recebendoId
          ? undefined
          : onClose
      }
      amplo
    >
      {erro && (
        <div className="coletes-alert coletes-alert-error">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="coletes-loading">
          Carregando devoluções...
        </div>
      ) : lista.length === 0 ? (
        <div className="coletes-empty">
          Nenhuma devolução de colete balístico está pendente para o P4.
        </div>
      ) : (
        <div className="coletes-table-wrap">
          <table className="coletes-table">
            <thead>
              <tr>
                <th>
                  PATRIMÔNIO
                </th>

                <th>
                  SÉRIE
                </th>

                <th>
                  POLICIAL
                </th>

                <th>
                  SOLICITADO EM
                </th>

                <th>
                  DESTINO
                </th>

                <th>
                  AÇÃO
                </th>
              </tr>
            </thead>

            <tbody>
              {lista.flatMap(
                (movimentacao) =>
                  (
                    movimentacao
                      .itens || []
                  ).map(
                    (
                      item,
                      indice
                    ) => {
                      const patrimonio =
                        item
                          .patrimonio ||
                        {}

                      const dados =
                        patrimonio
                          .dados &&
                        typeof patrimonio
                          .dados ===
                          'object'
                          ? patrimonio
                              .dados
                          : {}

                      return (
                        <tr
                          key={`${movimentacao.id}-${item.id || indice}`}
                        >
                          <td>
                            <strong>
                              {patrimonio
                                .numero_patrimonio ||
                                dados
                                  .patrimonio ||
                                '—'}
                            </strong>
                          </td>

                          <td>
                            {patrimonio
                              .numero_serie ||
                              dados
                                .numero_serie ||
                              '—'}
                          </td>

                          <td>
                            <strong>
                              {movimentacao
                                .solicitante_nome ||
                                dados
                                  .carga_policial_nome ||
                                '—'}
                            </strong>

                            {dados
                              .carga_policial_re && (
                              <small className="coletes-table-subtitle">
                                RE{' '}
                                {
                                  dados
                                    .carga_policial_re
                                }
                              </small>
                            )}
                          </td>

                          <td>
                            {movimentacao
                              .created_at
                              ? new Date(
                                  movimentacao
                                    .created_at
                                )
                                  .toLocaleString(
                                    'pt-BR'
                                  )
                              : '—'}
                          </td>

                          <td>
                            COFRE DO P4
                          </td>

                          <td>
                            <button
                              type="button"
                              className="coletes-btn-primary coletes-btn-small"
                              disabled={
                                recebendoId ===
                                movimentacao.id
                              }
                              onClick={() =>
                                receber(
                                  movimentacao
                                )
                              }
                            >
                              {recebendoId ===
                              movimentacao.id
                                ? 'Recebendo...'
                                : 'Receber'}
                            </button>
                          </td>
                        </tr>
                      )
                    }
                  )
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="coletes-modal-actions">
        <button
          type="button"
          className="coletes-btn-secondary"
          onClick={onClose}
          disabled={
            Boolean(
              recebendoId
            )
          }
        >
          Fechar
        </button>
      </div>
    </Modal>
  )
}


function ModalDescargaColete({
  user,
  coletes,
  onClose,
  onConcluido
}) {
  const [
    selecionados,
    setSelecionados
  ] = useState([])

  const [
    motivo,
    setMotivo
  ] = useState('')

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const elegiveis =
    useMemo(
      () =>
        (coletes || [])
          .filter((colete) => {
            const status =
              normalizar(
                colete?.status_operacional
              )

            const local =
              normalizar(
                colete?.local_atual
              )

            return (
              colete?.ativo !== false &&
              colete?.descarga_pendente !== true &&
              status === 'RESERVA' &&
              (
                local === 'P4' ||
                local === 'COFRE DO P4' ||
                local === 'DEPOSITO DO P4'
              )
            )
          })
          .sort((a, b) =>
            String(
              a?.patrimonio || ''
            ).localeCompare(
              String(
                b?.patrimonio || ''
              ),
              'pt-BR',
              {
                numeric: true
              }
            )
          ),
      [coletes]
    )

  function alternar(id) {
    setSelecionados(
      (atuais) =>
        atuais.includes(id)
          ? atuais.filter(
              (item) =>
                item !== id
            )
          : [
              ...atuais,
              id
            ]
    )
  }

  function selecionarTodos() {
    const ids =
      elegiveis.map(
        (item) =>
          item.id
      )

    const todosMarcados =
      ids.length > 0 &&
      ids.every(
        (id) =>
          selecionados.includes(id)
      )

    setSelecionados(
      todosMarcados
        ? []
        : ids
    )
  }

  async function confirmar() {
    if (
      selecionados.length === 0
    ) {
      setErro(
        'Selecione ao menos um colete.'
      )
      return
    }

    const motivoNormalizado =
      normalizar(
        motivo
      )

    if (!motivoNormalizado) {
      setErro(
        'Selecione o motivo da descarga.'
      )
      return
    }

    const justificativa =
      [
        motivoNormalizado,
        normalizar(
          observacoes
        )
      ]
        .filter(Boolean)
        .join(' — ')

    const itensSelecionados =
      elegiveis.filter(
        (colete) =>
          selecionados.includes(
            colete.id
          )
      )

    const confirmou =
      window.confirm(
        `Enviar ${itensSelecionados.length} ${
          itensSelecionados.length === 1
            ? 'solicitação de descarga'
            : 'solicitações de descarga'
        } ao Comandante da Cia?\n\nOs coletes permanecerão ativos no COFRE DO P4 até a decisão.`
      )

    if (!confirmou) {
      return
    }

    try {
      setSalvando(true)
      setErro('')

      const falhas = []
      let concluidos = 0

      for (
        const colete of
        itensSelecionados
      ) {
        try {
          await desativarColeteBalistico(
            colete.id,
            user,
            justificativa
          )

          concluidos += 1
        } catch (error) {
          falhas.push({
            colete,
            error
          })
        }
      }

      await onConcluido?.({
        quantidade:
          concluidos,
        parcial:
          falhas.length > 0
      })

      if (
        falhas.length > 0
      ) {
        setErro(
          `${concluidos} ${
            concluidos === 1
              ? 'solicitação foi enviada'
              : 'solicitações foram enviadas'
          } e ${falhas.length} ${
            falhas.length === 1
              ? 'apresentou erro'
              : 'apresentaram erro'
          }. ${
            falhas[0]?.error?.message ||
            ''
          }`
        )
      }
    } catch (error) {
      console.error(
        'Erro ao solicitar descarga:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a descarga.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo="Solicitar descarga"
      subtitulo="A baixa definitiva só ocorre após aprovação do Comandante da Cia."
      onClose={
        salvando
          ? undefined
          : onClose
      }
      amplo
    >
      {erro && (
        <div className="coletes-alert coletes-alert-error">
          {erro}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gap: '16px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <strong>
              Coletes disponíveis
            </strong>

            <div
              style={{
                marginTop: '4px',
                color: '#667085',
                fontSize: '0.82rem'
              }}
            >
              Somente RESERVA no COFRE DO P4 e sem solicitação pendente.
            </div>
          </div>

          <button
            type="button"
            className="coletes-btn-secondary coletes-btn-small"
            onClick={
              selecionarTodos
            }
            disabled={
              salvando ||
              elegiveis.length === 0
            }
          >
            {elegiveis.length > 0 &&
            elegiveis.every(
              (item) =>
                selecionados.includes(
                  item.id
                )
            )
              ? 'Desmarcar todos'
              : 'Selecionar todos'}
          </button>
        </div>

        {elegiveis.length === 0 ? (
          <div className="coletes-empty">
            Nenhum colete disponível para nova solicitação de descarga.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '8px',
              maxHeight: '330px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}
          >
            {elegiveis.map(
              (colete) => {
                const situacaoValidade =
                  obterSituacaoValidadeColete(
                    colete
                  )

                return (
                  <label
                    key={
                      colete.id
                    }
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'auto minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      border:
                        selecionados.includes(
                          colete.id
                        )
                          ? '1px solid #2563eb'
                          : '1px solid #d6deea',
                      borderRadius: '12px',
                      background:
                        selecionados.includes(
                          colete.id
                        )
                          ? '#eff6ff'
                          : '#fff',
                      cursor:
                        salvando
                          ? 'default'
                          : 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selecionados.includes(
                          colete.id
                        )
                      }
                      disabled={
                        salvando
                      }
                      onChange={() =>
                        alternar(
                          colete.id
                        )
                      }
                    />

                    <div>
                      <strong>
                        {colete.patrimonio ||
                          'SEM PATRIMÔNIO'}
                      </strong>

                      <div
                        style={{
                          marginTop: '3px',
                          color: '#667085',
                          fontSize: '0.78rem'
                        }}
                      >
                        Série {colete.numero_serie || '—'}
                        {' • '}
                        Lote {colete.numero_lote || '—'}
                        {' • '}
                        {colete.sexo || '—'} {colete.tamanho || ''}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                        color:
                          situacaoValidade ===
                          'VENCIDO'
                            ? '#b42318'
                            : situacaoValidade ===
                              'ALERTA'
                            ? '#b54708'
                            : '#067647'
                      }}
                    >
                      {situacaoValidade ===
                      'VENCIDO'
                        ? 'VENCIDO'
                        : situacaoValidade ===
                          'ALERTA'
                        ? 'VALIDADE PRÓXIMA'
                        : 'REGULAR'}
                    </span>
                  </label>
                )
              }
            )}
          </div>
        )}

        <div
          className="coletes-form-grid"
        >
          <Campo
            label="MOTIVO DA DESCARGA"
            full
          >
            <select
              className="coletes-select"
              value={motivo}
              disabled={salvando}
              onChange={(event) =>
                setMotivo(
                  event.target.value
                )
              }
            >
              <option value="">
                Selecione
              </option>

              <option value="VENCIMENTO DA VALIDADE">
                Vencimento da validade
              </option>

              <option value="AVARIA / DANO">
                Avaria / dano
              </option>

              <option value="SEM CONDIÇÃO DE USO">
                Sem condição de uso
              </option>

              <option value="OUTRO MOTIVO">
                Outro motivo
              </option>
            </select>
          </Campo>

          <Campo
            label="OBSERVAÇÃO / JUSTIFICATIVA COMPLEMENTAR"
            full
          >
            <textarea
              className="coletes-textarea"
              rows={4}
              value={
                observacoes
              }
              disabled={
                salvando
              }
              placeholder="Documento, processo, observações ou demais informações."
              onChange={(event) =>
                setObservacoes(
                  event.target.value.toUpperCase()
                )
              }
            />
          </Campo>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px solid #fedf89',
            background: '#fffaeb',
            color: '#93370d',
            fontSize: '0.80rem',
            fontWeight: 700,
            lineHeight: 1.45
          }}
        >
          Enquanto aguarda decisão, o colete permanece ativo e em RESERVA no COFRE DO P4, mas fica bloqueado para nova carga.
        </div>
      </div>

      <div className="coletes-modal-actions">
        <button
          type="button"
          className="coletes-btn-secondary"
          onClick={onClose}
          disabled={salvando}
        >
          Cancelar
        </button>

        <button
          type="button"
          className="coletes-btn-primary"
          onClick={confirmar}
          disabled={
            salvando ||
            selecionados.length === 0
          }
        >
          {salvando
            ? 'Enviando...'
            : `Solicitar descarga${
                selecionados.length > 0
                  ? ` (${selecionados.length})`
                  : ''
              }`}
        </button>
      </div>
    </Modal>
  )
}


function ModalDecisaoDescargaColete({
  user,
  solicitacoes,
  onClose,
  onAtualizar
}) {
  const [
    processandoId,
    setProcessandoId
  ] = useState(null)

  const [
    processandoTodas,
    setProcessandoTodas
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  async function decidir(
    solicitacao,
    decisao
  ) {
    let observacoes = ''

    if (
      decisao === 'REPROVAR' ||
      decisao === 'DILIGENCIA'
    ) {
      const resposta =
        window.prompt(
          decisao === 'REPROVAR'
            ? 'Informe a justificativa da reprovação:'
            : 'Informe a diligência / providência necessária:'
        )

      if (resposta === null) {
        return
      }

      observacoes =
        String(resposta || '')
          .trim()
          .toUpperCase()

      if (!observacoes) {
        setErro(
          'A justificativa é obrigatória para essa decisão.'
        )
        return
      }
    }

    if (
      decisao === 'APROVAR'
    ) {
      const confirmou =
        window.confirm(
          `Confirmar a descarga definitiva do colete ${
            solicitacao?.patrimonio ||
            solicitacao?.numero_serie ||
            ''
          }?`
        )

      if (!confirmou) {
        return
      }
    }

    try {
      setErro('')
      setProcessandoId(
        solicitacao.id
      )

      await decidirDescargaColete({
        solicitacao,
        decisao,
        observacoes,
        user
      })

      await onAtualizar?.()
    } catch (error) {
      console.error(
        'Erro ao decidir descarga:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível registrar a decisão.'
      )
    } finally {
      setProcessandoId(null)
    }
  }

  async function aprovarTodas() {
    if (
      !Array.isArray(
        solicitacoes
      ) ||
      solicitacoes.length === 0
    ) {
      return
    }

    const confirmou =
      window.confirm(
        `Confirmar a descarga definitiva de ${solicitacoes.length} ${
          solicitacoes.length === 1
            ? 'colete'
            : 'coletes'
        }?`
      )

    if (!confirmou) {
      return
    }

    try {
      setErro('')
      setProcessandoTodas(
        true
      )

      const falhas = []

      for (
        const solicitacao of
        solicitacoes
      ) {
        try {
          await decidirDescargaColete({
            solicitacao,
            decisao:
              'APROVAR',
            observacoes:
              '',
            user
          })
        } catch (error) {
          falhas.push({
            solicitacao,
            error
          })
        }
      }

      await onAtualizar?.()

      if (
        falhas.length > 0
      ) {
        setErro(
          `${falhas.length} ${
            falhas.length === 1
              ? 'solicitação não pôde ser aprovada'
              : 'solicitações não puderam ser aprovadas'
          }. ${
            falhas[0]?.error?.message ||
            ''
          }`
        )
      }
    } finally {
      setProcessandoTodas(
        false
      )
    }
  }

  return (
    <Modal
      titulo="Descargas pendentes"
      subtitulo="Solicitações do P4 aguardando decisão do Comandante da Cia."
      onClose={
        processandoId ||
        processandoTodas
          ? undefined
          : onClose
      }
      amplo
    >
      {erro && (
        <div className="coletes-alert coletes-alert-error">
          {erro}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '14px',
          flexWrap: 'wrap'
        }}
      >
        <strong>
          {solicitacoes.length}{' '}
          {solicitacoes.length === 1
            ? 'solicitação pendente'
            : 'solicitações pendentes'}
        </strong>

        <button
          type="button"
          className="coletes-btn-primary coletes-btn-small"
          onClick={
            aprovarTodas
          }
          disabled={
            processandoTodas ||
            Boolean(
              processandoId
            ) ||
            solicitacoes.length === 0
          }
        >
          {processandoTodas
            ? 'Aprovando...'
            : 'Aprovar todas'}
        </button>
      </div>

      {solicitacoes.length === 0 ? (
        <div className="coletes-empty">
          Nenhuma descarga aguardando aprovação.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '10px',
            maxHeight: '470px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}
        >
          {solicitacoes.map(
            (solicitacao) => {
              const ocupado =
                processandoId ===
                solicitacao.id

              return (
                <article
                  key={
                    solicitacao.id
                  }
                  style={{
                    border:
                      '1px solid #dbe4ee',
                    borderRadius:
                      '12px',
                    padding:
                      '14px',
                    background:
                      '#fff'
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(0, 1fr) auto',
                      gap: '14px',
                      alignItems: 'start'
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          display: 'block',
                          color: '#0f2947',
                          fontSize: '0.95rem'
                        }}
                      >
                        {solicitacao.patrimonio ||
                          'SEM PATRIMÔNIO'}
                      </strong>

                      <div
                        style={{
                          marginTop: '4px',
                          color: '#667085',
                          fontSize: '0.78rem',
                          lineHeight: 1.5
                        }}
                      >
                        Série{' '}
                        {solicitacao.numero_serie ||
                          '—'}
                        {' • '}
                        Solicitado por{' '}
                        {solicitacao.solicitada_por_nome ||
                          'P4'}
                        {' • '}
                        {solicitacao.solicitada_em
                          ? new Date(
                              solicitacao.solicitada_em
                            ).toLocaleString(
                              'pt-BR'
                            )
                          : 'Data não informada'}
                      </div>

                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          color: '#344054',
                          fontSize: '0.78rem'
                        }}
                      >
                        <strong>
                          Motivo:
                        </strong>{' '}
                        {solicitacao.motivo ||
                          solicitacao.observacoes ||
                          'Não informado'}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '5px 9px',
                        borderRadius: '999px',
                        background: '#fff7ed',
                        color: '#b54708',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      AGUARDANDO APROVAÇÃO
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '8px',
                      marginTop: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      type="button"
                      className="coletes-btn-secondary coletes-btn-small"
                      disabled={
                        ocupado ||
                        processandoTodas
                      }
                      onClick={() =>
                        decidir(
                          solicitacao,
                          'DILIGENCIA'
                        )
                      }
                    >
                      Diligência
                    </button>

                    <button
                      type="button"
                      className="coletes-btn-secondary coletes-btn-small"
                      disabled={
                        ocupado ||
                        processandoTodas
                      }
                      onClick={() =>
                        decidir(
                          solicitacao,
                          'REPROVAR'
                        )
                      }
                    >
                      Reprovar
                    </button>

                    <button
                      type="button"
                      className="coletes-btn-primary coletes-btn-small"
                      disabled={
                        ocupado ||
                        processandoTodas
                      }
                      onClick={() =>
                        decidir(
                          solicitacao,
                          'APROVAR'
                        )
                      }
                    >
                      {ocupado
                        ? 'Processando...'
                        : 'Aprovar descarga'}
                    </button>
                  </div>
                </article>
              )
            }
          )}
        </div>
      )}

      <div className="coletes-modal-actions">
        <button
          type="button"
          className="coletes-btn-secondary"
          onClick={onClose}
          disabled={
            Boolean(
              processandoId
            ) ||
            processandoTodas
          }
        >
          Fechar
        </button>
      </div>
    </Modal>
  )
}


export default function ColeteBalistico({
  user,
  onVoltar = null
}) {
  const gerencia =
    useMemo(
      () =>
        podeGerenciar(user),
      [user]
    )

  const podePagar =
    useMemo(
      () =>
        podePagarCarga(user),
      [user]
    )

  const podeDecidir =
    useMemo(
      () =>
        podeDecidirDescarga(
          user
        ),
      [user]
    )

  const [
    coletes,
    setColetes
  ] = useState([])

  const [
    resumo,
    setResumo
  ] = useState({
    total: 0,
    reserva: 0,
    cargaIndividual: 0,
    aguardandoRecebimento: 0,
    manutencao: 0,
    transferidos: 0,
    vencendo: 0,
    vencidos: 0
  })

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    mensagem,
    setMensagem
  ] = useState('')

  const [
    filtroPesquisa,
    setFiltroPesquisa
  ] = useState('')

  const [
    filtroSexo,
    setFiltroSexo
  ] = useState('')

  const [
    filtroTamanho,
    setFiltroTamanho
  ] = useState('')

  const [
    filtroModelagem,
    setFiltroModelagem
  ] = useState('')

  const [
    filtroStatus,
    setFiltroStatus
  ] = useState('')

  const [
    filtroValidade,
    setFiltroValidade
  ] = useState('')


  const [
    filtroGraficoSexo,
    setFiltroGraficoSexo
  ] = useState('TODOS')

  const [
    filtroGraficoTamanho,
    setFiltroGraficoTamanho
  ] = useState('TODOS')

  const [
    filtroGraficoSituacao,
    setFiltroGraficoSituacao
  ] = useState('TODOS')

  const [
    filtroGraficoValidade,
    setFiltroGraficoValidade
  ] = useState('TODAS')

  const [
    modalCadastro,
    setModalCadastro
  ] = useState(false)

  const [
    modalPagarCarga,
    setModalPagarCarga
  ] = useState(false)

  const [
    modalReceberDevolucao,
    setModalReceberDevolucao
  ] = useState(false)

  const [
    modalDescarga,
    setModalDescarga
  ] = useState(false)

  const [
    modalDecisaoDescarga,
    setModalDecisaoDescarga
  ] = useState(false)

  const [
    descargasPendentes,
    setDescargasPendentes
  ] = useState([])

  const [
    coleteDetalhes,
    setColeteDetalhes
  ] = useState(null)

  const [
    coleteEdicao,
    setColeteEdicao
  ] = useState(null)

  const tabelaScrollRef =
    useRef(null)

  const tabelaScrollTopoRef =
    useRef(null)

  const tabelaRef =
    useRef(null)

  const [
    larguraTabela,
    setLarguraTabela
  ] = useState(0)

  const carregar =
    useCallback(async () => {
      if (!gerencia) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setErro('')

        const [
          lista,
          pendenciasDescarga
        ] = await Promise.all([
          listarColetesBalisticos({
            filtros: {
              ativo: true
            },
            pagina: 1,
            limite: 10000
          }),

          listarDescargasColetesPendentes()
        ])

        setDescargasPendentes(
          Array.isArray(
            pendenciasDescarga
          )
            ? pendenciasDescarga
            : []
        )

        const listaEfetiva =
          await aplicarPendenciasRecebimentoCarga(
            lista?.data || []
          )

        setColetes(
          listaEfetiva
        )

        setResumo(
          calcularResumoColetes(
            listaEfetiva
          )
        )
      } catch (error) {
        console.error(error)

        setErro(
          error?.message ||
          'Não foi possível carregar o módulo de coletes balísticos.'
        )
      } finally {
        setLoading(false)
      }
    }, [gerencia])

  useEffect(() => {
    carregar()
  }, [carregar])


  useEffect(() => {
    function atualizarLarguraTabela() {
      setLarguraTabela(
        tabelaRef.current?.scrollWidth ||
        0
      )
    }

    atualizarLarguraTabela()

    window.addEventListener(
      'resize',
      atualizarLarguraTabela
    )

    return () =>
      window.removeEventListener(
        'resize',
        atualizarLarguraTabela
      )
  }, [
    coletes,
    loading,
    filtroPesquisa,
    filtroSexo,
    filtroTamanho,
    filtroModelagem,
    filtroStatus,
    filtroValidade
  ])

  const filtrados =
    useMemo(() => {
      const pesquisa =
        normalizar(
          filtroPesquisa
        )

      return coletes.filter(
        (colete) => {
          if (
            pesquisa &&
            ![
              colete.patrimonio,
              colete.numero_serie,
              colete.numero_lote,
              colete.fabricante,
              colete.modelo,
              colete.carga_policial_nome,
              colete.carga_policial_re
            ].some(
              (valor) =>
                normalizar(
                  valor
                ).includes(
                  pesquisa
                )
            )
          ) {
            return false
          }

          if (
            filtroSexo &&
            normalizar(
              colete.sexo
            ) !==
              normalizar(
                filtroSexo
              )
          ) {
            return false
          }

          if (
            filtroTamanho &&
            normalizar(
              colete.tamanho
            ) !==
              normalizar(
                filtroTamanho
              )
          ) {
            return false
          }

          if (
            filtroModelagem &&
            normalizar(
              colete.modelagem
            ) !==
              normalizar(
                filtroModelagem
              )
          ) {
            return false
          }

          if (
            filtroStatus &&
            normalizar(
              colete.status_operacional
            ) !==
              normalizar(
                filtroStatus
              )
          ) {
            return false
          }

          if (filtroValidade) {
            const situacao =
              obterSituacaoValidadeColete(
                colete
              )

            if (
              filtroValidade ===
                'ALERTA' &&
              situacao !== 'ALERTA'
            ) {
              return false
            }

            if (
              filtroValidade ===
                'VENCIDO' &&
              situacao !== 'VENCIDO'
            ) {
              return false
            }

            if (
              filtroValidade ===
                'OK' &&
              situacao !== 'OK'
            ) {
              return false
            }
          }

          return true
        }
      )
    }, [
      coletes,
      filtroPesquisa,
      filtroSexo,
      filtroTamanho,
      filtroModelagem,
      filtroStatus,
      filtroValidade
    ])

  const resumoSexo =
    useMemo(() => {
      const inicial = {
        total: {
          masculino: 0,
          feminino: 0
        },
        reserva: {
          masculino: 0,
          feminino: 0
        },
        cargaIndividual: {
          masculino: 0,
          feminino: 0
        },
        manutencao: {
          masculino: 0,
          feminino: 0
        },
        vencendo: {
          masculino: 0,
          feminino: 0
        },
        vencidos: {
          masculino: 0,
          feminino: 0
        }
      }

      return coletes.reduce(
        (acc, colete) => {
          const sexo =
            normalizar(
              colete?.sexo
            )

          const chaveSexo =
            sexo === 'MASCULINO'
              ? 'masculino'
              : sexo === 'FEMININO'
                ? 'feminino'
                : null

          if (!chaveSexo) {
            return acc
          }

          acc.total[chaveSexo] += 1

          const status =
            normalizar(
              colete?.status_operacional
            )

          if (status === 'RESERVA') {
            acc.reserva[chaveSexo] += 1
          }

          if (
            status ===
            'CARGA_INDIVIDUAL'
          ) {
            acc.cargaIndividual[
              chaveSexo
            ] += 1
          }

          if (
            status ===
            'MANUTENCAO'
          ) {
            acc.manutencao[
              chaveSexo
            ] += 1
          }

          const situacaoValidade =
            obterSituacaoValidadeColete(
              colete
            )

          if (
            situacaoValidade ===
            'ALERTA'
          ) {
            acc.vencendo[
              chaveSexo
            ] += 1
          }

          if (
            situacaoValidade ===
            'VENCIDO'
          ) {
            acc.vencidos[
              chaveSexo
            ] += 1
          }

          return acc
        },
        inicial
      )
    }, [coletes])

  function detalheSexo(
    dados
  ) {
    return (
      <span
        style={{
          display: 'grid',
          gap: '3px',
          width: '100%'
        }}
      >
        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <span>MASCULINO</span>
          <strong>
            {dados?.masculino || 0}
          </strong>
        </span>

        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <span>FEMININO</span>
          <strong>
            {dados?.feminino || 0}
          </strong>
        </span>
      </span>
    )
  }

  const dadosGrafico =
    useMemo(() => {
      const contagem = {
        aguardando: 0,
        vencidos: 0,
        vencendo: 0,
        carga: 0,
        reserva: 0,
        outros: 0
      }

      for (
        const colete of
        coletes || []
      ) {
        if (
          colete?.ativo === false
        ) {
          continue
        }

        const status =
          normalizar(
            colete?.status_operacional
          )
            .replaceAll(
              ' ',
              '_'
            )

        /*
         * A rosca é exclusiva: cada colete ocupa uma única fatia.
         * Pendência de recebimento tem prioridade operacional.
         * Depois aparecem os alertas de validade.
         * Os cards continuam mostrando os indicadores completos.
         */
        if (
          status ===
          'AGUARDANDO_RECEBIMENTO'
        ) {
          contagem.aguardando += 1
          continue
        }

        const validade =
          obterSituacaoValidadeColete(
            colete
          )

        if (
          validade ===
          'VENCIDO'
        ) {
          contagem.vencidos += 1
          continue
        }

        if (
          validade ===
          'ALERTA'
        ) {
          contagem.vencendo += 1
          continue
        }

        if (
          status ===
          'CARGA_INDIVIDUAL'
        ) {
          contagem.carga += 1
          continue
        }

        if (
          status ===
          'RESERVA'
        ) {
          contagem.reserva += 1
          continue
        }

        contagem.outros += 1
      }

      const itens = [
        {
          label:
            'Reserva',
          valor:
            contagem.reserva,
          cor:
            '#22c55e'
        },
        {
          label:
            'Carga individual',
          valor:
            contagem.carga,
          cor:
            '#8b5cf6'
        },
        {
          label:
            'Aguardando recebimento',
          valor:
            contagem.aguardando,
          cor:
            '#3b82f6'
        },
        {
          label:
            'Validade próxima',
          valor:
            contagem.vencendo,
          cor:
            '#f59e0b'
        },
        {
          label:
            'Vencidos',
          valor:
            contagem.vencidos,
          cor:
            '#dc2626'
        }
      ]

      if (
        contagem.outros > 0
      ) {
        itens.push({
          label:
            'Outras situações',
          valor:
            contagem.outros,
          cor:
            '#64748b'
        })
      }

      return itens
    }, [
      coletes
    ])

  const tamanhosGraficoDisponiveis =
    useMemo(() => {
      const contagem =
        new Map()

      for (
        const colete of
        coletes || []
      ) {
        if (
          colete?.ativo === false
        ) {
          continue
        }

        const sexo =
          normalizar(
            colete?.sexo
          )

        if (
          filtroGraficoSexo !==
            'TODOS' &&
          sexo !==
            filtroGraficoSexo
        ) {
          continue
        }

        const tamanho =
          normalizar(
            colete?.tamanho
          )

        if (!tamanho) {
          continue
        }

        contagem.set(
          tamanho,
          (
            contagem.get(
              tamanho
            ) || 0
          ) + 1
        )
      }

      const ordem =
        new Map(
          COLETE_BALISTICO_TAMANHOS.map(
            (
              tamanho,
              indice
            ) => [
              normalizar(
                tamanho
              ),
              indice
            ]
          )
        )

      return [
        ...contagem.entries()
      ]
        .map(
          ([
            tamanho,
            quantidade
          ]) => ({
            tamanho,
            quantidade
          })
        )
        .sort(
          (a, b) => {
            const ordemA =
              ordem.has(
                a.tamanho
              )
                ? ordem.get(
                    a.tamanho
                  )
                : 999

            const ordemB =
              ordem.has(
                b.tamanho
              )
                ? ordem.get(
                    b.tamanho
                  )
                : 999

            if (
              ordemA !==
              ordemB
            ) {
              return (
                ordemA -
                ordemB
              )
            }

            return a.tamanho.localeCompare(
              b.tamanho,
              'pt-BR',
              {
                numeric: true
              }
            )
          }
        )
    }, [
      coletes,
      filtroGraficoSexo
    ])

  const coletesGradeFiltrados =
    useMemo(() => {
      return coletes.filter(
        (colete) => {
          const sexo =
            normalizar(
              colete?.sexo
            )

          if (
            filtroGraficoSexo !==
              'TODOS' &&
            sexo !==
              filtroGraficoSexo
          ) {
            return false
          }

          const tamanho =
            normalizar(
              colete?.tamanho
            )

          if (
            filtroGraficoTamanho !==
              'TODOS' &&
            tamanho !==
              filtroGraficoTamanho
          ) {
            return false
          }

          const status =
            normalizar(
              colete?.status_operacional
            )

          if (
            filtroGraficoSituacao !==
              'TODOS' &&
            status !==
              filtroGraficoSituacao
          ) {
            return false
          }

          const situacaoValidade =
            obterSituacaoValidadeColete(
              colete
            )

          if (
            filtroGraficoValidade ===
              'VALIDADE_PROXIMA' &&
            situacaoValidade !==
              'ALERTA'
          ) {
            return false
          }

          if (
            filtroGraficoValidade ===
              'VENCIDOS' &&
            situacaoValidade !==
              'VENCIDO'
          ) {
            return false
          }

          return true
        }
      )
    }, [
      coletes,
      filtroGraficoSexo,
      filtroGraficoTamanho,
      filtroGraficoSituacao,
      filtroGraficoValidade
    ])

  const cargasGradeFiltradas =
    useMemo(
      () =>
        coletesGradeFiltrados
          .filter(
            (colete) =>
              normalizar(
                colete?.status_operacional
              ) ===
                'CARGA_INDIVIDUAL' &&
              (
                colete?.carga_policial_nome ||
                colete?.carga_policial_re
              )
          )
          .sort(
            (a, b) =>
              String(
                a?.patrimonio || ''
              ).localeCompare(
                String(
                  b?.patrimonio || ''
                ),
                'pt-BR',
                {
                  numeric: true
                }
              )
          ),
      [
        coletesGradeFiltrados
      ]
    )

  const dadosTamanhos =
    useMemo(() => {
      const contagem =
        new Map()

      for (
        const colete of
        coletesGradeFiltrados
      ) {
        const chave =
          `${colete.tamanho} · ${formatarModelagem(colete.modelagem)}`

        contagem.set(
          chave,
          (
            contagem.get(
              chave
            ) || 0
          ) + 1
        )
      }

      return [
        ...contagem.entries()
      ]
        .map(
          ([
            label,
            valor
          ]) => ({
            label,
            valor
          })
        )
        .sort(
          (a, b) =>
            b.valor -
            a.valor
        )
    }, [
      coletesGradeFiltrados
    ])

  function limparFiltros() {
    setFiltroPesquisa('')
    setFiltroSexo('')
    setFiltroTamanho('')
    setFiltroModelagem('')
    setFiltroStatus('')
    setFiltroValidade('')
  }

  async function aposSalvar() {
    setMensagem(
      'Cadastro do colete atualizado com sucesso.'
    )

    await carregar()
  }

  if (!gerencia) {
    return (
      <main className="coletes-page">
        <section className="coletes-access-denied">
          <span>
            SIGMO • COLETE BALÍSTICO
          </span>

          <h1>
            Acesso restrito ao P4
          </h1>

          <p>
            Coletes balísticos são materiais de carga individual administrados pelo P4 e não fazem parte do fluxo do SVDD.
          </p>

          {typeof onVoltar ===
            'function' && (
            <button
              type="button"
              className="coletes-btn-secondary"
              onClick={onVoltar}
            >
              ← Voltar
            </button>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="coletes-page">
      <header className="coletes-header">
        <div>
          <span className="coletes-eyebrow">
            SIGMO • EQUIPAMENTO DE PROTEÇÃO
          </span>

          <h1>
            Coletes Balísticos
          </h1>

          <p>
            Controle patrimonial individual de coletes balísticos do P4, com rastreabilidade por patrimônio, série, lote, grade de tamanho e validade.
          </p>
        </div>

        <div className="coletes-header-actions">
          {typeof onVoltar ===
            'function' && (
            <button
              type="button"
              className="coletes-btn-secondary"
              onClick={onVoltar}
            >
              ← Voltar
            </button>
          )}

          <button
            type="button"
            className="coletes-btn-secondary"
            onClick={carregar}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>

          <button
            type="button"
            className="coletes-btn-primary"
            onClick={() =>
              setModalCadastro(
                true
              )
            }
          >
            + Cadastrar colete
          </button>
        </div>
      </header>

      {erro && (
        <div className="coletes-alert coletes-alert-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="coletes-alert coletes-alert-success">
          {mensagem}
        </div>
      )}

      <section className="coletes-resumo-grid">
        <CardResumo
          titulo="TOTAL CONTROLADO"
          valor={resumo.total}
          subtitulo={
            detalheSexo(
              resumoSexo.total
            )
          }
        />

        <CardResumo
          titulo="RESERVA NO P4"
          valor={resumo.reserva}
          subtitulo={
            detalheSexo(
              resumoSexo.reserva
            )
          }
        />

        <CardResumo
          titulo="CARGA INDIVIDUAL"
          valor={
            resumo.cargaIndividual
          }
          subtitulo={
            detalheSexo(
              resumoSexo.cargaIndividual
            )
          }
        />

        <CardResumo
          titulo="MANUTENÇÃO"
          valor={
            resumo.manutencao
          }
          subtitulo={
            detalheSexo(
              resumoSexo.manutencao
            )
          }
        />

        <CardResumo
          titulo="VALIDADE PRÓXIMA"
          valor={
            resumo.vencendo
          }
          subtitulo={
            detalheSexo(
              resumoSexo.vencendo
            )
          }
        />

        <CardResumo
          titulo="VENCIDOS"
          valor={
            resumo.vencidos
          }
          subtitulo={
            detalheSexo(
              resumoSexo.vencidos
            )
          }
        />
      </section>

      <section
        className="coletes-charts-grid"
        style={{
          gridTemplateColumns:
            '1fr'
        }}
      >
        <GraficoRosca
          total={
            resumo.total
          }
          itens={
            dadosGrafico
          }
        />

        <section className="coletes-chart-card">
          <div className="coletes-chart-header">
            <div>
              <span>
                Grade de tamanhos
              </span>

              <h2>
                Distribuição por tamanho
              </h2>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '12px',
              marginBottom: '18px'
            }}
          >
            <div>
              <span
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#667085',
                  fontSize: '0.7rem',
                  fontWeight: 850,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                Sexo
              </span>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                {[
                  ['TODOS', 'Todos'],
                  ['MASCULINO', 'Masculino'],
                  ['FEMININO', 'Feminino']
                ].map(
                  ([
                    valor,
                    label
                  ]) => (
                    <button
                      key={valor}
                      type="button"
                      className={
                        filtroGraficoSexo ===
                        valor
                          ? 'coletes-btn-primary coletes-btn-small'
                          : 'coletes-btn-secondary coletes-btn-small'
                      }
                      onClick={() => {
                        setFiltroGraficoSexo(
                          valor
                        )

                        setFiltroGraficoTamanho(
                          'TODOS'
                        )
                      }}
                    >
                      {label}
                    </button>
                  )
                )}

                <select
                  value={
                    filtroGraficoTamanho
                  }
                  onChange={(event) =>
                    setFiltroGraficoTamanho(
                      event.target.value
                    )
                  }
                  title="Filtrar pelos tamanhos existentes para o sexo selecionado"
                  style={{
                    minWidth: '190px',
                    minHeight: '34px',
                    padding: '0 34px 0 11px',
                    border: '1px solid #cfd8e6',
                    borderRadius: '9px',
                    background: '#fff',
                    color: '#344054',
                    fontSize: '0.78rem',
                    fontWeight: 750,
                    cursor: 'pointer'
                  }}
                >
                  <option value="TODOS">
                    Todos os tamanhos
                  </option>

                  {tamanhosGraficoDisponiveis.map(
                    (item) => (
                      <option
                        key={
                          item.tamanho
                        }
                        value={
                          item.tamanho
                        }
                      >
                        {item.tamanho}
                        {' '}
                        ({item.quantidade})
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#667085',
                  fontSize: '0.7rem',
                  fontWeight: 850,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                Situação
              </span>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                {[
                  ['TODOS', 'Todos'],
                  ['RESERVA', 'Reserva'],
                  ['CARGA_INDIVIDUAL', 'Carga individual'],
                  ['AGUARDANDO_RECEBIMENTO', 'Aguardando recebimento']
                ].map(
                  ([
                    valor,
                    label
                  ]) => (
                    <button
                      key={valor}
                      type="button"
                      className={
                        filtroGraficoSituacao ===
                        valor
                          ? 'coletes-btn-primary coletes-btn-small'
                          : 'coletes-btn-secondary coletes-btn-small'
                      }
                      onClick={() =>
                        setFiltroGraficoSituacao(
                          valor
                        )
                      }
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#667085',
                  fontSize: '0.7rem',
                  fontWeight: 850,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                Validade
              </span>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                {[
                  ['TODAS', 'Todas'],
                  ['VALIDADE_PROXIMA', 'Validade próxima'],
                  ['VENCIDOS', 'Vencidos']
                ].map(
                  ([
                    valor,
                    label
                  ]) => (
                    <button
                      key={valor}
                      type="button"
                      className={
                        filtroGraficoValidade ===
                        valor
                          ? 'coletes-btn-primary coletes-btn-small'
                          : 'coletes-btn-secondary coletes-btn-small'
                      }
                      onClick={() =>
                        setFiltroGraficoValidade(
                          valor
                        )
                      }
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            <div
              style={{
                color: '#667085',
                fontSize: '0.76rem',
                fontWeight: 700
              }}
            >
              {coletesGradeFiltrados.length}{' '}
              colete(s) no recorte selecionado
              {' • '}
              {filtroGraficoSexo === 'TODOS'
                ? 'Todos os sexos'
                : filtroGraficoSexo === 'MASCULINO'
                ? 'Masculino'
                : 'Feminino'}
              {' • '}
              {filtroGraficoTamanho === 'TODOS'
                ? 'Todos os tamanhos'
                : `Tamanho ${filtroGraficoTamanho}`}
              {' • '}
              {filtroGraficoSituacao === 'TODOS'
                ? 'Todas as situações'
                : filtroGraficoSituacao === 'RESERVA'
                ? 'Reserva'
                : filtroGraficoSituacao === 'CARGA_INDIVIDUAL'
                ? 'Carga individual'
                : 'Aguardando recebimento'}
              {' • '}
              {filtroGraficoValidade === 'TODAS'
                ? 'Todas as validades'
                : filtroGraficoValidade === 'VALIDADE_PROXIMA'
                ? 'Validade próxima'
                : 'Vencidos'}
            </div>
          </div>

          <GraficoBarras
            itens={
              dadosTamanhos
            }
          />


          {cargasGradeFiltradas.length > 0 && (
            <div
              style={{
                marginTop: '18px',
                paddingTop: '16px',
                borderTop:
                  '1px solid #e4e9f0'
              }}
            >
              <div
                style={{
                  marginBottom: '10px'
                }}
              >
                <span
                  style={{
                    display: 'block',
                    color: '#667085',
                    fontSize: '0.7rem',
                    fontWeight: 850,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}
                >
                  Coletes em carga neste recorte
                </span>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '3px',
                    color: '#101828',
                    fontSize: '0.9rem'
                  }}
                >
                  Quem está com os coletes selecionados
                </strong>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '8px'
                }}
              >
                {cargasGradeFiltradas.map(
                  (colete) => (
                    <div
                      key={
                        `GRADE-CARGA-${colete.id}`
                      }
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'minmax(110px, .7fr) minmax(180px, 1.4fr) minmax(110px, .8fr)',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '9px 11px',
                        border:
                          '1px solid #dbe4ee',
                        borderRadius:
                          '9px',
                        background:
                          '#f8fafc',
                        fontSize:
                          '0.76rem'
                      }}
                    >
                      <strong>
                        {colete.patrimonio ||
                          colete.numero_serie ||
                          '—'}
                      </strong>

                      <span>
                        {colete.carga_policial_nome ||
                          'Policial não informado'}
                        {colete.carga_policial_re
                          ? ` • RE ${colete.carga_policial_re}`
                          : ''}
                      </span>

                      <span
                        style={{
                          fontWeight: 750
                        }}
                      >
                        Validade{' '}
                        {formatarData(
                          colete.validade
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="coletes-operations-section">
        <div className="coletes-operations-title">
          <div>
            <span>
              Operações permitidas
            </span>

            <h2>
              Movimentações de coletes balísticos
            </h2>
          </div>
        </div>

        <div className="coletes-operation-groups">
          <GrupoOperacao
            icone="📦"
            titulo="Carga e movimentações"
            descricao="Distribuição patrimonial realizada exclusivamente pelo P4."
          >
            <button
              type="button"
              disabled={!podePagar}
              title={
                podePagar
                  ? 'Pagar colete como carga individual.'
                  : 'Operação exclusiva do P4.'
              }
              onClick={() =>
                setModalPagarCarga(
                  true
                )
              }
            >
              <strong>
                Pagar carga individual
              </strong>

              <span>
                Vincular um colete disponível à carga permanente do policial
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Próxima etapa."
            >
              <strong>
                Transferir colete
              </strong>

              <span>
                Registrar transferência para outra unidade ou destino autorizado
              </span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao
            icone="📤"
            titulo="Descarga patrimonial"
            descricao="Retirada definitiva de coletes vencidos, avariados ou sem condição de uso."
          >
            {podePagar && (
              <button
                type="button"
                onClick={() =>
                  setModalDescarga(
                    true
                  )
                }
              >
                <strong>
                  Solicitar descarga
                </strong>

                <span>
                  Encaminhar coletes do COFRE DO P4 para aprovação do Cmt de Cia
                </span>
              </button>
            )}

            {podeDecidir && (
              <button
                type="button"
                onClick={() =>
                  setModalDecisaoDescarga(
                    true
                  )
                }
              >
                <strong>
                  Aprovar descargas
                </strong>

                <span>
                  {descargasPendentes.length}{' '}
                  {descargasPendentes.length === 1
                    ? 'solicitação aguardando decisão'
                    : 'solicitações aguardando decisão'}
                </span>
              </button>
            )}
          </GrupoOperacao>

          <GrupoOperacao
            icone="📥"
            titulo="Entradas e recebimentos"
            descricao="Entrada inicial e retorno de materiais ao P4."
          >
            <button
              type="button"
              onClick={() =>
                setModalCadastro(
                  true
                )
              }
            >
              <strong>
                Receber material novo
              </strong>

              <span>
                Cadastrar patrimônio, série, lote, tamanho e validade
              </span>
            </button>

            <button
              type="button"
              disabled={!podePagar}
              title={
                podePagar
                  ? 'Receber colete devolvido e retornar ao COFRE DO P4.'
                  : 'Operação exclusiva do P4.'
              }
              onClick={() =>
                setModalReceberDevolucao(
                  true
                )
              }
            >
              <strong>
                Receber devolução
              </strong>

              <span>
                Conferir colete devolvido pelo policial e retornar ao COFRE DO P4
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Próxima etapa."
            >
              <strong>
                Receber manutenção
              </strong>

              <span>
                Registrar retorno do colete e liberar novamente para carga
              </span>
            </button>
          </GrupoOperacao>

          <GrupoOperacao
            icone="🗂️"
            titulo="Gestão e rastreabilidade"
            descricao="Consultas de validade, lote e histórico patrimonial."
          >
            <button
              type="button"
              onClick={() =>
                setFiltroValidade(
                  'ALERTA'
                )
              }
            >
              <strong>
                Validades e alertas
              </strong>

              <span>
                Mostrar coletes próximos do vencimento
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Use a pesquisa do inventário por enquanto."
            >
              <strong>
                Consultar por lote
              </strong>

              <span>
                Rastrear todos os coletes pertencentes ao mesmo lote
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Próxima etapa."
            >
              <strong>
                Histórico de cargas
              </strong>

              <span>
                Consultar responsáveis e movimentações anteriores
              </span>
            </button>

            <button
              type="button"
              disabled
              title="Próxima etapa."
            >
              <strong>
                Histórico de manutenção
              </strong>

              <span>
                Consultar ocorrências, serviços e retornos do colete
              </span>
            </button>
          </GrupoOperacao>
        </div>
      </section>

      <section
        className="coletes-estoque-section"
        id="coletes-inventario"
      >
        <div className="coletes-section-header">
          <div>
            <span className="coletes-eyebrow">
              Inventário
            </span>

            <h2>
              Coletes cadastrados
            </h2>
          </div>

          <small>
            {filtrados.length} resultado(s)
          </small>
        </div>

        <div className="coletes-filtros">
          <label className="coletes-field coletes-field-wide">
            <span>
              PESQUISAR
            </span>

            <input
              className="coletes-input"
              value={
                filtroPesquisa
              }
              onChange={(event) =>
                setFiltroPesquisa(
                  event.target.value
                )
              }
              placeholder="Patrimônio, série, lote, fabricante, policial ou RE"
            />
          </label>

          <Campo label="SEXO">
            <select
              className="coletes-select"
              value={
                filtroSexo
              }
              onChange={(event) =>
                setFiltroSexo(
                  event.target.value
                )
              }
            >
              <option value="">
                Todos
              </option>

              {COLETE_BALISTICO_SEXOS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="TAMANHO">
            <select
              className="coletes-select"
              value={
                filtroTamanho
              }
              onChange={(event) =>
                setFiltroTamanho(
                  event.target.value
                )
              }
            >
              <option value="">
                Todos
              </option>

              {COLETE_BALISTICO_TAMANHOS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="MODELAGEM">
            <select
              className="coletes-select"
              value={
                filtroModelagem
              }
              onChange={(event) =>
                setFiltroModelagem(
                  event.target.value
                )
              }
            >
              <option value="">
                Todas
              </option>

              {COLETE_BALISTICO_MODELAGENS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          </Campo>

          <Campo label="STATUS">
            <select
              className="coletes-select"
              value={
                filtroStatus
              }
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value
                )
              }
            >
              <option value="">
                Todos
              </option>

              <option value="RESERVA">
                RESERVA
              </option>

              <option value="AGUARDANDO_RECEBIMENTO">
                AGUARDANDO RECEBIMENTO
              </option>

              <option value="CARGA_INDIVIDUAL">
                CARGA INDIVIDUAL
              </option>

              <option value="MANUTENCAO">
                MANUTENÇÃO
              </option>

              <option value="TRANSFERIDO">
                TRANSFERIDO
              </option>
            </select>
          </Campo>

          <Campo label="VALIDADE">
            <select
              className="coletes-select"
              value={
                filtroValidade
              }
              onChange={(event) =>
                setFiltroValidade(
                  event.target.value
                )
              }
            >
              <option value="">
                Todas
              </option>

              <option value="OK">
                REGULAR
              </option>

              <option value="ALERTA">
                PRÓXIMA
              </option>

              <option value="VENCIDO">
                VENCIDA
              </option>
            </select>
          </Campo>

          <button
            type="button"
            className="coletes-btn-secondary coletes-filtros-limpar"
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
        </div>

        {loading ? (
          <div className="coletes-loading">
            Carregando coletes...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="coletes-empty">
            Nenhum colete encontrado.
          </div>
        ) : (
          <>
            <div
              ref={tabelaScrollTopoRef}
              style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                height: '15px',
                marginBottom: '4px'
              }}
              onScroll={(event) => {
                if (
                  tabelaScrollRef.current
                ) {
                  tabelaScrollRef.current.scrollLeft =
                    event.currentTarget.scrollLeft
                }
              }}
            >
              <div
                style={{
                  width:
                    `${Math.max(
                      larguraTabela,
                      1
                    )}px`,
                  height: '1px'
                }}
              />
            </div>

            <div
              ref={tabelaScrollRef}
              className="coletes-table-wrap"
              onScroll={(event) => {
                if (
                  tabelaScrollTopoRef.current
                ) {
                  tabelaScrollTopoRef.current.scrollLeft =
                    event.currentTarget.scrollLeft
                }
              }}
            >
            <table
              ref={tabelaRef}
              className="coletes-table"
              style={{
                fontSize: '0.76rem'
              }}
            >
              <thead>
                <tr>
                  <th>
                    PATRIMÔNIO
                  </th>

                  <th>
                    SÉRIE
                  </th>

                  <th>
                    LOTE
                  </th>

                  <th>
                    PROTEÇÃO
                  </th>

                  <th>
                    SEXO
                  </th>

                  <th>
                    TAMANHO
                  </th>

                  <th>
                    VALIDADE
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    LOCAL / RESPONSÁVEL
                  </th>

                  <th>
                    AÇÃO
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map(
                  (colete) => {
                    const situacao =
                      obterSituacaoValidadeColete(
                        colete
                      )

                    return (
                      <tr
                        key={
                          colete.id
                        }
                      >
                        <td>
                          <strong>
                            {colete.patrimonio}
                          </strong>
                        </td>

                        <td>
                          {colete.numero_serie}
                        </td>

                        <td>
                          {colete.numero_lote}
                        </td>

                        <td>
                          {colete.nivel_protecao}
                        </td>

                        <td>
                          {colete.sexo}
                        </td>

                        <td>
                          <strong>
                            {colete.tamanho}
                          </strong>
                          {' · '}
                          {formatarModelagem(
                            colete.modelagem
                          )}
                        </td>

                        <td>
                          <span
                            className={`coletes-validade-badge ${
                              situacao === 'VENCIDO'
                                ? 'coletes-validade-vencida'
                                : situacao === 'ALERTA'
                                  ? 'coletes-validade-alerta'
                                  : 'coletes-validade-ok'
                            }`}
                          >
                            {formatarData(
                              colete.validade
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="coletes-status-badge">
                            {formatarStatus(
                              colete.status_operacional
                            )}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {colete.carga_policial_nome ||
                              colete.local_atual ||
                              'P4'}
                          </strong>

                          {colete.carga_policial_re && (
                            <small className="coletes-table-subtitle">
                              RE {colete.carga_policial_re}
                            </small>
                          )}
                        </td>

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'nowrap',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <button
                              type="button"
                              className="coletes-btn-secondary coletes-btn-small"
                              style={{
                                fontSize: '0.70rem',
                                padding: '6px 9px',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() =>
                                setColeteDetalhes(
                                  colete
                                )
                              }
                            >
                              Ver
                            </button>

                            <button
                              type="button"
                              className="coletes-btn-primary coletes-btn-small"
                              style={{
                                fontSize: '0.70rem',
                                padding: '6px 9px',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() =>
                                setColeteEdicao(
                                  colete
                                )
                              }
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>

      {modalDescarga && (
        <ModalDescargaColete
          user={user}
          coletes={coletes}
          onClose={() =>
            setModalDescarga(
              false
            )
          }
          onConcluido={async ({
            quantidade,
            parcial
          }) => {
            await carregar()

            if (!parcial) {
              setModalDescarga(
                false
              )

              setMensagem(
                `${quantidade} ${
                  quantidade === 1
                    ? 'solicitação de descarga foi enviada'
                    : 'solicitações de descarga foram enviadas'
                } ao Comandante da Cia.`
              )
            }
          }}
        />
      )}

      {modalDecisaoDescarga && (
        <ModalDecisaoDescargaColete
          user={user}
          solicitacoes={
            descargasPendentes
          }
          onClose={() =>
            setModalDecisaoDescarga(
              false
            )
          }
          onAtualizar={async () => {
            await carregar()
          }}
        />
      )}

      {modalReceberDevolucao && (
        <ModalReceberDevolucaoColete
          user={user}
          onClose={() =>
            setModalReceberDevolucao(
              false
            )
          }
          onConcluido={async (
            movimentacao
          ) => {
            setModalReceberDevolucao(
              false
            )

            setMensagem(
              'Devolução recebida com sucesso. O colete retornou para RESERVA no COFRE DO P4.'
            )

            await carregar()
          }}
        />
      )}

      {modalPagarCarga && (
        <ModalPagarCargaColete
          user={user}
          coletes={coletes}
          onClose={() =>
            setModalPagarCarga(
              false
            )
          }
          onConcluido={async ({
            colete,
            policial
          }) => {
            setModalPagarCarga(
              false
            )

            setMensagem(
              `Carga do colete ${colete?.patrimonio || ''} paga para ${policial?.nome_guerra || policial?.nome || 'o policial'}. Aguardando confirmação de recebimento.`
            )

            await carregar()
          }}
        />
      )}

      {modalCadastro && (
        <FormularioColete
          user={user}
          onClose={() =>
            setModalCadastro(
              false
            )
          }
          onSalvo={aposSalvar}
        />
      )}

      {coleteDetalhes && (
        <DetalhesColete
          colete={
            coleteDetalhes
          }
          onClose={() =>
            setColeteDetalhes(
              null
            )
          }
          onEdit={() => {
            setColeteEdicao(
              coleteDetalhes
            )

            setColeteDetalhes(
              null
            )
          }}
        />
      )}

      {coleteEdicao && (
        <FormularioColete
          user={user}
          colete={
            coleteEdicao
          }
          onClose={() =>
            setColeteEdicao(
              null
            )
          }
          onSalvo={aposSalvar}
        />
      )}
    </main>
  )
}
