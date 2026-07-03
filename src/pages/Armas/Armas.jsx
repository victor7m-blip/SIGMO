import { useState } from 'react'
import './Armas.css'

import { ArmaFilters, ArmaForm, ArmaTable } from './components'
import DetailsModal from '../../components/DetailsModal/DetailsModal'
import ArmaDetails from './components/ArmaDetails'

export default function Armas({ user }) {
  const [showForm, setShowForm] = useState(false)
  const [armaEditando, setArmaEditando] = useState(null)
  const [armaVisualizando, setArmaVisualizando] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

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

  return (
    <main className="armas-page">
      <header className="armas-header">
        <div>
          <span className="armas-kicker">SIGMO</span>
          <h1>Cadastro de Armas</h1>
          <p>Gestão, consulta e controle de armamento institucional.</p>
        </div>

        <button
          type="button"
          className="armas-primary-button"
          onClick={handleNovaArma}
        >
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

      <section className="armas-panel">
        <ArmaFilters />

        <ArmaTable
          user={user}
          reloadKey={reloadKey}
          onView={handleView}
          onEdit={handleEditar}
        />
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