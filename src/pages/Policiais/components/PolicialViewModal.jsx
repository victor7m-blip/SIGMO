import { useState } from 'react'

const colunasOrdenaveis = [
  { campo: 'nome_guerra', label: 'Nome de guerra' },
  { campo: 're', label: 'RE' },
  { campo: 'posto_graduacao', label: 'Posto/Graduação' },
  { campo: 'companhia', label: 'Companhia' },
  { campo: 'pelotao', label: 'Pelotão' },
  { campo: 'perfil', label: 'Perfil' },
  { campo: 'situacao', label: 'Situação' }
]

export default function PolicialTable({
  policiais,
  loading,
  erro,
  sortBy,
  sortDirection,
  onSort,
  onView,
  onEdit,
  onDelete
}) {
  const [excluindoId, setExcluindoId] = useState(null)

  function sortIcon(campo) {
    if (sortBy !== campo) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  async function confirmarExclusao(policial) {
    const confirmou = window.confirm(
      `Deseja excluir o policial ${policial.nome_guerra || policial.nome}?`
    )

    if (!confirmou) return

    try {
      setExcluindoId(policial.id)
      await onDelete(policial)
    } finally {
      setExcluindoId(null)
    }
  }

  if (loading) {
    return <div className="table-state">Carregando policiais...</div>
  }

  if (erro) {
    return <div className="table-error">{erro}</div>
  }

  if (!policiais.length) {
    return <div className="table-state">Nenhum policial encontrado.</div>
  }

  return (
    <div className="policiais-table-wrap">
      <table className="policiais-table">
        <thead>
          <tr>
            {colunasOrdenaveis.map(coluna => (
              <th key={coluna.campo}>
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => onSort(coluna.campo)}
                >
                  {coluna.label} {sortIcon(coluna.campo)}
                </button>
              </th>
            ))}
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {policiais.map(policial => (
            <tr key={policial.id}>
              <td>
                <strong>{policial.nome_guerra || '-'}</strong>
                <span>{policial.nome || '-'}</span>
              </td>
              <td>{policial.re || '-'}</td>
              <td>{policial.posto_graduacao || '-'}</td>
              <td>{policial.companhia || '-'}</td>
              <td>{policial.pelotao || '-'}</td>
              <td>{policial.perfil || '-'}</td>
              <td>
                <span className={`status-badge status-${policial.situacao?.toLowerCase()}`}>
                  {policial.situacao || '-'}
                </span>
              </td>
              <td>
                <div className="table-actions">
                  <button onClick={() => onView(policial)}>Ver</button>
                  <button onClick={() => onEdit(policial)}>Editar</button>
                  <button
                    className="danger"
                    disabled={excluindoId === policial.id}
                    onClick={() => confirmarExclusao(policial)}
                  >
                    {excluindoId === policial.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}