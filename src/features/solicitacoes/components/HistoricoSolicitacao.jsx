function formatarDataHora(valor) {
  if (!valor) {
    return 'Não informado'
  }

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return 'Não informado'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(data)
}

function obterIcone(tipo) {
  switch (String(tipo).toUpperCase()) {
    case 'CRIADA':
      return '📝'

    case 'APROVADA':
      return '✅'

    case 'REPROVADA':
      return '❌'

    case 'CANCELADA':
      return '🚫'

    case 'ALTERADA':
      return '✏️'

    case 'NOTIFICACAO':
      return '🔔'

    case 'AUDITORIA':
      return '📋'

    default:
      return '•'
  }
}

function obterClasse(tipo) {
  switch (String(tipo).toUpperCase()) {
    case 'APROVADA':
      return 'historico-item historico-sucesso'

    case 'REPROVADA':
      return 'historico-item historico-erro'

    case 'CANCELADA':
      return 'historico-item historico-cancelado'

    default:
      return 'historico-item'
  }
}

export default function HistoricoSolicitacao({
  historico = []
}) {

  if (historico.length === 0) {

    return (

      <div className="solicitacao-feedback">

        Nenhum histórico disponível.

      </div>

    )

  }

  return (

    <section className="historico-solicitacao">

      <h3>

        Histórico da Solicitação

      </h3>

      <div className="historico-lista">

        {historico.map((item, index) => (

          <article
            key={
              item.id ||
              index
            }
            className={obterClasse(item.tipo)}
          >

            <div className="historico-icone">

              {obterIcone(item.tipo)}

            </div>

            <div className="historico-conteudo">

              <strong>

                {item.titulo}

              </strong>

              <p>

                {item.descricao}

              </p>

              <small>

                {formatarDataHora(
                  item.created_at ||
                  item.data
                )}

              </small>

            </div>
                        <div className="historico-autor">

              <span>

                {item.usuario_nome ||
                 item.responsavel_nome ||
                 item.policial_nome ||
                 'Sistema'}

              </span>

            </div>

          </article>

        ))}

      </div>

    </section>

  )
}