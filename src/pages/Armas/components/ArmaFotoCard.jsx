export default function ArmaFotoCard({
  foto,
  onExcluir,
  disabled = false,
  textoBotao = 'Excluir'
}) {
  return (
    <div className="arma-foto-card">
      <img
        src={foto.url}
        alt="Foto da arma"
        loading="lazy"
      />

      {onExcluir && (
        <button
          type="button"
          className="btn-danger-small"
          onClick={() => onExcluir(foto)}
          disabled={disabled}
          aria-label="Excluir foto"
        >
          {textoBotao}
        </button>
      )}
    </div>
  )
}