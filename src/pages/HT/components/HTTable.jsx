import SigmoButton from '../../../ui/components/SigmoButton'
import '../styles/HTTable.css'

function formatarStatus(valor) {
  const nomes = {
    RESERVA: 'Reserva',
    EM_SERVICO: 'Em serviço',
    MANUTENCAO: 'Manutenção',
    RECOLHIDO: 'Recolhido',
    BAIXADO: 'Baixado'
  }

  return nomes[valor] || String(valor || 'Sem status').replaceAll('_', ' ')
}

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
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  if (loading) {
    return <div className="ht-table-empty">Carregando rádios HT...</div>
  }

  if (!hts.length) {
    return <div className="ht-table-empty">Nenhum HT encontrado com os filtros selecionados.</div>
  }

  return (
    <div className="ht-table-wrapper">
      <table className="ht-table">
        <thead>
          <tr>
            <th>Equipamento</th>
            <th className="ht-table-sortable" onClick={() => onSort?.('patrimonio')}>
              Patrimônio{indicador('patrimonio')}
            </th>
            <th className="ht-table-sortable" onClick={() => onSort?.('numero_serie')}>
              Nº Série{indicador('numero_serie')}
            </th>
            <th>Status</th>
            <th>Local / vínculo</th>
            <th>Unidade</th>
            <th className="ht-table-actions-header">Ações</th>
          </tr>
        </thead>

        <tbody>
          {hts.map((ht) => {
            const statusClass = String(ht.status_operacional || '')
              .toLowerCase()
              .replaceAll('_', '-')

            const vinculo = ht.equipe_vinculada || ht.viatura_vinculada || ''

            return (
              <tr key={ht.id}>
                <td>
                  <div className="ht-equipment-cell">
                    {ht.foto_url ? (
                      <img src={ht.foto_url} alt={`HT ${ht.numero_serie || ''}`} className="ht-thumb" />
                    ) : (
                      <div className="ht-thumb-placeholder">HT</div>
                    )}
                    <div>
                      <strong>{[ht.marca, ht.modelo].filter(Boolean).join(' ') || 'Rádio HT'}</strong>
                      <span>{ht.tipo_ht || 'PORTÁTIL'}</span>
                    </div>
                  </div>
                </td>
                <td><strong className="ht-code">{ht.patrimonio || '—'}</strong></td>
                <td><span className="ht-code">{ht.numero_serie || '—'}</span></td>
                <td>
                  <span className={`ht-status ${statusClass}`}>
                    {formatarStatus(ht.status_operacional)}
                  </span>
                </td>
                <td>
                  <div className="ht-location-cell">
                    <strong>{ht.local_atual || 'Local não informado'}</strong>
                    {vinculo && <span>{vinculo}</span>}
                  </div>
                </td>
                <td>{ht.unidade || '—'}</td>
                <td>
                  <div className="ht-table-actions">
                    <SigmoButton type="button" variant="secondary" onClick={() => onView?.(ht)}>Ver</SigmoButton>
                    <SigmoButton type="button" onClick={() => onEdit?.(ht)}>Editar</SigmoButton>
                    <SigmoButton type="button" variant="danger" onClick={() => onDelete?.(ht)}>Excluir</SigmoButton>
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
