import SigmoButton from '../../../ui/components/SigmoButton'
import "../styles/HTTable.css";

export default function HTTable({
  hts = [],
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
      <div className="ht-table-empty">
        Carregando HTs...
      </div>
    )
  }

  if (!hts.length) {
    return (
      <div className="ht-table-empty">
        Nenhum HT encontrado.
      </div>
    )
  }

  return (
    <div className="ht-table-wrapper">
      <table className="ht-table">
        <thead>
          <tr>
            <th>Foto</th>

            <th
              className="ht-table-sortable"
              onClick={() =>
                ordenar('patrimonio')
              }
            >
              Patrimônio
              {indicador('patrimonio')}
            </th>

            <th
              className="ht-table-sortable"
              onClick={() =>
                ordenar('numero_serie')
              }
            >
              Nº Série
              {indicador('numero_serie')}
            </th>

            <th
              className="ht-table-sortable"
              onClick={() =>
                ordenar('marca')
              }
            >
              Marca
              {indicador('marca')}
            </th>

            <th
              className="ht-table-sortable"
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

            <th className="ht-table-actions-header">
              Ações
            </th>
          </tr>
        </thead>

        <tbody>
          {hts.map((ht) => {
            const statusClass = String(
              ht.status_operacional || ''
            )
              .toLowerCase()
              .replaceAll('_', '-')

            return (
              <tr key={ht.id}>
                <td>
                  {ht.foto_url ? (
                    <img
                      src={ht.foto_url}
                      alt={`HT ${
                        ht.numero_serie || ''
                      }`}
                      className="ht-thumb"
                    />
                  ) : (
                    <div className="ht-thumb-placeholder">
                      HT
                    </div>
                  )}
                </td>

                <td>
                  {ht.patrimonio || '-'}
                </td>

                <td>
                  {ht.numero_serie || '-'}
                </td>

                <td>
                  {ht.marca || '-'}
                </td>

                <td>
                  {ht.modelo || '-'}
                </td>

                <td>
                  {ht.tipo_ht || '-'}
                </td>

                <td>
                  <span
                    className={`ht-status ${statusClass}`}
                  >
                    {ht.status_operacional ||
                      '-'}
                  </span>
                </td>

                <td>
                  {ht.local_atual || '-'}
                </td>

                <td>
                  {ht.equipe_vinculada ||
                    '-'}
                </td>

                <td>
                  {ht.viatura_vinculada ||
                    '-'}
                </td>

                <td>
                  <div className="ht-table-actions">
                    <SigmoButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onView?.(ht)
                      }
                    >
                      Ver
                    </SigmoButton>

                    <SigmoButton
                      type="button"
                      onClick={() =>
                        onEdit?.(ht)
                      }
                    >
                      Editar
                    </SigmoButton>

                    <SigmoButton
                      type="button"
                      variant="danger"
                      onClick={() =>
                        onDelete?.(ht)
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