export default function COPFotoCard({
  foto,
  disabled = false,
  onExcluir,
  onDefinirPrincipal
}) {
  const dataCadastro =
    foto.created_at || foto.criado_em

  return (
    <article
      className={[
        'cop-foto-card',
        foto.principal
          ? 'principal'
          : ''
      ].join(' ')}
    >
      <div className="cop-foto-image-area">
        <img
          src={foto.url}
          alt={
            foto.nome_arquivo ||
            'Foto da COP'
          }
          className="cop-foto-image"
        />

        {foto.principal && (
          <span className="cop-foto-principal-badge">
            Principal
          </span>
        )}
      </div>

      <div className="cop-foto-card-body">
        <div className="cop-foto-info">
          <strong>
            {foto.nome_arquivo ||
              'Foto da câmera'}
          </strong>

          {dataCadastro && (
            <span>
              {formatarDataHora(
                dataCadastro
              )}
            </span>
          )}
        </div>

        <div className="cop-foto-actions">
          {!foto.principal && (
            <button
              type="button"
              className="cop-foto-btn-principal"
              onClick={() =>
                onDefinirPrincipal?.(
                  foto
                )
              }
              disabled={disabled}
            >
              Definir principal
            </button>
          )}

          <button
            type="button"
            className="cop-foto-btn-excluir"
            onClick={() =>
              onExcluir?.(foto)
            }
            disabled={disabled}
          >
            {disabled
              ? 'Processando...'
              : 'Excluir'}
          </button>
        </div>
      </div>
    </article>
  )
}

function formatarDataHora(valor) {
  if (!valor) return ''

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(data)
}
