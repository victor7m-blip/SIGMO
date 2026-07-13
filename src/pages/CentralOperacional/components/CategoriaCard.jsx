export default function CategoriaCard({
  categoria,
  selecionada = false,
  onClick
}) {
  const {
    total = 0,
    com_policial = 0,
    no_cofre = 0,
    sem_localizacao = 0,
    divergencias = 0
  } = categoria ?? {}

  return (
    <button
      type="button"
      className={`central-categoria-card ${
        selecionada ? 'central-categoria-card-ativo' : ''
      }`}
      onClick={() => onClick?.(categoria)}
    >
      <div className="central-categoria-card-topo">
        <div>
          <span className="central-categoria-card-label">Categoria</span>

          <h3>{categoria?.categoria || 'PATRIMÔNIO'}</h3>
        </div>

        <span className="central-categoria-card-seta">›</span>
      </div>

      <div className="central-categoria-card-total">
        <strong>{total}</strong>
        <span>Total ativo</span>
      </div>

      <div className="central-categoria-card-grid">
        <div>
          <strong>{com_policial}</strong>
          <span>Com policial</span>
        </div>

        <div>
          <strong>{no_cofre}</strong>
          <span>No cofre</span>
        </div>

        <div>
          <strong>{sem_localizacao}</strong>
          <span>Sem localização</span>
        </div>

        <div className={divergencias > 0 ? 'central-metrica-alerta' : ''}>
          <strong>{divergencias}</strong>
          <span>Divergências</span>
        </div>
      </div>
    </button>
  )
}