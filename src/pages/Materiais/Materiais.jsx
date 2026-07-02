import './Materiais.css'

import materialTypes from './materialTypes'

import MaterialCard from './MaterialCard'
import MaterialResumo from './MaterialResumo'
import MaterialSidebarInfo from './MaterialSidebarInfo'

export default function Materiais() {
  return (
    <div className="materiais-page">

      <header className="materiais-header">
        <div>
          <span className="materiais-kicker">
            SIGMO • Almoxarifado
          </span>

          <h1>Cadastro de Materiais</h1>

          <p>
            Cadastre, organize e acompanhe todos os materiais utilizados pela
            unidade.
          </p>
        </div>

        <button className="materiais-btn">
          + Novo Material
        </button>
      </header>

      <section className="materiais-content">

        <div className="materiais-grid">

          {materialTypes.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
            />
          ))}

        </div>

        <aside className="materiais-sidebar">

          <MaterialResumo />

          <MaterialSidebarInfo />

        </aside>

      </section>

    </div>
  )
}