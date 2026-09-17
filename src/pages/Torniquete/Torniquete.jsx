import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarTorniquetes
} from '../../services/torniquetesService'

import { supabase } from '../../services/supabaseClient'
import { loadSessionToken } from '../../services/authService'

import {
  criarTransferenciaManutencaoTorniquetePendente
} from '../../services/torniquetesMovimentacoesService'

import {
  concluirManutencao,
  listarManutencoes,
  MODULOS_MANUTENCAO,
  registrarManutencao
} from '../../services/manutencoesService'

import './Torniquete.css'


function numero(valor) {
  const n = Number(valor || 0)

  return Number.isFinite(n)
    ? Math.max(0, Math.trunc(n))
    : 0
}


function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}


function obterPerfil(user) {
  return normalizar(
    user?.perfil_temporario_ativo
      ? (
          user?.perfil_temporario ||
          user?.perfil
        )
      : (
          user?.perfil ||
          user?.perfil_efetivo ||
          user?.role ||
          ''
        )
  )
}


function CardResumo({
  titulo,
  valor,
  subtitulo
}) {
  return (
    <article className="torniquete-resumo-card">
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


function GraficoRoscaTorniquetes({
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
    <section className="torniquete-chart-card">
      <div className="torniquete-chart-header">
        <div>
          <span>
            Distribuição do estoque
          </span>

          <h2>
            Situação dos torniquetes
          </h2>
        </div>
      </div>

      <div className="torniquete-chart-donut-layout">
        <div
          className="torniquete-chart-donut"
          style={{
            background:
              `conic-gradient(${segmentos.join(', ')})`
          }}
          aria-label={`Total de ${total} torniquetes controlados`}
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

        <div className="torniquete-chart-legend">
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


function GrupoOperacao({
  icone,
  titulo,
  descricao,
  children
}) {
  return (
    <div className="torniquete-operation-group">
      <div className="torniquete-operation-group-header">
        <div
          className="torniquete-operation-group-icon"
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

      <div className="torniquete-operation-actions">
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
      className="torniquete-modal-backdrop"
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
        className={`torniquete-modal ${amplo ? 'torniquete-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="torniquete-modal-header">
          <div>
            <span className="torniquete-eyebrow">
              SIGMO • TORNIQUETE
            </span>

            <h2>{titulo}</h2>

            {subtitulo && (
              <p>{subtitulo}</p>
            )}
          </div>

          <button
            type="button"
            className="torniquete-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="torniquete-modal-body">
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
      className={`torniquete-field ${full ? 'torniquete-field-full' : ''}`}
    >
      <span>{label}</span>
      {children}
    </label>
  )
}


function TransferenciaTorniqueteModal({
  origem,
  destino,
  saldoDisponivel,
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

  async function salvar(event) {
    event.preventDefault()

    const quantidadeFinal =
      numero(quantidade)

    if (quantidadeFinal <= 0) {
      setErro(
        'Informe uma quantidade maior que zero.'
      )
      return
    }

    if (
      quantidadeFinal >
      numero(saldoDisponivel)
    ) {
      setErro(
        `Existem apenas ${numero(saldoDisponivel)} unidade(s) disponíveis na origem.`
      )
      return
    }

    const token =
      loadSessionToken()

    if (!token) {
      setErro(
        'Sessão SIGMO inválida ou expirada.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      const { error } =
        await supabase.rpc(
          'sigmo_torniquetes_criar_transferencia_pendente',
          {
            p_token:
              token,

            p_origem:
              origem,

            p_destino:
              destino,

            p_quantidade:
              quantidadeFinal,

            p_documento:
              documento
                .trim()
                .toUpperCase() ||
              null,

            p_observacoes:
              observacoes
                .trim()
                .toUpperCase() ||
              null
          }
        )

      if (error) {
        throw error
      }

      await onSalvo?.(
        `Transferência de ${quantidadeFinal} torniquete(s) registrada. Aguardando aprovação do Cmt de Cia.`
      )

      onClose?.()
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível registrar a transferência.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={
        origem === 'P4'
          ? 'Transferir torniquete'
          : 'Devolver ao P4'
      }
      subtitulo={`${origem} → ${destino} • disponível na origem: ${numero(saldoDisponivel)}`}
      onClose={onClose}
    >
      <form onSubmit={salvar}>
        <div className="torniquete-form-grid">
          <Campo label="ORIGEM">
            <input
              className="torniquete-input torniquete-input-readonly"
              value={
                origem === 'P4'
                  ? 'COFRE DO P4'
                  : 'COFRE DO SVDD'
              }
              readOnly
            />
          </Campo>

          <Campo label="DESTINO">
            <input
              className="torniquete-input torniquete-input-readonly"
              value={
                destino === 'P4'
                  ? 'COFRE DO P4'
                  : 'COFRE DO SVDD'
              }
              readOnly
            />
          </Campo>

          <Campo label="QUANTIDADE">
            <input
              autoFocus
              className="torniquete-input"
              type="number"
              min="1"
              max={
                numero(
                  saldoDisponivel
                ) || undefined
              }
              value={quantidade}
              onChange={(event) =>
                setQuantidade(
                  event.target.value
                )
              }
            />
          </Campo>

          <Campo label="DISPONÍVEL NA ORIGEM">
            <input
              className="torniquete-input torniquete-input-readonly"
              value={
                numero(
                  saldoDisponivel
                ).toLocaleString(
                  'pt-BR'
                )
              }
              readOnly
            />
          </Campo>

          <Campo label="DOCUMENTO">
            <input
              className="torniquete-input"
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
            label="OBSERVAÇÕES"
            full
          >
            <textarea
              className="torniquete-textarea"
              rows={4}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="Registre informações complementares desta operação."
            />
          </Campo>
        </div>

        {erro && (
          <div className="torniquete-alert torniquete-alert-error">
            {erro}
          </div>
        )}

        <footer className="torniquete-modal-actions">
          <button
            type="button"
            className="torniquete-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="torniquete-btn-primary"
            disabled={
              salvando ||
              numero(quantidade) <= 0
            }
          >
            {salvando
              ? 'Salvando...'
              : 'Confirmar transferência'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}


function RecebimentoTorniqueteModal({
  lista,
  perfilP4,
  onClose,
  onSalvo
}) {
  const [recebendoId, setRecebendoId] =
    useState(null)

  const [erro, setErro] =
    useState('')

  async function receber(item) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (!transferenciaId) {
      return
    }

    const token =
      loadSessionToken()

    if (!token) {
      setErro(
        'Sessão SIGMO inválida ou expirada.'
      )
      return
    }

    try {
      setRecebendoId(
        transferenciaId
      )
      setErro('')

      const { error } =
        await supabase.rpc(
          'sigmo_torniquetes_receber_transferencia',
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

      await onSalvo?.(
        'Transferência de torniquete recebida com sucesso.'
      )

      onClose?.()
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível confirmar o recebimento.'
      )
    } finally {
      setRecebendoId(null)
    }
  }

  return (
    <Modal
      titulo={
        perfilP4
          ? 'Receber do SVDD'
          : 'Receber do P4'
      }
      subtitulo={
        perfilP4
          ? 'Transferências devolvidas pelo SVDD e pendentes de recebimento.'
          : 'Transferências enviadas pelo P4 e pendentes de recebimento.'
      }
      onClose={onClose}
      amplo
    >
      {erro && (
        <div className="torniquete-alert torniquete-alert-error">
          {erro}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="torniquete-modal-empty">
          Nenhum torniquete pendente de recebimento.
        </div>
      ) : (
        <div className="torniquete-table-wrap">
          <table className="torniquete-table">
            <thead>
              <tr>
                <th>QUANTIDADE</th>
                <th>ORIGEM</th>
                <th>DESTINO</th>
                <th>STATUS</th>
                <th>APROVADO POR</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {lista.map((item) => {
                const id =
                  item?.transferencia_id ||
                  item?.id

                return (
                  <tr key={id}>
                    <td>
                      <strong>
                        {numero(
                          item?.quantidade_total ||
                          item?.quantidade
                        )}
                      </strong>
                    </td>

                    <td>
                      {item?.origem_nome ||
                        item?.origem_tipo ||
                        '—'}
                    </td>

                    <td>
                      {item?.destino_nome ||
                        item?.destino_tipo ||
                        '—'}
                    </td>

                    <td>
                      <span className="torniquete-validade-badge torniquete-validade-alerta">
                        {item?.status ||
                          'AGUARDANDO_RECEBIMENTO'}
                      </span>
                    </td>

                    <td>
                      {item?.aprovado_por_nome ||
                        'CMT DE CIA'}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="torniquete-btn-primary torniquete-btn-small"
                        disabled={
                          Boolean(recebendoId)
                        }
                        onClick={() =>
                          receber(item)
                        }
                      >
                        {recebendoId === id
                          ? 'Recebendo...'
                          : 'Receber'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}


function ManutencaoTorniqueteModal({
  item,
  visaoP4,
  manutencoesAtivas,
  user,
  onClose,
  onSalvo
}) {
  const [quantidade, setQuantidade] =
    useState('')

  const [classificacao, setClassificacao] =
    useState('')

  const [documento, setDocumento] =
    useState('')

  const [observacoes, setObservacoes] =
    useState('')

  const [fotos, setFotos] =
    useState([])

  const [salvando, setSalvando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const manutencoesSvdd =
    useMemo(
      () =>
        (manutencoesAtivas || [])
          .filter((manutencao) => {
            const origem =
              normalizar(
                manutencao?.origem
              )

            return (
              numero(
                manutencao?.quantidade
              ) > 0 &&
              (
                origem.includes('SVDD') ||
                origem.includes(
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
          }),
      [manutencoesAtivas]
    )

  const saldoDisponivel =
    visaoP4
      ? numero(
          item?.quantidade_p4
        )
      : manutencoesSvdd.reduce(
          (soma, manutencao) =>
            soma +
            numero(
              manutencao?.quantidade
            ),
          0
        )

  async function encaminharSvddAoP4(
    quantidadeFinal
  ) {
    let restante =
      quantidadeFinal

    for (
      const manutencao of
      manutencoesSvdd
    ) {
      if (restante <= 0) {
        break
      }

      const quantidadeRegistro =
        numero(
          manutencao?.quantidade
        )

      if (
        quantidadeRegistro <= 0
      ) {
        continue
      }

      const quantidadeEncaminhar =
        Math.min(
          quantidadeRegistro,
          restante
        )

      await criarTransferenciaManutencaoTorniquetePendente({
        manutencaoId:
          manutencao.id,

        quantidade:
          quantidadeEncaminhar,

        observacoes:
          [
            documento
              ? `DOCUMENTO: ${String(
                  documento
                )
                  .trim()
                  .toUpperCase()}`
              : null,

            String(
              observacoes || ''
            ).trim()
              ? `OBSERVAÇÃO DO ENCAMINHAMENTO: ${String(
                  observacoes
                )
                  .trim()
                  .toUpperCase()}`
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

  async function salvar(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErro('')

      if (!item?.id) {
        throw new Error(
          'Controle de torniquetes não localizado.'
        )
      }

      const quantidadeFinal =
        numero(quantidade)

      if (
        quantidadeFinal <= 0
      ) {
        throw new Error(
          'Informe uma quantidade maior que zero.'
        )
      }

      if (
        quantidadeFinal >
        saldoDisponivel
      ) {
        throw new Error(
          visaoP4
            ? `Existem apenas ${saldoDisponivel} torniquete(s) disponíveis no P4.`
            : `Existem apenas ${saldoDisponivel} torniquete(s) em manutenção no SVDD.`
        )
      }

      if (!visaoP4) {
        await encaminharSvddAoP4(
          quantidadeFinal
        )

        await onSalvo?.(
          `Encaminhamento de ${quantidadeFinal} torniquete(s) em manutenção ao P4 registrado.`
        )

        onClose?.()
        return
      }

      if (!classificacao) {
        throw new Error(
          'Selecione o tipo da ocorrência.'
        )
      }

      if (
        !String(
          observacoes || ''
        ).trim()
      ) {
        throw new Error(
          'Descreva a avaria, deterioração ou condição do torniquete.'
        )
      }

      await registrarManutencao({
        modulo:
          MODULOS_MANUTENCAO.TORNIQUETE,

        tipoMaterial:
          'TORNIQUETE',

        referenciaId:
          item.id,

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
              ? `DOCUMENTO: ${String(
                  documento
                )
                  .trim()
                  .toUpperCase()}`
              : null,
            'MATERIAL: TORNIQUETE'
          ]
            .filter(Boolean)
            .join(' | '),

        origem:
          'COFRE DO P4',

        destino:
          'MANUTENCAO',

        fotos:
          fotos.slice(0, 6),

        user
      })

      await onSalvo?.(
        `${quantidadeFinal} torniquete(s) enviado(s) para manutenção.`
      )

      onClose?.()
    } catch (error) {
      setErro(
        error?.message ||
        (
          visaoP4
            ? 'Não foi possível enviar o torniquete para manutenção.'
            : 'Não foi possível encaminhar a manutenção ao P4.'
        )
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={
        visaoP4
          ? 'Enviar torniquete para manutenção'
          : 'Encaminhar manutenção ao P4'
      }
      subtitulo={
        visaoP4
          ? 'Registre torniquetes avariados, deteriorados ou impróprios para uso.'
          : 'Selecione a quantidade já em manutenção sob responsabilidade do SVDD que será encaminhada ao P4. O saldo apto do cofre não será alterado.'
      }
      onClose={onClose}
      amplo
    >
      <form onSubmit={salvar}>
        <div className="torniquete-form-grid">
          <Campo label="ORIGEM">
            <input
              className="torniquete-input torniquete-input-readonly"
              value={
                visaoP4
                  ? 'P4'
                  : 'SVDD'
              }
              readOnly
            />
          </Campo>

          <Campo label="MATERIAL">
            <input
              className="torniquete-input torniquete-input-readonly"
              value="TORNIQUETE"
              readOnly
            />
          </Campo>

          <Campo
            label={
              visaoP4
                ? 'QUANTIDADE'
                : 'QUANTIDADE A ENCAMINHAR'
            }
          >
            <input
              autoFocus
              className="torniquete-input"
              type="number"
              min="1"
              max={
                saldoDisponivel ||
                undefined
              }
              value={quantidade}
              onChange={(event) =>
                setQuantidade(
                  event.target.value
                )
              }
            />
          </Campo>

          <Campo
            label={
              visaoP4
                ? 'DISPONÍVEL NA ORIGEM'
                : 'EM MANUTENÇÃO NO SVDD'
            }
          >
            <input
              className="torniquete-input torniquete-input-readonly"
              value={
                saldoDisponivel
              }
              readOnly
            />
          </Campo>

          {visaoP4 && (
            <Campo label="TIPO DA OCORRÊNCIA">
              <select
                className="torniquete-select"
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
                  Avaria
                </option>

                <option value="DETERIORACAO">
                  Deterioração
                </option>

                <option value="IMPROPRIO_PARA_USO">
                  Impróprio para uso
                </option>

                <option value="OUTROS">
                  Outros
                </option>
              </select>
            </Campo>
          )}

          <Campo label="DOCUMENTO">
            <input
              className="torniquete-input"
              value={documento}
              onChange={(event) =>
                setDocumento(
                  event.target.value
                    .toUpperCase()
                )
              }
              placeholder="Ofício, memorando, termo..."
            />
          </Campo>

          <Campo
            label={
              visaoP4
                ? 'DESCRIÇÃO / OBSERVAÇÕES'
                : 'OBSERVAÇÕES DO ENCAMINHAMENTO'
            }
            full
          >
            <textarea
              className="torniquete-textarea"
              rows={4}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(
                  event.target.value
                    .toUpperCase()
                )
              }
              placeholder={
                visaoP4
                  ? 'Descreva a avaria, deterioração ou condição do material.'
                  : 'Informações adicionais para o P4.'
              }
            />
          </Campo>

          {visaoP4 && (
            <Campo
              label="FOTOS DA CONDIÇÃO DO MATERIAL"
              full
            >
              <input
                className="torniquete-input"
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

              {fotos.length > 0 && (
                <small>
                  {fotos.length} foto(s) selecionada(s). Máximo: 6.
                </small>
              )}
            </Campo>
          )}
        </div>

        {erro && (
          <div className="torniquete-alert torniquete-alert-error">
            {erro}
          </div>
        )}

        <footer className="torniquete-modal-actions">
          <button
            type="button"
            className="torniquete-btn-secondary"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="torniquete-btn-primary"
            disabled={
              salvando ||
              numero(quantidade) <= 0
            }
          >
            {salvando
              ? 'Salvando...'
              : visaoP4
                ? 'Confirmar envio para manutenção'
                : 'Encaminhar ao P4'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}


function RetornoManutencaoTorniqueteModal({
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

  const [
    fotosRetorno,
    setFotosRetorno
  ] = useState([])

  const [salvando, setSalvando] =
    useState(false)

  async function carregarManutencoes() {
    try {
      setLoading(true)
      setErro('')

      const resultado =
        await listarManutencoes({
          modulo:
            MODULOS_MANUTENCAO.TORNIQUETE,

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
        (resultado?.data || [])
          .filter((item) => {
            const origemItem =
              normalizar(
                item?.origem
              )

            if (
              perfilAtual === 'P4' ||
              perfilAtual.includes(
                'ADMINISTRADOR'
              )
            ) {
              return origemItem.includes(
                'P4'
              )
            }

            if (
              perfilAtual.includes(
                'SVDD'
              ) ||
              perfilAtual.includes(
                'SERVICO DE DIA'
              )
            ) {
              return (
                origemItem.includes(
                  'SVDD'
                ) ||
                origemItem.includes(
                  'SERVICO DE DIA'
                )
              )
            }

            return false
          })

      setLista(
        manutencoesDoGuardiao
      )
    } catch (error) {
      setErro(
        error?.message ||
        'Não foi possível carregar os torniquetes em manutenção.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarManutencoes()
  }, [])

  function abrirRetorno(item) {
    setSelecionada(item)
    setServicoExecutado('')
    setObservacoesRetorno('')
    setFotosRetorno([])
    setErro('')
  }

  async function confirmarRetorno(
    event
  ) {
    event.preventDefault()

    if (!selecionada?.id) {
      return
    }

    if (
      !String(
        servicoExecutado ||
        ''
      ).trim()
    ) {
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

      await onSalvo?.(
        'Retorno da manutenção registrado com sucesso.'
      )
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
      subtitulo="Registrar o serviço executado e devolver o torniquete ao guardião responsável."
      onClose={onClose}
      amplo
    >
      {erro && (
        <div className="torniquete-alert torniquete-alert-error">
          {erro}
        </div>
      )}

      {selecionada ? (
        <form
          onSubmit={
            confirmarRetorno
          }
        >
          <div className="torniquete-form-grid">
            <Campo label="MATERIAL">
              <input
                className="torniquete-input torniquete-input-readonly"
                value="TORNIQUETE"
                readOnly
              />
            </Campo>

            <Campo label="QUANTIDADE">
              <input
                className="torniquete-input torniquete-input-readonly"
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
                className="torniquete-input torniquete-input-readonly"
                value={
                  selecionada.tipo_novidade ||
                  'NÃO INFORMADA'
                }
                readOnly
              />
            </Campo>

            <Campo label="ORIGEM / RESPONSÁVEL">
              <input
                className="torniquete-input torniquete-input-readonly"
                value={
                  selecionada.origem ||
                  '—'
                }
                readOnly
              />
            </Campo>

            <Campo
              label="SERVIÇO EXECUTADO / SOLUÇÃO ADOTADA"
              full
            >
              <textarea
                autoFocus
                className="torniquete-textarea"
                rows={3}
                value={
                  servicoExecutado
                }
                onChange={(event) =>
                  setServicoExecutado(
                    event.target.value
                      .toUpperCase()
                  )
                }
                placeholder="Informe o serviço executado ou a solução adotada."
              />
            </Campo>

            <Campo
              label="OBSERVAÇÕES DO RETORNO"
              full
            >
              <textarea
                className="torniquete-textarea"
                rows={3}
                value={
                  observacoesRetorno
                }
                onChange={(event) =>
                  setObservacoesRetorno(
                    event.target.value
                      .toUpperCase()
                  )
                }
                placeholder="Observações complementares."
              />
            </Campo>

            <Campo
              label="FOTOS DO RETORNO"
              full
            >
              <input
                className="torniquete-input"
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
              />

              {fotosRetorno.length > 0 && (
                <small>
                  {fotosRetorno.length} foto(s) selecionada(s). Máximo: 6.
                </small>
              )}
            </Campo>
          </div>

          <footer className="torniquete-modal-actions">
            <button
              type="button"
              className="torniquete-btn-secondary"
              onClick={() =>
                setSelecionada(
                  null
                )
              }
              disabled={salvando}
            >
              Voltar
            </button>

            <button
              type="submit"
              className="torniquete-btn-primary"
              disabled={salvando}
            >
              {salvando
                ? 'Registrando...'
                : 'Tornar disponível'}
            </button>
          </footer>
        </form>
      ) : loading ? (
        <div className="torniquete-loading">
          Carregando manutenções...
        </div>
      ) : lista.length === 0 ? (
        <div className="torniquete-modal-empty">
          Nenhum torniquete em manutenção sob sua responsabilidade.
        </div>
      ) : (
        <div className="torniquete-table-wrap">
          <table className="torniquete-table">
            <thead>
              <tr>
                <th>MATERIAL</th>
                <th>QUANTIDADE</th>
                <th>OCORRÊNCIA</th>
                <th>ORIGEM</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {lista.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      TORNIQUETE
                    </strong>
                  </td>

                  <td>
                    {numero(
                      item.quantidade
                    )}
                  </td>

                  <td>
                    {item.tipo_novidade ||
                      '—'}
                  </td>

                  <td>
                    {item.origem ||
                      '—'}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="torniquete-btn-primary torniquete-btn-small"
                      onClick={() =>
                        abrirRetorno(
                          item
                        )
                      }
                    >
                      Registrar retorno
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}


export default function Torniquete({
  user,
  onVoltar = null
}) {
  const [
    estoque,
    setEstoque
  ] = useState([])

  const [
    recebimentosPendentes,
    setRecebimentosPendentes
  ] = useState([])

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
    transferenciaAberta,
    setTransferenciaAberta
  ] = useState(false)

  const [
    recebimentoAberto,
    setRecebimentoAberto
  ] = useState(false)

  const [
    manutencaoAberta,
    setManutencaoAberta
  ] = useState(false)

  const [
    retornoManutencaoAberto,
    setRetornoManutencaoAberto
  ] = useState(false)

  const perfil =
    useMemo(
      () => obterPerfil(user),
      [user]
    )

  const visaoSvdd =
    perfil ===
      'ENCARREGADO DO SVDD' ||
    perfil ===
      'AUXILIAR DO SVDD' ||
    perfil ===
      'AUXILIAR SVDD'

  const visaoP4 =
    perfil === 'P4' ||
    perfil.includes(
      'ADMINISTRADOR'
    )

  const origemMovimentacao =
    visaoP4
      ? 'P4'
      : visaoSvdd
        ? 'SVDD'
        : null

  const destinoMovimentacao =
    origemMovimentacao === 'P4'
      ? 'SVDD'
      : origemMovimentacao === 'SVDD'
        ? 'P4'
        : null

  const carregar =
    useCallback(
      async () => {
        try {
          setLoading(true)
          setErro('')

          const [
            data,
            manutencoesData
          ] = await Promise.all([
            listarTorniquetes(),

            listarManutencoes({
              modulo:
                MODULOS_MANUTENCAO.TORNIQUETE,
              status:
                'EM_MANUTENCAO',
              pagina:
                1,
              limite:
                500
            })
          ])

          setEstoque(
            Array.isArray(data)
              ? data
              : []
          )

          setManutencoesAtivas(
            Array.isArray(
              manutencoesData?.data
            )
              ? manutencoesData.data
              : []
          )

          const podeReceber =
            visaoP4 ||
            visaoSvdd

          if (!podeReceber) {
            setRecebimentosPendentes([])
            return
          }

          const token =
            loadSessionToken()

          if (!token) {
            setRecebimentosPendentes([])
            return
          }

          const {
            data: pendencias,
            error: erroPendencias
          } = await supabase.rpc(
            'sigmo_torniquetes_listar_recebimentos_pendentes',
            {
              p_token:
                token
            }
          )

          if (erroPendencias) {
            throw erroPendencias
          }

          setRecebimentosPendentes(
            Array.isArray(pendencias)
              ? pendencias
              : []
          )
        } catch (error) {
          console.error(
            'Erro ao carregar torniquetes:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível carregar o módulo de torniquetes.'
          )
        } finally {
          setLoading(false)
        }
      },
      [
        visaoP4,
        visaoSvdd
      ]
    )

  useEffect(() => {
    carregar()
  }, [carregar])

  const resumo =
    useMemo(
      () =>
        estoque.reduce(
          (acumulado, item) => {
            acumulado.total +=
              numero(
                item?.quantidade_total
              )

            acumulado.p4 +=
              numero(
                item?.quantidade_p4
              )

            acumulado.svdd +=
              numero(
                item?.quantidade_svdd
              )

            acumulado.emServico +=
              numero(
                item?.quantidade_em_servico
              )

            acumulado.cargaPermanente +=
              numero(
                item?.quantidade_carga_permanente
              )

            acumulado.manutencao +=
              numero(
                item?.quantidade_manutencao
              )

            acumulado.descarga +=
              numero(
                item?.quantidade_descarga
              )

            return acumulado
          },
          {
            total: 0,
            p4: 0,
            svdd: 0,
            emServico: 0,
            cargaPermanente: 0,
            manutencao: 0,
            descarga: 0
          }
        ),
      [estoque]
    )

  const saldoOrigem =
    origemMovimentacao === 'P4'
      ? resumo.p4
      : origemMovimentacao === 'SVDD'
        ? resumo.svdd
        : 0

  const totalManutencaoP4 =
    useMemo(
      () =>
        (manutencoesAtivas || [])
          .filter((item) =>
            normalizar(
              item?.origem
            ).includes('P4')
          )
          .reduce(
            (soma, item) =>
              soma +
              numero(
                item?.quantidade
              ),
            0
          ),
      [manutencoesAtivas]
    )

  const totalManutencaoSvdd =
    useMemo(
      () =>
        (manutencoesAtivas || [])
          .filter((item) => {
            const origem =
              normalizar(
                item?.origem
              )

            return (
              origem.includes(
                'SVDD'
              ) ||
              origem.includes(
                'SERVICO DE DIA'
              )
            )
          })
          .reduce(
            (soma, item) =>
              soma +
              numero(
                item?.quantidade
              ),
            0
          ),
      [manutencoesAtivas]
    )

  const itemEstoque =
    estoque?.[0] ||
    null

  const dadosGrafico =
    useMemo(
      () => {
        if (visaoSvdd) {
          return [
            {
              label:
                'Cofre do SVDD',
              valor:
                resumo.svdd,
              cor:
                '#3b82f6'
            },
            {
              label:
                'Em cautela',
              valor:
                resumo.emServico,
              cor:
                '#eab308'
            },
            {
              label:
                'Manutenção',
              valor:
                resumo.manutencao,
              cor:
                '#ef4444'
            },
            {
              label:
                'Baixados',
              valor:
                resumo.descarga,
              cor:
                '#f59e0b'
            }
          ]
        }

        return [
          {
            label:
              'Cofre do P4',
            valor:
              resumo.p4,
            cor:
              '#22c55e'
          },
          {
            label:
              'Cofre do SVDD',
            valor:
              resumo.svdd,
            cor:
              '#3b82f6'
          },
          {
            label:
              'Carga permanente',
            valor:
              resumo.cargaPermanente,
            cor:
              '#8b5cf6'
          },
          {
            label:
              'Em cautela',
            valor:
              resumo.emServico,
            cor:
              '#eab308'
          },
          {
            label:
              'Manutenção',
            valor:
              resumo.manutencao,
            cor:
              '#ef4444'
          }
        ]
      },
      [
        visaoSvdd,
        resumo
      ]
    )

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

  async function aposAlteracao(
    mensagemSucesso
  ) {
    setMensagem(
      mensagemSucesso
    )

    await carregar()
  }

  return (
    <main className="torniquete-page">
      <header className="torniquete-header">
        <div>
          <span className="torniquete-eyebrow">
            SIGMO • EQUIPAMENTO OPERACIONAL
          </span>

          <h1>Torniquetes</h1>

          <p>
            Controle quantitativo de torniquetes, sem patrimônio, número, modelo ou identificação individual.
          </p>
        </div>

        <div className="torniquete-header-actions">
          {typeof onVoltar ===
            'function' && (
            <button
              type="button"
              className="torniquete-btn-secondary"
              onClick={onVoltar}
            >
              ← Voltar
            </button>
          )}

          <button
            type="button"
            className="torniquete-btn-secondary"
            onClick={carregar}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>
        </div>
      </header>

      {erro && (
        <div className="torniquete-alert torniquete-alert-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="torniquete-alert torniquete-alert-success">
          {mensagem}
        </div>
      )}

      <section className="torniquete-resumo-grid">
        {visaoP4 && (
          <CardResumo
            titulo="TOTAL CONTROLADO"
            valor={resumo.total}
            subtitulo="Quantidade total cadastrada"
          />
        )}

        {visaoP4 && (
          <CardResumo
            titulo="COFRE DO P4"
            valor={resumo.p4}
            subtitulo="Saldo disponível no P4"
          />
        )}

        <CardResumo
          titulo="COFRE DO SVDD"
          valor={resumo.svdd}
          subtitulo="Saldo disponível no SVDD"
        />

        <CardResumo
          titulo="CAUTELAS ATIVAS"
          valor={resumo.emServico}
          subtitulo="Com policiais"
        />

        {visaoP4 && (
          <CardResumo
            titulo="CARGA PERMANENTE"
            valor={resumo.cargaPermanente}
            subtitulo="Carga individual permanente"
          />
        )}

        <CardResumo
          titulo="MANUTENÇÃO"
          valor={resumo.manutencao}
          subtitulo={
            visaoP4
              ? 'Sob responsabilidade do P4'
              : 'Sob responsabilidade do SVDD'
          }
        />

        <CardResumo
          titulo="BAIXADOS"
          valor={resumo.descarga}
          subtitulo="Baixas registradas"
        />
      </section>

      <section
        className="torniquete-charts-grid"
        aria-label="Gráficos do estoque de torniquetes"
      >
        <GraficoRoscaTorniquetes
          total={totalGrafico}
          itens={dadosGrafico}
        />
      </section>

      {(visaoP4 || visaoSvdd) && (
        <section className="torniquete-operations-section">
          <div className="torniquete-operations-title">
            <div>
              <span>
                Operações permitidas
              </span>

              <h2>
                Movimentações de torniquetes
              </h2>
            </div>
          </div>

          <div className="torniquete-operation-groups">
            <GrupoOperacao
              icone="📦"
              titulo="Saídas e movimentações"
              descricao="Distribuição e movimentação de torniquetes."
            >
              <button
                type="button"
                disabled={
                  saldoOrigem <= 0
                }
                onClick={() =>
                  setTransferenciaAberta(
                    true
                  )
                }
              >
                <strong>
                  {visaoP4
                    ? 'Transferir torniquete'
                    : 'Devolver ao P4'}
                </strong>

                <span>
                  {visaoP4
                    ? 'Informar quantidade e transferir ao SVDD'
                    : 'Informar quantidade e devolver ao P4'}
                </span>
              </button>
            </GrupoOperacao>

            <GrupoOperacao
              icone="🛠️"
              titulo="Condição do material"
              descricao="Manutenção e recolhimento de torniquetes."
            >
              <button
                type="button"
                disabled={
                  visaoP4
                    ? resumo.p4 <= 0
                    : totalManutencaoSvdd <= 0
                }
                onClick={() =>
                  setManutencaoAberta(
                    true
                  )
                }
              >
                <strong>
                  {visaoP4
                    ? 'Enviar para manutenção'
                    : 'Encaminhar manutenção ao P4'}
                </strong>

                <span>
                  {visaoP4
                    ? 'Registrar torniquete avariado, deteriorado ou impróprio para uso sob responsabilidade do P4'
                    : `${totalManutencaoSvdd} torniquete(s) em manutenção no SVDD • envie uma, várias ou todas ao P4`}
                </span>
              </button>
            </GrupoOperacao>

            <GrupoOperacao
              icone="📥"
              titulo="Entradas e recebimentos"
              descricao="Entrada e confirmação de transferências de torniquetes."
            >
              <button
                type="button"
                onClick={() =>
                  setRecebimentoAberto(
                    true
                  )
                }
              >
                <strong>
                  {visaoP4
                    ? 'Receber do SVDD'
                    : 'Receber do P4'}
                </strong>

                <span>
                  {visaoP4
                    ? 'Confirmar torniquetes devolvidos pelo SVDD'
                    : 'Confirmar torniquetes enviados pelo P4'}
                </span>
              </button>


              <button
                type="button"
                disabled={
                  visaoP4
                    ? totalManutencaoP4 <= 0
                    : totalManutencaoSvdd <= 0
                }
                onClick={() =>
                  setRetornoManutencaoAberto(
                    true
                  )
                }
              >
                <strong>
                  Receber manutenção
                </strong>

                <span>
                  Visualizar torniquetes em reparo e registrar o retorno
                </span>
              </button>
            </GrupoOperacao>
          </div>
        </section>
      )}

      <section className="torniquete-estoque-section">
        <div className="torniquete-section-header">
          <div>
            <span className="torniquete-eyebrow">
              CONSULTA DE INVENTÁRIO
            </span>

            <h2>
              Carga de torniquetes
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="torniquete-loading">
            Carregando torniquetes...
          </div>
        ) : estoque.length === 0 ? (
          <div className="torniquete-empty">
            Nenhum registro de torniquete encontrado.
          </div>
        ) : (
          <div className="torniquete-calibres-list">
            {estoque.map(
              (item) => (
                <article
                  key={item.id}
                  className="torniquete-calibre-card"
                >
                  <div
                    className={`torniquete-calibre-main ${
                      visaoP4
                        ? ''
                        : 'torniquete-calibre-main-svdd'
                    }`}
                  >
                    <div className="torniquete-calibre-identificacao">
                      <small>
                        MATERIAL
                      </small>

                      <strong>
                        TORNIQUETE
                      </strong>

                      <span>
                        Controle por quantidade
                      </span>
                    </div>

                    {visaoP4 && (
                      <div className="torniquete-saldo-item">
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

                    <div className="torniquete-saldo-item">
                      <small>
                        SVDD
                      </small>

                      <strong>
                        {numero(
                          item.quantidade_svdd
                        )}
                      </strong>
                    </div>

                    <div className="torniquete-saldo-item">
                      <small>
                        EM CAUTELA
                      </small>

                      <strong>
                        {numero(
                          item.quantidade_em_servico
                        )}
                      </strong>
                    </div>

                    <div className="torniquete-saldo-item">
                      <small>
                        TOTAL ATUAL
                      </small>

                      <strong>
                        {numero(
                          item.quantidade_total
                        )}
                      </strong>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>

      {transferenciaAberta && (
        <TransferenciaTorniqueteModal
          origem={
            origemMovimentacao
          }
          destino={
            destinoMovimentacao
          }
          saldoDisponivel={
            saldoOrigem
          }
          onClose={() =>
            setTransferenciaAberta(
              false
            )
          }
          onSalvo={
            aposAlteracao
          }
        />
      )}

      {recebimentoAberto && (
        <RecebimentoTorniqueteModal
          lista={
            recebimentosPendentes
          }
          perfilP4={
            visaoP4
          }
          onClose={() =>
            setRecebimentoAberto(
              false
            )
          }
          onSalvo={
            aposAlteracao
          }
        />
      )}

      {manutencaoAberta && (
        <ManutencaoTorniqueteModal
          item={itemEstoque}
          visaoP4={visaoP4}
          manutencoesAtivas={
            manutencoesAtivas
          }
          user={user}
          onClose={() =>
            setManutencaoAberta(
              false
            )
          }
          onSalvo={
            aposAlteracao
          }
        />
      )}

      {retornoManutencaoAberto && (
        <RetornoManutencaoTorniqueteModal
          user={user}
          onClose={() =>
            setRetornoManutencaoAberto(
              false
            )
          }
          onSalvo={
            aposAlteracao
          }
        />
      )}

      <footer
        style={{
          marginTop: '18px',
          color: '#667085',
          fontSize: '0.74rem',
          fontWeight: 650
        }}
      >
        Usuário:{' '}
        {user?.nome_guerra ||
          user?.nome ||
          '—'}
      </footer>
    </main>
  )
}
