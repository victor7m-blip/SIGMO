export default function MaterialCard({ material }) {
  const estoqueBaixo =
    material.minimo > 0 && material.quantidade <= material.minimo

  return (
    <article className="material-card">

      <div
        className="material-card-icon"
        style={{ backgroundColor: material.cor }}
      >
        {material.icone}
      </div>

      <div className="material-card-content">

        <span className="material-card-code">
          {material.codigo}
        </span>

        <h3>{material.nome}</h3>

        <div className="material-card-info">

          <div>
            <small>Quantidade</small>
            <strong>{material.quantidade}</strong>
          </div>

          <div>
            <small>Estoque mínimo</small>
            <strong>{material.minimo}</strong>
          </div>

        </div>

        <div
          className={`material-status ${
            estoqueBaixo ? 'danger' : 'ok'
          }`}
        >
          {estoqueBaixo
            ? 'Estoque abaixo do mínimo'
            : 'Estoque normal'}
        </div>

      </div>

    </article>
  )
}