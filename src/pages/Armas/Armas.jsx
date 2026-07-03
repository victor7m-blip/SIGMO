import { useState } from 'react'
import './Armas.css'

import { ArmaFilters, ArmaForm, ArmaTable } from './components'

export default function Armas() {
  const [showForm, setShowForm] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  function handleSaved() {
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
          className="armas-primary-button"
          onClick={() => setShowForm(true)}
        >
          + Nova Arma
        </button>
      </header>

      {showForm && (
        <ArmaForm
          onCancel={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}

      <section className="armas-panel">
        <ArmaFilters />
        <ArmaTable reloadKey={reloadKey} />
      </section>
    </main>
  )
}