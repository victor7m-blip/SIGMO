import './PatrimonioFotos.css'

export default function PatrimonioFotos({ config, item }) {
  return (
    <section className="patrimonio-section">
      <header>
        <h3>Fotos</h3>
        <p>Fotos vinculadas ao patrimônio.</p>
      </header>

      <div className="patrimonio-empty-box">
        Upload genérico será ligado na próxima etapa.
      </div>
    </section>
  )
}