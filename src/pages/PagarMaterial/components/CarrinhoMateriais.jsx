export default function CarrinhoMateriais({
  itens = [],
  onRemover,
  onQuantidadeChange
}) {
  return (
    <div className="pagar-material-selected">
      <h3>Materiais selecionados</h3>

      {itens.length === 0 ? (
        <div className="pagar-material-empty">
          Nenhum material adicionado.
        </div>
      ) : (
        itens.map((material) => {
          const controlaQuantidade =
            material.controla_quantidade ||
            material.tipo_registro === 'TONFA_QUANTIDADE'

          const recebimentoQuantidade =
            material.tipo_registro === 'TONFA_QUANTIDADE'

          const quantidadeMaxima = Number(
            recebimentoQuantidade
              ? (
                  material.quantidade_maxima ??
                  material.quantidade_disponivel ??
                  material.quantidade ??
                  1
                )
              : (
                  material.quantidade_maxima ??
                  material.quantidade_disponivel ??
                  1
                )
          )

          const quantidadeSelecionada = Number(
            material.quantidade_receber ??
            material.quantidade_selecionada ??
            material.quantidade ??
            1
          )

          return (
            <article
              key={[
                material.tabela_origem,
                material.id
              ].join('-')}
              className="pagar-material-selected-item"
            >
              <div className="pagar-material-selected-info">
                <strong>
                  {material.patrimonio ||
                    material.numero_patrimonio ||
                    material.id}
                </strong>

                <span>
                  {material.descricao ||
                    material.modelo ||
                    'MATERIAL'}
                </span>

                <small>
                  {[
                    material.local_atual,
                    material.status
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </small>

                {controlaQuantidade && (
                  <label className="pagar-material-quantity">
                    <span>Quantidade</span>

                    <input
                      type="number"
                      min="1"
                      max={quantidadeMaxima}
                      value={quantidadeSelecionada}
                      onChange={(event) =>
                        onQuantidadeChange(
                          material.id,
                          event.target.value
                        )
                      }
                    />

                    <small>
                      {recebimentoQuantidade
                        ? 'Saldo em cautela'
                        : 'Disponível no cofre'}
                      : {quantidadeMaxima}
                    </small>
                  </label>
                )}
              </div>

              <button
                type="button"
                aria-label="Remover material"
                onClick={() => onRemover(material.id)}
              >
                ×
              </button>
            </article>
          )
        })
      )}
    </div>
  )
}