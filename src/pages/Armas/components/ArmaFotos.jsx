import ArmaFotoCard from './ArmaFotoCard'
import './ArmaFotos.css'

const MAX_FOTOS = 5

export default function ArmaFotos({
  arma,
  fotos = [],
  uploading = false,
  onUpload,
  onExcluir,
  disabled = false
}) {
  function handleUpload(event) {
    const arquivos = Array.from(event.target.files || [])

    if (!arquivos.length) return

    if (!arma?.id) {
      event.target.value = ''
      return
    }

    if (fotos.length + arquivos.length > MAX_FOTOS) {
      alert(`Limite máximo de ${MAX_FOTOS} fotos por arma.`)
      event.target.value = ''
      return
    }

    arquivos.forEach((file) => {
      if (onUpload) onUpload(file)
    })

    event.target.value = ''
  }

  return (
    <section className="arma-fotos-box">
      <div className="arma-fotos-header">
        <div>
          <h3>Fotos da arma</h3>
          <p>
            Adicione até {MAX_FOTOS} fotos. A primeira foto cadastrada será a
            principal.
          </p>
        </div>

        <label
          className={`btn-secondary ${disabled || uploading || fotos.length >= MAX_FOTOS ? 'disabled' : ''}`}
        >
          {uploading ? 'Enviando...' : '+ Adicionar fotos'}

          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleUpload}
            disabled={disabled || uploading || fotos.length >= MAX_FOTOS}
          />
        </label>
      </div>

      {!arma?.id && (
        <div className="form-info">
          Salve a arma para liberar o envio de fotos.
        </div>
      )}

      <div className="arma-fotos-grid">
        {fotos.map((foto) => (
          <ArmaFotoCard
            key={foto.id}
            foto={foto}
            onExcluir={onExcluir}
            disabled={uploading}
          />
        ))}

        {fotos.length === 0 && (
          <div className="arma-fotos-empty">
            Nenhuma foto cadastrada.
          </div>
        )}
      </div>
    </section>
  )
}