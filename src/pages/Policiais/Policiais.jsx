import { useEffect, useState } from 'react'
import {
  listarPessoas,
  excluirPessoa
} from '../../services/pessoasService'
import { registerAudit } from '../../services/auditoriaService'

import PolicialForm from './components/PolicialForm'
import PolicialTable from './components/PolicialTable'
import PolicialViewModal from './components/PolicialViewModal'

import './styles/policiais.css'
import './styles/policiaisTable.css'

const initialFilters = {
  search: '',
  status: '',
  participaTeste: ''
}

export default function Policiais({ user }) {
  const [policiais, setPoliciais] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [policialEditando, setPolicialEditando] = useState(null)
  const [policialVisualizando, setPolicialVisualizando] = useState(null)

  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  const limite = 10

  async function carregarPoliciais() {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarPessoas({
        ...filters,
        pagina,
        limite,
        sortBy,
        sortDirection
      })

      setPoliciais(resultado.data)
      setTotal(resultado.total)
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar policiais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPoliciais()
  }, [filters, pagina, sortBy, sortDirection])

  function handleFilterChange(event) {
    const { name, value } = event.target
    setPagina(1)
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  function limparFiltros() {
    setPagina(1)
    setFilters(initialFilters)
  }

  function abrirCadastro() {
    setPolicialEditando(null)
    setShowForm(true)
  }

  function abrirEdicao(policial) {
    setPolicialEditando(policial)
    setShowForm(true)
  }

  function fecharForm() {
    setPolicialEditando(null)
    setShowForm(false)
  }

  async function handleSaved() {
    fecharForm()
    await carregarPoliciais()
  }

  async function handleDelete(policial) {
    const confirmar = window.confirm(
      `Deseja excluir o policial ${policial.nome_completo}?`
    )

    if (!confirmar) return

    try {
      await excluirPessoa(policial.id)

      await registerAudit(
        'POLICIAL_DELETE',
        `Policial excluído: ${policial.nome_completo}`,
        user,
        'Policiais',
        'Atenção'
      )

      await carregarPoliciais()
    } catch (error) {
      console.error(error)
      setErro('Erro ao excluir policial.')
    }
  }

  function handleSort(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  const totalPaginas = Math.max(1, Math.ceil(total / limite))

  return (
    <main className="policiais-page">
      <section className="policiais-header">
        <div>
          <h1>Policiais</h1>
          <p>Cadastro de policiais, servidores e testadores do SIGMO.</p>
        </div>

        <button type="button" onClick={abrirCadastro}>
          + Novo policial
        </button>
      </section>

      <section className="policiais-filters">
        <input
          name="search"
          placeholder="Buscar por nome, guerra, matrícula ou CPF"
          value={filters.search}
          onChange={handleFilterChange}
        />

        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">Todos os status</option>
          <option value="Ativo">Ativo</option>
          <option value="Afastado">Afastado</option>
          <option value="Transferido">Transferido</option>
          <option value="Inativo">Inativo</option>
        </select>

        <select
          name="participaTeste"
          value={filters.participaTeste}
          onChange={handleFilterChange}
        >
          <option value="">Todos</option>
          <option value="Sim">Equipe piloto</option>
          <option value="Não">Fora do piloto</option>
        </select>

        <button type="button" onClick={limparFiltros}>
          Limpar
        </button>
      </section>

      {erro && <p className="policiais-error">{erro}</p>}

      {showForm && (
        <PolicialForm
          user={user}
          policialEditando={policialEditando}
          onCancel={fecharForm}
          onSaved={handleSaved}
        />
      )}

      <PolicialTable
        policiais={policiais}
        loading={loading}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
        onView={setPolicialVisualizando}
        onEdit={abrirEdicao}
        onDelete={handleDelete}
      />

      <div className="policiais-pagination">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => setPagina((prev) => prev - 1)}
        >
          Anterior
        </button>

        <span>
          Página {pagina} de {totalPaginas}
        </span>

        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => setPagina((prev) => prev + 1)}
        >
          Próxima
        </button>
      </div>

      {policialVisualizando && (
        <PolicialViewModal
          policial={policialVisualizando}
          onClose={() => setPolicialVisualizando(null)}
        />
      )}
    </main>
  )
}