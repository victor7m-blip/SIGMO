export default function HTFotoCard({
  foto,
  disabled = false,
  onExcluir,
  onDefinirPrincipal
}) {
  return (
    <article
      className={[
        'ht-foto-card',
        foto.principal
          ? 'principal'
          : ''
      ].join(' ')}
    >
      <div className="ht-foto-image-area">
        <img
          src={foto.url}
          alt={
            foto.nome_arquivo ||
            'Foto do HT'
          }
          className="ht-foto-image"
        />

        {foto.principal && (
          <span className="ht-foto-principal-badge">
            Principal
          </span>
        )}
      </div>

      <div className="ht-foto-card-body">
        <div className="ht-foto-info">
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

        <div className="ht-foto-actions">
          {!foto.principal && (
            <button
              type="button"
              className="ht-foto-btn-principal"
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
            className="ht-foto-btn-excluir"
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