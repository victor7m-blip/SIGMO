import SigmoButton from '../../../ui/components/SigmoButton'
import "../styles/TaserTable.css";

export default function TaserTable({
  tasers = [],
  loading = false,
  sortBy,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDelete
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
      <div className="taser-table-empty">
        Carregando Tasers...
      </div>
    )
  }

  if (!tasers.length) {
    return (
      <div className="taser-table-empty">
        Nenhum Taser encontrado.
      </div>
    )
  }

  return (
    <div className="taser-table-wrapper">
      <table className="taser-table">
        <thead>
          <tr>
            <th>Foto</th>

            <th
              className="taser-table-sortable"
              onClick={() =>
                ordenar('patrimonio')
              }
            >
              Patrimônio
              {indicador('patrimonio')}
            </th>

            <th
              className="taser-table-sortable"
              onClick={() =>
                ordenar('numero_serie')
              }
            >
              Nº Série
              {indicador('numero_serie')}
            </th>

            <th
              className="taser-table-sortable"
              onClick={() =>
                ordenar('marca')
              }
            >
              Marca
              {indicador('marca')}
            </th>

            <th
              className="taser-table-sortable"
              onClick={() =>
                ordenar('modelo')
              }
            >
              Modelo
              {indicador('modelo')}
            </th>

            <th>Tipo</th>
            <th>Status</th>
            <th>Local</th>
            <th>Equipe</th>
            <th>Viatura</th>

            <th className="taser-table-actions-header">
              Ações
            </th>
          </tr>
        </thead>

        <tbody>
          {tasers.map((taser) => {
            const statusClass = String(
              taser.status_operacional || ''
            )
              .toLowerCase()
              .replaceAll('_', '-')

            return (
              <tr key={taser.id}>
                <td>
                  {taser.foto_url ? (
                    <img
                      src={taser.foto_url}
                      alt={`Taser ${
                        taser.numero_serie || ''
                      }`}
                      className="taser-thumb"
                    />
                  ) : (
                    <div className="taser-thumb-placeholder">
                      Taser
                    </div>
                  )}
                </td>

                <td>
                  {taser.patrimonio || '-'}
                </td>

                <td>
                  {taser.numero_serie || '-'}
                </td>

                <td>
                  {taser.marca || '-'}
                </td>

                <td>
                  {taser.modelo || '-'}
                </td>

                <td>
                  {taser.tipo_taser || '-'}
                </td>

                <td>
                  <span
                    className={`taser-status ${statusClass}`}
                  >
                    {taser.status_operacional ||
                      '-'}
                  </span>
                </td>

                <td>
                  {taser.local_atual || '-'}
                </td>

                <td>
                  {taser.equipe_vinculada ||
                    '-'}
                </td>

                <td>
                  {taser.viatura_vinculada ||
                    '-'}
                </td>

                <td>
                  <div className="taser-table-actions">
                    <SigmoButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onView?.(taser)
                      }
                    >
                      Ver
                    </SigmoButton>

                    <SigmoButton
                      type="button"
                      onClick={() =>
                        onEdit?.(taser)
                      }
                    >
                      Editar
                    </SigmoButton>

                    <SigmoButton
                      type="button"
                      variant="danger"
                      onClick={() =>
                        onDelete?.(taser)
                      }
                    >
                      Excluir
                    </SigmoButton>
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