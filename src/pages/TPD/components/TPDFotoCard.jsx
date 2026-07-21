export default function TPDFotoCard({
  foto,
  disabled = false,
  onExcluir,
  onDefinirPrincipal
}) {
  return (
    <article
      className={[
        'tpd-foto-card',
        foto.principal
          ? 'principal'
          : ''
      ].join(' ')}
    >
      <div className="tpd-foto-image-area">
        <img
          src={foto.url}
          alt={
            foto.nome_arquivo ||
            'Foto do TPD'
          }
          className="tpd-foto-image"
        />

        {foto.principal && (
          <span className="tpd-foto-principal-badge">
            Principal
          </span>
        )}
      </div>

      <div className="tpd-foto-card-body">
        <div className="tpd-foto-info">
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

        <div className="tpd-foto-actions">
          {!foto.principal && (
            <button
              type="button"
              className="tpd-foto-btn-principal"
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
            className="tpd-foto-btn-excluir"
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