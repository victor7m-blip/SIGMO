export default function CarrinhoMateriais({
  itens = [],
  onRemover
}) {
  return (
    <div className="pagar-material-selected">
      <h3>Patrimônios selecionados</h3>

      {itens.length === 0 ? (
        <div className="pagar-material-empty">
          Nenhum patrimônio adicionado.
        </div>
      ) : (
        itens.map((material) => (
          <article
            key={[
              material.tabela_origem,
              material.id
            ].join('-')}
            className="pagar-material-selected-item"
          >
            <div>
              <strong>
                {material.patrimonio ||
                  material.numero_patrimonio ||
                  material.id}
              </strong>

              <span>
                {material.descricao ||
                  material.modelo ||
                  'PATRIMÔNIO'}
              </span>

              <small>
                {[
                  material.modulo,
                  material.categoria,
                  material.local_atual
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </small>
            </div>

            <button
              type="button"
              aria-label="Remover patrimônio"
              onClick={() =>
                onRemover(material.id)
              }
            >
              ×
            </button>
          </article>
        ))
      )}
    </div>
  )
}