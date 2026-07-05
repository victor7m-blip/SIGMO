import { useEffect, useMemo, useState } from 'react'
import './Armas.css'

import { ArmaFilters, ArmaForm, ArmaTable } from './components'
import DetailsModal from '../../components/DetailsModal/DetailsModal'
import ArmaDetails from './components/ArmaDetails'
import { listarArmas } from '../../services/armasService'

const initialFilters = {
  patrimonio: '',
  numero_serie: '',
  qr_code: '',
  especie: '',
  calibre: '',
  status: '',
  unidade: ''
}

const LIMITE_POR_PAGINA = 20

export default function Armas({ user }) {
  const [showForm, setShowForm] = useState(false)
  const [armaEditando, setArmaEditando] = useState(null)
  const [armaVisualizando, setArmaVisualizando] = useState(null)

  const [armas, setArmas] = useState([])
  const [filters, setFilters] = useState(initialFilters)
  const [debouncedFilters, setDebouncedFilters] = useState(initialFilters)

  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [sortBy, setSortBy] = useState('patrimonio')
  const [sortDirection, setSortDirection] = useState('asc')

  const totalPaginas = Math.ceil(total / LIMITE_POR_PAGINA) || 1

  const registroInicial =
    total === 0 ? 0 : (pagina - 1) * LIMITE_POR_PAGINA + 1

  const registroFinal = Math.min(
    pagina * LIMITE_POR_PAGINA,
    total
  )

  const paginasVisiveis = useMemo(() => {
    const paginas = []
    const inicio = Math.max(1, pagina - 2)
    const fim = Math.min(totalPaginas, pagina + 2)

    for (let i = inicio; i <= fim; i++) {
      paginas.push(i)
    }

    return paginas
  }, [pagina, totalPaginas])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
      setPagina(1)
    }, 400)

    return () => clearTimeout(timer)
  }, [filters])

  useEffect(() => {
    carregarArmas()
  }, [debouncedFilters, pagina, reloadKey, sortBy, sortDirection])

  async function carregarArmas() {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarArmas({
        filtros: debouncedFilters,
        pagina,
        limite: LIMITE_POR_PAGINA,
        sortBy,
        sortDirection
      })

      setArmas(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)
      setErro('Erro ao carregar armas.')
    } finally {
      setLoading(false)
    }
  }

  function handleNovaArma() {
    setArmaEditando(null)
    setShowForm(true)
  }

  function handleView(arma) {
    setArmaVisualizando(arma)
  }

  function handleEditar(arma) {
    setArmaEditando(arma)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancel() {
    setArmaEditando(null)
    setShowForm(false)
  }

  function handleSaved() {
    setArmaEditando(null)
    setShowForm(false)
    setReloadKey((prev) => prev + 1)
  }

  function handleFiltersChange(newFilters) {
    setFilters(newFilters)
  }

  function handleClearFilters() {
    setFilters(initialFilters)
    setDebouncedFilters(initialFilters)
    setPagina(1)
  }

  function handleDeleted(id) {
    setArmas((listaAtual) =>
      listaAtual.filter((arma) => arma.id !== id)
    )

    setTotal((atual) => Math.max(atual - 1, 0))
  }

  function handleSort(campo) {
    setPagina(1)

    if (sortBy === campo) {
      setSortDirection((atual) =>
        atual === 'asc' ? 'desc' : 'asc'
      )
      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  return (
    <main className="page">
      <header className="armas-header">
        <div>
          <span className="armas-kicker">SIGMO</span>
          <h1>Cadastro de Armas</h1>
          <p>Gestão, consulta e controle de armamento institucional.</p>
        </div>

        <button type="button" className="btn-primary" onClick={handleNovaArma}>
          + Nova Arma
        </button>
      </header>

      {showForm && (
        <ArmaForm
          user={user}
          armaEditando={armaEditando}
          onCancel={handleCancel}
          onSaved={handleSaved}
        />
      )}

      <section className="panel">
        <ArmaFilters
          filtros={filters}
          onChange={handleFiltersChange}
          onClear={handleClearFilters}
        />

        <div className="armas-table-toolbar">
          <span>
            Mostrando {registroInicial}–{registroFinal} de {total} registros
          </span>
        </div>

        <ArmaTable
          user={user}
          armas={armas}
          loading={loading}
          erro={erro}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
          onView={handleView}
          onEdit={handleEditar}
          onDeleted={handleDeleted}
        />

        <div className="armas-pagination">
          <button type="button" disabled={pagina <= 1} onClick={() => setPagina(1)}>
            Primeira
          </button>

          <button type="button" disabled={pagina <= 1} onClick={() => setPagina((prev) => prev - 1)}>
            Anterior
          </button>

          {pagina > 3 && <span className="armas-pagination-dots">...</span>}

          {paginasVisiveis.map((numero) => (
            <button
              key={numero}
              type="button"
              className={numero === pagina ? 'active' : ''}
              onClick={() => setPagina(numero)}
            >
              {numero}
            </button>
          ))}

          {pagina < totalPaginas - 2 && <span className="armas-pagination-dots">...</span>}

          <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((prev) => prev + 1)}>
            Próxima
          </button>

          <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(totalPaginas)}>
            Última
          </button>
        </div>
      </section>

      <DetailsModal
        isOpen={!!armaVisualizando}
        title="Detalhes da Arma"
        subtitle={armaVisualizando?.patrimonio}
        onClose={() => setArmaVisualizando(null)}
      >
        <ArmaDetails arma={armaVisualizando} />
      </DetailsModal>
    </main>
  )
}