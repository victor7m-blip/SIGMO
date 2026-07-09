import './PatrimonioLista.css'

export default function PatrimonioLista({
  itens = [],
  itemSelecionado,
  onSelect,
  getTitulo,
  getSubtitulo,
  getStatus,
}) {
  return (
    <aside className="patrimonio-lista">
      <div className="patrimonio-lista-header">
        <strong>Itens patrimoniais</strong>
        <span>{itens.length} registros</span>
      </div>

      {itens.length === 0 ? (
        <div className="patrimonio-empty">
          <h2>Nenhum item carregado</h2>
          <p>
            A lista será preenchida pelo service do módulo conectado ao Motor
            Patrimonial.
          </p>
        </div>
      ) : (
        <div className="patrimonio-lista-items">
          {itens.map((item) => {
            const ativo = itemSelecionado?.id === item.id

            return (
              <button
                key={item.id}
                type="button"
                className={ativo ? 'patrimonio-lista-item active' : 'patrimonio-lista-item'}
                onClick={() => onSelect?.(item)}
              >
                <div>
                  <strong>{getTitulo?.(item) || item.nome || item.patrimonio || 'Item patrimonial'}</strong>
                  <span>{getSubtitulo?.(item) || item.numero_serie || item.local || 'Sem subtítulo'}</span>
                </div>

                <small>{getStatus?.(item) || item.status || 'Ativo'}</small>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}