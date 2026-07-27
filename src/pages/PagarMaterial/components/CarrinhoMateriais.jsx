export default function CarrinhoMateriais({
  itens = [],
  onRemover,
  onQuantidadeChange
}) {
  return (
    <div className="pagar-material-selected">
      <h3>Materiais selecionados</h3>

      {itens.length === 0 ? (
        <div className="pagar-material-empty">Nenhum material adicionado.</div>
      ) : itens.map((material) => (
        <article
          key={[material.tabela_origem, material.id].join('-')}
          className="pagar-material-selected-item"
        >
          <div className="pagar-material-selected-info">
            <strong>{material.patrimonio || material.numero_patrimonio || material.id}</strong>
            <span>{material.descricao || material.modelo || 'MATERIAL'}</span>
            <small>{[material.local_atual, material.status].filter(Boolean).join(' • ')}</small>

            {material.controla_quantidade && (
              <label className="pagar-material-quantity">
                <span>Quantidade</span>
                <input
                  type="number"
                  min="1"
                  max={material.quantidade_maxima || material.quantidade_disponivel || 1}
                  value={material.quantidade || 1}
                  onChange={(event) => onQuantidadeChange(material.id, event.target.value)}
                />
                <small>Máximo disponível: {material.quantidade_maxima || material.quantidade_disponivel || 0}</small>
              </label>
            )}
          </div>

          <button type="button" aria-label="Remover material" onClick={() => onRemover(material.id)}>×</button>
        </article>
      ))}
    </div>
  )
}
