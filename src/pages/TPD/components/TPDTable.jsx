import SigmoButton from '../../../ui/components/SigmoButton'
import './TPDTable.css'

export default function TPDTable({
  tpds = [],
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
      <div className="tpd-table-empty">
        Carregando TPDs...
      </div>
    )
  }

  if (!tpds.length) {
    return (
      <div className="tpd-table-empty">
        Nenhum TPD encontrado.
      </div>
    )
  }

  return (
    <div className="tpd-table-wrapper">
      <table className="tpd-table">
        <thead>
          <tr>
            <th>Foto</th>

            <th
              className="tpd-table-sortable"
              onClick={() =>
                ordenar('patrimonio')
              }
            >
              Patrimônio
              {indicador('patrimonio')}
            </th>

            <th
              className="tpd-table-sortable"
              onClick={() =>
                ordenar('numero_serie')
              }
            >
              Nº Série
              {indicador('numero_serie')}
            </th>

            <th
              className="tpd-table-sortable"
              onClick={() =>
                ordenar('marca')
              }
            >
              Marca
              {indicador('marca')}
            </th>

            <th
              className="tpd-table-sortable"
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
            <th className="tpd-table-actions-header">
              Ações
            </th>
          </tr>
        </thead>

        <tbody>
          {tpds.map((tpd) => {
            const statusClass = String(
              tpd.status_operacional || ''
            )
              .toLowerCase()
              .replaceAll('_', '-')

            return (
              <tr key={tpd.id}>
                <td>
                  {tpd.foto_url ? (
                    <img
                      src={tpd.foto_url}
                      alt={`TPD ${
                        tpd.numero_serie || ''
                      }`}
                      className="tpd-thumb"
                    />
                  ) : (
                    <div className="tpd-thumb-placeholder">
                      TPD
                    </div>
                  )}
                </td>

                <td>
                  {tpd.patrimonio || '-'}
                </td>

                <td>
                  {tpd.numero_serie || '-'}
                </td>

                <td>
                  {tpd.marca || '-'}
                </td>

                <td>
                  {tpd.modelo || '-'}
                </td>

                <td>
                  {tpd.tipo_equipamento || '-'}
                </td>

                <td>
                  <span
                    className={`tpd-status ${statusClass}`}
                  >
                    {tpd.status_operacional ||
                      '-'}
                  </span>
                </td>

                <td>
                  {tpd.local_atual || '-'}
                </td>

                <td>
                  {tpd.equipe_vinculada ||
                    '-'}
                </td>

                <td>
                  {tpd.viatura_vinculada ||
                    '-'}
                </td>

                <td>
                  <div className="tpd-table-actions">
                    <SigmoButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onView?.(tpd)
                      }
                    >
                      Ver
                    </SigmoButton>

                    <SigmoButton
                      type="button"
                      onClick={() =>
                        onEdit?.(tpd)
                      }
                    >
                      Editar
                    </SigmoButton>

                    <SigmoButton
                      type="button"
                      variant="danger"
                      onClick={() =>
                        onDelete?.(tpd)
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