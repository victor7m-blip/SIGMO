export default function PatrimonioFotosStep({
  itemSalvo,
  fotos = [],
  onAdicionarFoto,
  onRemoverFoto,
  onVoltar,
  onAvancar
}) {
  return (
    <div className="patrimonio-card">
      {!itemSalvo && (
        <div className="form-alert">
          Salve os dados do patrimônio antes de enviar fotos.
        </div>
      )}

      <div className="foto-upload-box">
        <label>
          Adicionar fotos
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={!itemSalvo}
            onChange={(event) => onAdicionarFoto?.(event.target.files)}
          />
        </label>
      </div>

      <div className="patrimonio-fotos-grid">
        {fotos.length === 0 && (
          <p className="empty-message">Nenhuma foto adicionada.</p>
        )}

        {fotos.map((foto, index) => (
          <div className="patrimonio-foto" key={foto.id || foto.url || index}>
            <img src={foto.url || foto.preview} alt={`Foto ${index + 1}`} />

            {onRemoverFoto && (
              <button
                type="button"
                onClick={() => onRemoverFoto(foto)}
              >
                Remover
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="patrimonio-actions between">
        <button type="button" className="btn-secondary" onClick={onVoltar}>
          Voltar
        </button>

        <button type="button" className="btn-primary" onClick={onAvancar}>
          Seguinte
        </button>
      </div>
    </div>
  )
}