export default function LocalTabela({
  locais,
  carregando,
  onEdit,
  onToggleAtivo,
  onDelete,
  onDuplicate,
}) {
  if (carregando) {
    return <p className="locais-vazio">Carregando locais...</p>
  }

  if (!locais.length) {
    return <p className="locais-vazio">Nenhum local encontrado.</p>
  }

  return (
    <table className="locais-tabela">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Tipo</th>
          <th>Recebe</th>
          <th>Entrega</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>

      <tbody>
        {locais.map((local) => (
          <tr key={local.id}>
            <td>
              <strong>{local.nome}</strong>
              {local.descricao && <span>{local.descricao}</span>}
            </td>

            <td>
              <span className="tipo-badge">{local.tipo}</span>
            </td>

            <td>{local.permite_receber ? '✅' : '—'}</td>
            <td>{local.permite_entregar ? '✅' : '—'}</td>

            <td>
              <span
                className={
                  local.ativo
                    ? 'status-badge ativo'
                    : 'status-badge inativo'
                }
              >
                {local.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>

            <td className="acoes-tabela">
              <button title="Editar" onClick={() => onEdit(local)}>
                ✏️
              </button>

              <button title="Duplicar" onClick={() => onDuplicate(local)}>
                📄
              </button>

              <button title="Ativar/Inativar" onClick={() => onToggleAtivo(local)}>
                {local.ativo ? '🚫' : '✅'}
              </button>

              <button
                title="Excluir"
                className="danger"
                onClick={() => onDelete(local)}
              >
                🗑️
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}