import './table.css'

export default function Table({
  columns,
  data = [],
  emptyMessage = 'Nenhum registro encontrado.'
}) {
  return (
    <div className="sigmo-table-wrapper">

      <table className="sigmo-table">

        <thead>

          <tr>
            {columns.map(col => (
              <th key={col.key}>
                {col.label}
              </th>
            ))}
          </tr>

        </thead>

        <tbody>

          {data.length === 0 && (
            <tr>

              <td
                colSpan={columns.length}
                className="sigmo-table-empty"
              >
                {emptyMessage}
              </td>

            </tr>
          )}

          {data.map((row,index)=>(

            <tr key={row.id ?? index}>

              {columns.map(col=>(

                <td key={col.key}>

                  {col.render
                    ? col.render(row)
                    : row[col.key]}

                </td>

              ))}

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  )
}