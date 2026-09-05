import SigmoButton from '../../../ui/components/SigmoButton'
import './COPTable.css'

export default function COPTable({
  cops = [],
  loading = false,
  sortBy,
  sortDirection,
  onSort,
  onView,
  onEdit,
  podeEditar = false
}) {
  function indicador(campo) {
    if (sortBy !== campo) return ''

    return sortDirection === 'asc'
      ? ' ▲'
      : ' ▼'
  }

  function ordenar(campo) {
    onSort?.(campo)
  }

  if (loading) {
    return (
      <div className="cop-table-empty">
        Carregando COPs...
      </div>
    )
  }

  if (!cops.length) {
    return (
      <div className="cop-table-empty">
        Nenhuma COP encontrada.
      </div>
    )
  }

  return (
    <div className="cop-table-wrapper">
      <table className="cop-table">
        <thead>
          <tr>
            <th>Foto</th>

            <th
              className="cop-table-sortable"
              onClick={() => ordenar('numero')}
            >
              Nº COP
              {indicador('numero')}
            </th>

            <th
              className="cop-table-sortable"
              onClick={() =>
                ordenar(
                  'identificacao_equipamento'
                )
              }
            >
              ID da câmera
              {indicador(
                'identificacao_equipamento'
              )}
            </th>

            <th
              className="cop-table-sortable"
              onClick={() => ordenar('marca')}
            >
              Marca
              {indicador('marca')}
            </th>

            <th>Status</th>
            <th>Local</th>

            <th className="cop-table-actions-header">
              Ações
            </th>
          </tr>
        </thead>

        <tbody>
          {cops.map((cop) => {
            const statusClass = String(
              cop.status_operacional || ''
            )
              .toLowerCase()
              .replaceAll('_', '-')

            return (
              <tr key={cop.id}>
                <td>
                  {cop.foto_url ? (
                    <img
                      src={cop.foto_url}
                      alt={`COP nº ${
                        cop.numero || ''
                      }`}
                      className="cop-thumb"
                    />
                  ) : (
                    <div className="cop-thumb-placeholder">
                      COP
                    </div>
                  )}
                </td>

                <td>
                  <strong>
                    {cop.numero || '-'}
                  </strong>
                </td>

                <td>
                  {cop.identificacao_equipamento ||
                    'Não informado'}
                </td>

                <td>
                  {cop.marca || 'MOTOROLA'}
                </td>

                <td>
                  <span
                    className={`cop-status ${statusClass}`}
                  >
                    {formatarStatus(
                      cop.status_operacional
                    )}
                  </span>
                </td>

                <td>
                  {cop.local_atual || '-'}
                </td>

                <td>
                  <div className="cop-table-actions">
                    <SigmoButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onView?.(cop)
                      }
                    >
                      Ver
                    </SigmoButton>

                    {podeEditar && (
                      <SigmoButton
                        type="button"
                        onClick={() =>
                          onEdit?.(cop)
                        }
                      >
                        Editar
                      </SigmoButton>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function formatarStatus(status) {
  const valor = String(status || '')
    .trim()
    .replaceAll('_', ' ')

  return valor || '-'
}
