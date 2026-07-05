import { useEffect, useState } from 'react'
import {
  listarPoliciais,
  excluirPolicial
} from '../../services/policiaisService'

import PolicialForm from './components/PolicialForm'
import PolicialTable from './components/PolicialTable'
import PolicialViewModal from './components/PolicialViewModal'

import './Policiais.css'
import './styles/policiaisForm.css'
import './styles/policiaisTable.css'
import './styles/policiaisModal.css'

const initialFilters = {
  busca: '',
  situacao: '',
  companhia: '',
  pelotao: '',
  perfil: ''
}

export default function Policiais({ user }) {
  const [policiais, setPoliciais] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [filters, setFilters] = useState(initialFilters)

  const [pagina, setPagina] = useState(1)
  const [limite] = useState(10)
  const [total, setTotal] = useState(0)

  const [sortBy, setSortBy] = useState('nome')
  const [sortDirection, setSortDirection] = useState('asc')

  const [showForm, setShowForm] = useState(false)
  const [policialEditando, setPolicialEditando] = useState(null)
  const [policialVisualizando, setPolicialVisualizando] = useState(null)

  const totalPaginas = Math.max(1, Math.ceil(total / limite))

  async function carregarPoliciais() {
    try {
      setLoading(true)
      setErro('')

      const response = await listarPoliciais({
        ...filters,
        sortBy,
        sortDirection,
        pagina,
        limite
      })

      setPoliciais(response.data)
      setTotal(response.count)
    } catch (err) {
      console.error(err)
      setErro('Erro ao carregar policiais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPoliciais()
  }, [filters, sortBy, sortDirection, pagina])

  function handleFilterChange(event) {
    const { name, value } = event.target

    setFilters(prev => ({
      ...prev,
      [name]: value
    }))

    setPagina(1)
  }

  function limparFiltros() {
    setFilters(initialFilters)
    setPagina(1)
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

  function handleSaved() {
    fecharForm()
    carregarPoliciais()
  }

  async function handleDelete(policial) {
    await excluirPolicial(policial.id)
    carregarPoliciais()
  }

  function handleSort(campo) {
    if (sortBy === campo) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(campo)
      setSortDirection('asc')
    }
  }

  return (
    <div className="policiais-page">
      <div className="policiais-header">
        <div>
          <h1>Policiais</h1>
          <p>Cadastro e controle do efetivo operacional.</p>
        </div>

        <button className="btn-primary" onClick={abrirCadastro}>
          + Novo policial
        </button>
      </div>

      <div className="policiais-panel">
        <div className="policiais-filters">
          <div className="filter-group filter-wide">
            <label>Buscar</label>
            <input
              name="busca"
              value={filters.busca}
              onChange={handleFilterChange}
              placeholder="Nome, nome de guerra, RE ou CPF"
            />
          </div>

          <div className="filter-group">
            <label>Situação</label>
            <select
              name="situacao"
              value={filters.situacao}
              onChange={handleFilterChange}
            >
              <option value="">Todas</option>
              <option value="Ativo">Ativo</option>
              <option value="Afastado">Afastado</option>
              <option value="Transferido">Transferido</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Companhia</label>
            <input
              name="companhia"
              value={filters.companhia}
              onChange={handleFilterChange}
              placeholder="Ex: 1ª Cia"
            />
          </div>

          <div className="filter-group">
            <label>Pelotão</label>
            <input
              name="pelotao"
              value={filters.pelotao}
              onChange={handleFilterChange}
              placeholder="Ex: 1º Pelotão"
            />
          </div>

          <div className="filter-group">
            <label>Perfil</label>
            <select
              name="perfil"
              value={filters.perfil}
              onChange={handleFilterChange}
            >
              <option value="">Todos</option>
              <option value="Administrador">Administrador</option>
              <option value="Gestor">Gestor</option>
              <option value="Operador">Operador</option>
              <option value="Consulta">Consulta</option>
            </select>
          </div>

          <button className="btn-secondary" onClick={limparFiltros}>
            Limpar
          </button>
        </div>

        <PolicialTable
          policiais={policiais}
          loading={loading}
          erro={erro}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
          onView={setPolicialVisualizando}
          onEdit={abrirEdicao}
          onDelete={handleDelete}
        />

        <div className="policiais-pagination">
          <span>
            Total: <strong>{total}</strong>
          </span>

          <div>
            <button
              className="btn-secondary"
              disabled={pagina <= 1}
              onClick={() => setPagina(prev => prev - 1)}
            >
              Anterior
            </button>

            <span>
              Página {pagina} de {totalPaginas}
            </span>

            <button
              className="btn-secondary"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(prev => prev + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <PolicialForm
          user={user}
          policialEditando={policialEditando}
          onCancel={fecharForm}
          onSaved={handleSaved}
        />
      )}

      {policialVisualizando && (
        <PolicialViewModal
          policial={policialVisualizando}
          onClose={() => setPolicialVisualizando(null)}
        />
      )}
    </div>
  )
}