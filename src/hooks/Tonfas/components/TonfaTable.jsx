function labelStatus(status) {
  return String(status || 'SEM_STATUS').replaceAll('_', ' ')
}

function classeStatus(status) {
  return String(status || 'sem-status')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('_', '-')
    .replaceAll(' ', '-')
}

export default function TonfaTable({
  tonfas = [],
  loading,
  onView,
  onEdit,
  onDelete
}) {
  if (loading) {
    return <div className="tonfa-empty">Carregando...</div>
  }

  if (!tonfas.length) {
    return (
      <div className="tonfa-empty">
        Nenhum registro encontrado.
      </div>
    )
  }

  return (
    <div className="tonfa-table-wrap">
      <table className="tonfa-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Unidade</th>
            <th>Status</th>
            <th>Local atual</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {tonfas.map((item) => {
            const possuiAcoes =
              typeof onView === 'function' ||
              typeof onEdit === 'function' ||
              typeof onDelete === 'function'

            return (
              <tr key={item.id}>
                <td>
                  <strong>
                    {item.tipo === 'CASSETETE'
                      ? 'Cassetete'
                      : 'Tonfa'}
                  </strong>
                </td>

                <td>{item.unidade || '—'}</td>

                <td>
                  <span
                    className={`tonfa-status tonfa-status-${classeStatus(
                      item.status_operacional
                    )}`}
                  >
                    {labelStatus(item.status_operacional)}
                  </span>
                </td>

                <td>{item.local_atual || '—'}</td>

                <td>
                  {possuiAcoes ? (
                    <div className="tonfa-row-actions">
                      {typeof onView === 'function' && (
                        <button
                          type="button"
                          onClick={() => onView(item)}
                        >
                          Ver
                        </button>
                      )}

                      {typeof onEdit === 'function' && (
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                        >
                          Editar
                        </button>
                      )}

                      {typeof onDelete === 'function' && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onDelete(item)}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}