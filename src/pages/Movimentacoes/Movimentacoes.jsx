import { useEffect, useState } from 'react'
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

export default function Movimentacoes({ user }) {
  const [movimentacoes, setMovimentacoes] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')

  async function carregarMovimentacoes() {
    try {
      setLoading(true)
      setErro('')

      const data = await listarMovimentacoes({
        status: filtroStatus || undefined
      })

      setMovimentacoes(data)
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar movimentações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarMovimentacoes()
  }, [filtroStatus])

  async function handleAprovar(movimentacao) {
    if (!confirm('Aprovar esta movimentação?')) return

    try {
      await aprovarMovimentacao({
        movimentacao_id: movimentacao.id,
        aprovador: user,
        observacao: 'Aprovado pelo sistema SIGMO.'
      })

      await carregarMovimentacoes()
    } catch (error) {
      console.error(error)
      alert('Erro ao aprovar movimentação.')
    }
  }

  async function handleRecusar(movimentacao) {
    const motivo = prompt('Informe o motivo da recusa:')

    if (!motivo) return

    try {
      await recusarMovimentacao({
        movimentacao_id: movimentacao.id,
        aprovador: user,
        observacao: motivo
      })

      await carregarMovimentacoes()
    } catch (error) {
      console.error(error)
      alert('Erro ao recusar movimentação.')
    }
  }

  async function handleReceber(movimentacao) {
    if (!confirm('Confirmar recebimento desta movimentação?')) return

    try {
      await confirmarRecebimentoMovimentacao({
        movimentacao_id: movimentacao.id,
        recebedor: user,
        observacao: 'Recebimento confirmado.'
      })

      await carregarMovimentacoes()
    } catch (error) {
      console.error(error)
      alert('Erro ao confirmar recebimento.')
    }
  }

  async function handleCancelar(movimentacao) {
    const motivo = prompt('Informe o motivo do cancelamento:')

    if (!motivo) return

    try {
      await cancelarMovimentacao({
        movimentacao_id: movimentacao.id,
        usuario: user,
        observacao: motivo
      })

      await carregarMovimentacoes()
    } catch (error) {
      console.error(error)
      alert('Erro ao cancelar movimentação.')
    }
  }

  return (
    <div className="movimentacoes-page">
      <div className="movimentacoes-header">
        <div>
          <h1>Movimentações</h1>
          <p>Motor central de movimentação de patrimônio do SIGMO.</p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          Nova Movimentação
        </button>
      </div>

      <div className="movimentacoes-filtros">
        <label>
          Status
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="aguardando_aprovacao">Aguardando aprovação</option>
            <option value="aguardando_recebimento">Aguardando recebimento</option>
            <option value="alteracao_solicitada">Alteração solicitada</option>
            <option value="finalizada">Finalizada</option>
            <option value="recusada">Recusada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
      </div>

      {erro && <div className="movimentacoes-erro">{erro}</div>}

      {showForm && (
        <MovimentacaoForm
          user={user}
          onCancel={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false)
            await carregarMovimentacoes()
          }}
        />
      )}

      <MovimentacaoTable
        movimentacoes={movimentacoes}
        loading={loading}
        onAprovar={handleAprovar}
        onRecusar={handleRecusar}
        onReceber={handleReceber}
        onCancelar={handleCancelar}
      />
    </div>
  )
}