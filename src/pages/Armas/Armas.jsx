import './Armas.css'

import { ArmaFilters, ArmaTable } from './components'

export default function Armas() {
  return (
    <main className="armas-page">
      <header className="armas-header">
        <div>
          <span className="armas-kicker">SIGMO</span>
          <h1>Cadastro de Armas</h1>
          <p>Gestão, consulta e controle de armamento institucional.</p>
        </div>

        <button className="armas-primary-button">
          + Nova Arma
        </button>
      </header>

      <section className="armas-panel">
        <ArmaFilters />
        <ArmaTable />
      </section>
    </main>
  )
}