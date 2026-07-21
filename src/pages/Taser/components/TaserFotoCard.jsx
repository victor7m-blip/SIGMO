export default function TaserFotoCard({
  foto,
  disabled = false,
  onExcluir,
  onDefinirPrincipal
}) {
  return (
    <article
      className={[
        'taser-foto-card',
        foto.principal
          ? 'principal'
          : ''
      ].join(' ')}
    >
      <div className="taser-foto-image-area">
        <img
          src={foto.url}
          alt={
            foto.nome_arquivo ||
            'Foto do Taser'
          }
          className="taser-foto-image"
        />

        {foto.principal && (
          <span className="taser-foto-principal-badge">
            Principal
          </span>
        )}
      </div>

      <div className="taser-foto-card-body">
        <div className="taser-foto-info">
          <strong>
            {foto.nome_arquivo ||
              'Foto do equipamento'}
          </strong>

          {foto.criado_em && (
            <span>
              {formatarDataHora(
                foto.criado_em
              )}
            </span>
          )}
        </div>

        <div className="taser-foto-actions">
          {!foto.principal && (
            <button
              type="button"
              className="taser-foto-btn-principal"
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
            className="taser-foto-btn-excluir"
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

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
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