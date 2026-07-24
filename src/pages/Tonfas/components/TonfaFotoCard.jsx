export default function TonfaFotoCard({ foto, disabled, onExcluir, onDefinirPrincipal }) {
  return (
    <article className={`tonfa-foto-card ${foto.principal ? 'principal' : ''}`}>
      <div className="tonfa-foto-image-area">
        <img className="tonfa-foto-image" src={foto.url} alt="Tonfa ou cassetete" />
        {foto.principal && <span className="tonfa-foto-principal-badge">Principal</span>}
      </div>
      <div className="tonfa-foto-card-body">
        <div className="tonfa-foto-info">
          <strong>{foto.nome_arquivo || 'Foto do patrimônio'}</strong>
          <span>{foto.created_by_nome || 'SIGMO'}</span>
        </div>
        <div className="tonfa-foto-actions">
          {!foto.principal && (
            <button type="button" className="tonfa-foto-btn-principal" disabled={disabled} onClick={() => onDefinirPrincipal(foto)}>
              Tornar principal
            </button>
          )}
          <button type="button" className="tonfa-foto-btn-excluir" disabled={disabled} onClick={() => onExcluir(foto)}>
            Excluir
          </button>
        </div>
      </div>
    </article>
  )
}
