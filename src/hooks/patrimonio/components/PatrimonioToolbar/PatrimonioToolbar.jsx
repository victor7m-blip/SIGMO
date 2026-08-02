import './PatrimonioToolbar.css'

export default function PatrimonioToolbar({
  busca = '',
  onBuscaChange,
  statusAtivo = 'todos',
  onStatusChange,
  onNovo,
  onExportar,
}) {
  const filtros = [
    { key: 'todos', label: 'Todos' },
    { key: 'ativo', label: 'Ativos' },
    { key: 'cautelado', label: 'Cautelados' },
    { key: 'manutencao', label: 'Manutenção' },
  ]

  return (
    <section className="patrimonio-toolbar">
      <div className="patrimonio-toolbar-top">
        <label className="patrimonio-search">
          <span>Buscar</span>

          <input
            type="search"
            value={busca}
            onChange={(event) =>
              onBuscaChange?.(event.target.value)
            }
            placeholder="Pesquise por patrimônio, descrição, série, marca, modelo, local ou status"
            autoComplete="off"
          />
        </label>

        <div className="patrimonio-toolbar-main-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onExportar}
          >
            Exportar
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onNovo}
          >
            Novo cadastro
          </button>
        </div>
      </div>

      <div className="patrimonio-toolbar-bottom">
        <span className="patrimonio-filter-label">
          Filtrar por situação
        </span>

        <div className="patrimonio-status-filters">
          {filtros.map((filtro) => (
            <button
              key={filtro.key}
              type="button"
              className={
                statusAtivo === filtro.key
                  ? 'active'
                  : ''
              }
              onClick={() =>
                onStatusChange?.(filtro.key)
              }
            >
              {filtro.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}