export default function PolicialFotoCard({
  foto,
  selecionada = false,
  onSelecionar,
  onDefinirPrincipal,
  onExcluir,
  disabled = false
}) {
  return (
    <div className={`policial-foto-card ${selecionada ? 'selecionada' : ''}`}>
      <button
        type="button"
        className="policial-foto-preview"
        onClick={() => onSelecionar?.(foto)}
        disabled={disabled}
        title="Visualizar foto"
      >
        <img
          src={foto.url}
          alt="Foto do policial"
          loading="lazy"
        />
      </button>

      {foto.principal && (
        <span className="foto-principal-badge">
          Principal
        </span>
      )}

      <div className="policial-foto-actions">
        {!foto.principal && (
          <button
            type="button"
            onClick={() => onDefinirPrincipal?.(foto)}
            disabled={disabled}
          >
            Definir principal
          </button>
        )}

        {onExcluir && (
          <button
            type="button"
            className="btn-danger-small"
            onClick={() => onExcluir(foto)}
            disabled={disabled}
          >
            Excluir
          </button>
        )}
      </div>
    </div>
  )
}