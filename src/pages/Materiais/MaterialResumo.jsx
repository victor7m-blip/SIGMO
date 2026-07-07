import materialTypes from './materialTypes'

export default function MaterialResumo() {
  const totalCategorias = materialTypes.length

  const totalItens = materialTypes.reduce(
    (total, material) => total + material.quantidade,
    0
  )

  const estoqueBaixo = materialTypes.filter(
    (material) =>
      material.minimo > 0 && material.quantidade <= material.minimo
  ).length

  return (
    <section className="material-resumo">

      <h2>Resumo do Estoque</h2>

      <div className="material-resumo-lista">

        <div className="material-resumo-item">
          <span>Categorias</span>
          <strong>{totalCategorias}</strong>
        </div>

        <div className="material-resumo-item">
          <span>Total de itens</span>
          <strong>{totalItens}</strong>
        </div>

        <div className="material-resumo-item danger">
          <span>Estoque baixo</span>
          <strong>{estoqueBaixo}</strong>
        </div>

      </div>

    </section>
  )
}