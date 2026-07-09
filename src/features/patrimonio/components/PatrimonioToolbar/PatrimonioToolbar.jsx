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
      <div className="patrimonio-search">
        <span>Buscar</span>
        <input
          value={busca}
          onChange={(event) => onBuscaChange?.(event.target.value)}
          placeholder="Patrimônio, série, marca, modelo..."
        />
      </div>

      <div className="patrimonio-toolbar-actions">
        {filtros.map((filtro) => (
          <button
            key={filtro.key}
            type="button"
            className={statusAtivo === filtro.key ? 'active' : ''}
            onClick={() => onStatusChange?.(filtro.key)}
          >
            {filtro.label}
          </button>
        ))}

        <button type="button" className="btn-secondary" onClick={onExportar}>
          Exportar
        </button>

        <button type="button" className="btn-primary" onClick={onNovo}>
          Novo cadastro
        </button>
      </div>
    </section>
  )
}