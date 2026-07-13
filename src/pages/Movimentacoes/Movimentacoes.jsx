import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarMovimentacoes,
  aprovarMovimentacao,
  recusarMovimentacao,
  confirmarRecebimentoMovimentacao,
  cancelarMovimentacao
} from '../../services/movimentacoesService'

import MovimentacaoForm from './components/MovimentacaoForm'
import MovimentacaoTable from './components/MovimentacaoTable'

import './styles/movimentacoes.css'

const FILTROS_STATUS = [
  {
    value: '',
    label: 'Todos os status'
  },
  {
    value: 'aguardando_aprovacao',
    label: 'Aguardando aprovação'
  },
  {
    value: 'aguardando_recebimento',
    label: 'Aguardando recebimento'
  },
  {
    value: 'alteracao_solicitada',
    label: 'Alteração solicitada'
  },
  {
    value: 'finalizada',
    label: 'Finalizada'
  },
  {
    value: 'recusada',
    label: 'Recusada'
  },
  {
    value: 'cancelada',
    label: 'Cancelada'
  }
]

function texto(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
}

export default function Movimentacoes({
  user,
  onVoltar
}) {
  const [movimentacoes, setMovimentacoes] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [processandoId, setProcessandoId] =
    useState(null)

  const [erro, setErro] =
    useState('')

  const [showForm, setShowForm] =
    useState(false)

  const [filtroStatus, setFiltroStatus] =
    useState('')

  const [busca, setBusca] =
    useState('')

  const carregarMovimentacoes =
    useCallback(async () => {
      try {
        setLoading(true)
        setErro('')

        const data =
          await listarMovimentacoes({
            status:
              filtroStatus || undefined
          })

        setMovimentacoes(
          Array.isArray(data)
            ? data
            : []
        )
      } catch (error) {
        console.error(
          'Erro ao carregar movimentações:',
          error
        )

        setErro(
          error?.message ||
          'Erro ao carregar movimentações.'
        )
      } finally {
        setLoading(false)
      }
    }, [filtroStatus])

  useEffect(() => {
    carregarMovimentacoes()
  }, [carregarMovimentacoes])

  const movimentacoesFiltradas =
    useMemo(() => {
      const termo = texto(busca)

      if (!termo) {
        return movimentacoes
      }

      return movimentacoes.filter(
        (movimentacao) => {
          const campos = [
            movimentacao.tipo_movimentacao,
            movimentacao.status,
            movimentacao.origem_local,
            movimentacao.destino_local,
            movimentacao.solicitante_nome,
            movimentacao.solicitante_re,
            movimentacao.recebedor_nome,
            movimentacao.recebedor_re,
            movimentacao.observacao,
            movimentacao.documento,
            movimentacao.id
          ]

          return campos.some((campo) =>
            texto(campo).includes(termo)
          )
        }
      )
    }, [busca, movimentacoes])

  const contadores = useMemo(() => {
    return movimentacoes.reduce(
      (resultado, movimentacao) => {
        resultado.total += 1

        if (
          movimentacao.status ===
          'aguardando_aprovacao'
        ) {
          resultado.aprovacao += 1
        }

        if (
          movimentacao.status ===
          'aguardando_recebimento'
        ) {
          resultado.recebimento += 1
        }

        if (
          movimentacao.status ===
          'finalizada'
        ) {
          resultado.finalizadas += 1
        }

        return resultado
      },
      {
        total: 0,
        aprovacao: 0,
        recebimento: 0,
        finalizadas: 0
      }
    )
  }, [movimentacoes])

  async function executarAcao(
    movimentacao,
    acao
  ) {
    try {
      setProcessandoId(movimentacao.id)
      setErro('')

      await acao()

      await carregarMovimentacoes()
    } catch (error) {
      console.error(
        'Erro ao processar movimentação:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível processar a movimentação.'
      )
    } finally {
      setProcessandoId(null)
    }
  }

  async function handleAprovar(
    movimentacao
  ) {
    const confirmado = window.confirm(
      'Aprovar esta movimentação?'
    )

    if (!confirmado) {
      return
    }

    await executarAcao(
      movimentacao,
      () =>
        aprovarMovimentacao({
          movimentacao_id:
            movimentacao.id,

          aprovador: user,

          observacao:
            'Aprovado pelo sistema SIGMO.'
        })
    )
  }

  async function handleRecusar(
    movimentacao
  ) {
    const motivo = window.prompt(
      'Informe o motivo da recusa:'
    )

    if (!motivo?.trim()) {
      return
    }

    await executarAcao(
      movimentacao,
      () =>
        recusarMovimentacao({
          movimentacao_id:
            movimentacao.id,

          aprovador: user,

          observacao: motivo.trim()
        })
    )
  }

  async function handleReceber(
    movimentacao
  ) {
    const confirmado = window.confirm(
      'Confirmar o recebimento desta movimentação?'
    )

    if (!confirmado) {
      return
    }

    await executarAcao(
      movimentacao,
      () =>
        confirmarRecebimentoMovimentacao({
          movimentacao_id:
            movimentacao.id,

          recebedor: user,

          observacao:
            'Recebimento confirmado.'
        })
    )
  }

  async function handleCancelar(
    movimentacao
  ) {
    const motivo = window.prompt(
      'Informe o motivo do cancelamento:'
    )

    if (!motivo?.trim()) {
      return
    }

    await executarAcao(
      movimentacao,
      () =>
        cancelarMovimentacao({
          movimentacao_id:
            movimentacao.id,

          usuario: user,

          observacao: motivo.trim()
        })
    )
  }

  return (
    <main className="movimentacoes-page">
      <header className="movimentacoes-header">
        <div>
          <span className="movimentacoes-kicker">
            MOTOR CENTRAL
          </span>

          <h1>Movimentações</h1>

          <p>
            Fluxo central de movimentação,
            aprovação e recebimento patrimonial
            do SIGMO.
          </p>
        </div>

        <div className="movimentacoes-header-actions">
          {onVoltar && (
            <button
              type="button"
              className="movimentacoes-btn movimentacoes-btn-secondary"
              onClick={onVoltar}
            >
              Voltar
            </button>
          )}

          <button
            type="button"
            className="movimentacoes-btn movimentacoes-btn-refresh"
            onClick={carregarMovimentacoes}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>

          <button
            type="button"
            className="movimentacoes-btn movimentacoes-btn-primary"
            onClick={() =>
              setShowForm((atual) => !atual)
            }
          >
            {showForm
              ? 'Fechar formulário'
              : 'Nova movimentação'}
          </button>
        </div>
      </header>

      <section className="movimentacoes-summary-grid">
        <article>
          <span>Total</span>
          <strong>{contadores.total}</strong>
          <small>Movimentações encontradas</small>
        </article>

        <article className="movimentacoes-summary-warning">
          <span>Aguardando aprovação</span>
          <strong>{contadores.aprovacao}</strong>
          <small>Pendentes de análise</small>
        </article>

        <article className="movimentacoes-summary-info">
          <span>Aguardando recebimento</span>
          <strong>{contadores.recebimento}</strong>
          <small>Pendentes de confirmação</small>
        </article>

        <article className="movimentacoes-summary-success">
          <span>Finalizadas</span>
          <strong>{contadores.finalizadas}</strong>
          <small>Fluxos concluídos</small>
        </article>
      </section>

      <section className="movimentacoes-filtros">
        <div className="movimentacoes-filtro-busca">
          <label htmlFor="buscaMovimentacao">
            Pesquisar
          </label>

          <input
            id="buscaMovimentacao"
            type="search"
            value={busca}
            onChange={(event) =>
              setBusca(event.target.value)
            }
            placeholder="TIPO, LOCAL, RE, NOME OU DOCUMENTO"
          />
        </div>

        <div>
          <label htmlFor="filtroStatus">
            Status
          </label>

          <select
            id="filtroStatus"
            value={filtroStatus}
            onChange={(event) =>
              setFiltroStatus(
                event.target.value
              )
            }
          >
            {FILTROS_STATUS.map(
              (opcao) => (
                <option
                  key={opcao.value}
                  value={opcao.value}
                >
                  {opcao.label}
                </option>
              )
            )}
          </select>
        </div>
      </section>

      {erro && (
        <div className="movimentacoes-erro">
          <span>{erro}</span>

          <button
            type="button"
            onClick={carregarMovimentacoes}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {showForm && (
        <MovimentacaoForm
          user={user}
          onCancel={() =>
            setShowForm(false)
          }
          onSaved={async () => {
            setShowForm(false)
            await carregarMovimentacoes()
          }}
        />
      )}

      <MovimentacaoTable
        movimentacoes={
          movimentacoesFiltradas
        }
        loading={loading}
        processandoId={processandoId}
        onAprovar={handleAprovar}
        onRecusar={handleRecusar}
        onReceber={handleReceber}
        onCancelar={handleCancelar}
      />
    </main>
  )
}