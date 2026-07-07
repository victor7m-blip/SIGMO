export default function ArmaFotoCard({
  foto,
  onExcluir,
  disabled = false
}) {
  return (
    <div className={`arma-foto-card ${foto.principal ? 'principal' : ''}`}>
      <img
        src={foto.url}
        alt="Foto da arma"
        loading="lazy"
      />

      <div className="arma-foto-acoes">
        {foto.principal && (
          <span className="foto-principal-badge">
            ⭐ Principal
          </span>
        )}

        <button
          type="button"
          className="btn-danger-small"
          onClick={() => onExcluir?.(foto)}
          disabled={disabled}
        >
          Excluir
        </button>
      </div>
    </div>
  )
}