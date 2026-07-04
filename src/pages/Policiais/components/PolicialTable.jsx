const colunasOrdenaveis = [
  { campo: 'nome_completo', label: 'Nome' },
  { campo: 'nome_guerra', label: 'Guerra' },
  { campo: 'matricula', label: 'Matrícula' },
  { campo: 'posto_graduacao', label: 'Posto/Graduação' },
  { campo: 'unidade', label: 'Unidade' },
  { campo: 'status', label: 'Status' }
]

export default function PolicialTable({
  policiais,
  loading,
  sortBy,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDelete
}) {
  function renderSort(campo) {
    if (sortBy !== campo) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <section className="policiais-table-card">
      <div className="policiais-table-toolbar">
        <span>{policiais.length} registro(s) exibido(s)</span>
      </div>

      <div className="policiais-table-wrap">
        <table className="policiais-table">
          <thead>
            <tr>
              {colunasOrdenaveis.map((coluna) => (
                <th key={coluna.campo}>
                  <button
                    type="button"
                    onClick={() => onSort(coluna.campo)}
                  >
                    {coluna.label}{renderSort(coluna.campo)}
                  </button>
                </th>
              ))}
              <th>Piloto</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="8">Carregando...</td>
              </tr>
            )}

            {!loading && policiais.length === 0 && (
              <tr>
                <td colSpan="8">Nenhum policial encontrado.</td>
              </tr>
            )}

            {!loading && policiais.map((policial) => (
              <tr key={policial.id}>
                <td>{policial.nome_completo || '-'}</td>
                <td>{policial.nome_guerra || '-'}</td>
                <td>{policial.matricula || '-'}</td>
                <td>{policial.posto_graduacao || '-'}</td>
                <td>{policial.unidade || '-'}</td>
                <td>
                  <span className="policiais-status">
                    {policial.status || '-'}
                  </span>
                </td>
                <td>
                  {policial.participa_teste ? 'Sim' : 'Não'}
                </td>
                <td>
                  <div className="policiais-actions">
                    <button type="button" onClick={() => onView(policial)}>
                      Ver
                    </button>

                    <button type="button" onClick={() => onEdit(policial)}>
                      Editar
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() => onDelete(policial)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}