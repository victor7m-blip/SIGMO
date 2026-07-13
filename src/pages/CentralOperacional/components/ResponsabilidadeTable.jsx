import StatusOperacionalBadge from './StatusOperacionalBadge'

export default function ResponsabilidadeTable({
  responsaveis = [],
  onSelecionar
}) {
  if (!responsaveis.length) {
    return (
      <div className="central-empty">
        Nenhum patrimônio desta categoria está vinculado a policial.
      </div>
    )
  }

  return (
    <div className="central-table-wrapper">
      <table className="central-table">
        <thead>
          <tr>
            <th>RE</th>
            <th>Policial</th>
            <th>Quantidade</th>
            <th>Patrimônios</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {responsaveis.map((responsavel) => (
            <tr
              key={`${responsavel.re}-${responsavel.nome}`}
              onClick={() => onSelecionar?.(responsavel)}
              className="central-table-row-clickable"
            >
              <td data-label="RE">
                <strong>{responsavel.re || '—'}</strong>
              </td>

              <td data-label="Policial">
                {responsavel.nome || 'NÃO IDENTIFICADO'}
              </td>

              <td data-label="Quantidade">{responsavel.quantidade}</td>

              <td data-label="Patrimônios">
                <div className="central-table-patrimonios">
                  {responsavel.patrimonios.slice(0, 4).map((item) => (
                    <span key={item.id}>{item.identificador}</span>
                  ))}

                  {responsavel.patrimonios.length > 4 && (
                    <span>+{responsavel.patrimonios.length - 4}</span>
                  )}
                </div>
              </td>

              <td data-label="Status">
                <StatusOperacionalBadge
                  status={
                    responsavel.possui_divergencia ? 'DIVERGENTE' : 'OK'
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}