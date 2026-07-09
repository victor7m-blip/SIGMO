import './PatrimonioDetails.css'

export default function PatrimonioDetails({
  item,
  abaAtiva = 'dados',
  onAbaChange,
  onEdit,
  onDelete,
  children,
}) {
  const abas = [
    { key: 'dados', label: 'Dados' },
    { key: 'fotos', label: 'Fotos' },
    { key: 'qrcode', label: 'QR Code' },
    { key: 'movimentacoes', label: 'Movimentações' },
  ]

  return (
    <section className="patrimonio-detalhes">
      <div className="patrimonio-card">
        <div className="patrimonio-card-top">
          <div>
            <span className="card-label">Detalhes</span>
            <h2>{item?.nome || item?.patrimonio || 'Selecione um item'}</h2>
            <p>
              {item
                ? 'Dados principais, fotos, QR Code e histórico de movimentações.'
                : 'Aqui entrarão os detalhes do patrimônio selecionado.'}
            </p>
          </div>

          {item && (
            <div className="patrimonio-card-actions">
              <button type="button" onClick={() => onEdit?.(item)}>
                Editar
              </button>

              <button type="button" onClick={() => onDelete?.(item)}>
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="patrimonio-tabs">
        {abas.map((aba) => (
          <button
            key={aba.key}
            type="button"
            className={abaAtiva === aba.key ? 'active' : ''}
            onClick={() => onAbaChange?.(aba.key)}
          >
            {aba.label}
          </button>
        ))}
      </div>

      <div className="patrimonio-panel">
        {children || (
          <div className="panel-placeholder">
            Motor Patrimonial pronto para receber componentes internos.
          </div>
        )}
      </div>
    </section>
  )
}