export default function CarrinhoMovimentacao({ itens, onRemover }) {
  return (
    <div className="carrinho-movimentacao">
      <h3>Carrinho de Movimentação</h3>

      {itens.length === 0 ? (
        <p>Nenhum patrimônio adicionado.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Patrimônio</th>
              <th>Série</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td>{item.tipo}</td>
                <td>{item.descricao}</td>
                <td>{item.numero_patrimonio || '-'}</td>
                <td>{item.numero_serie || '-'}</td>
                <td>{item.status}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onRemover(item.id)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <strong>Total de itens: {itens.length}</strong>
    </div>
  )
}