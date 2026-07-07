export default function MovimentacaoTable({
  movimentacoes,
  loading,
  onAprovar,
  onRecusar,
  onReceber,
  onCancelar
}) {
  if (loading) {
    return <p>Carregando movimentações...</p>
  }

  if (!movimentacoes.length) {
    return <p>Nenhuma movimentação encontrada.</p>
  }

  return (
    <div className="movimentacao-table-wrap">
      <table className="movimentacao-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Origem</th>
            <th>Destino</th>
            <th>Solicitante</th>
            <th>Recebedor</th>
            <th>Itens</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {movimentacoes.map((mov) => (
            <tr key={mov.id}>
              <td>{new Date(mov.created_at).toLocaleString('pt-BR')}</td>
              <td>{mov.tipo_movimentacao}</td>
              <td>
                <span className={`status-pill status-${mov.status}`}>
                  {mov.status}
                </span>
              </td>
              <td>{mov.origem_local || '-'}</td>
              <td>{mov.destino_local || '-'}</td>
              <td>{mov.solicitante_nome || '-'}</td>
              <td>{mov.recebedor_nome || '-'}</td>
              <td>{mov.itens?.length || 0}</td>
              <td>
                <div className="movimentacao-table-actions">
                  {mov.status === 'aguardando_aprovacao' && (
                    <>
                      <button type="button" onClick={() => onAprovar(mov)}>
                        Aprovar
                      </button>

                      <button type="button" onClick={() => onRecusar(mov)}>
                        Recusar
                      </button>
                    </>
                  )}

                  {mov.status === 'aguardando_recebimento' && (
                    <button type="button" onClick={() => onReceber(mov)}>
                      Receber
                    </button>
                  )}

                  {!['finalizada', 'cancelada', 'recusada'].includes(mov.status) && (
                    <button type="button" onClick={() => onCancelar(mov)}>
                      Cancelar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}