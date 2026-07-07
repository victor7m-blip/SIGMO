import SigmoEmpty from '../../ui/components/SigmoEmpty'
import SigmoCard from '../../ui/components/SigmoCard'
import PatrimonioStatusBadge from './PatrimonioStatusBadge'
import './PatrimonioList.css'

export default function PatrimonioList({
  itens = [],
  getTitulo,
  getSubtitulo,
  getStatus,
  onAbrir,
  emptyTitle = 'Nenhum item cadastrado',
  emptyText = 'Clique em novo cadastro para adicionar o primeiro registro.'
}) {
  if (!itens.length) {
    return <SigmoEmpty title={emptyTitle} text={emptyText} />
  }

  return (
    <div className="patrimonio-list">
      {itens.map((item) => (
        <SigmoCard key={item.id} className="patrimonio-list-item">
          <button type="button" onClick={() => onAbrir(item)}>
            <div>
              <strong>{getTitulo(item)}</strong>
              {getSubtitulo && <span>{getSubtitulo(item)}</span>}
            </div>

            {getStatus && (
              <PatrimonioStatusBadge status={getStatus(item)} />
            )}
          </button>
        </SigmoCard>
      ))}
    </div>
  )
}