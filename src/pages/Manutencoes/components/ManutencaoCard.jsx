function dataHora(valor) {
  if (!valor) return 'Não informado'

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Não informado'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function statusLabel(status) {
  const labels = {
    EM_MANUTENCAO: 'Em manutenção',
    CONCLUIDA: 'Concluída',
    CANCELADA: 'Cancelada'
  }

  return labels[status] || status || 'Não informado'
}

function textoOcorrencia(valor) {
  const texto = String(valor || '')
    .trim()
    .replaceAll('_', ' ')

  return texto || 'OCORRÊNCIA NÃO INFORMADA'
}

export default function ManutencaoCard({
  manutencao,
  onAbrir
}) {
  const responsavel =
    manutencao.policial_nome ||
    manutencao.registrada_por_nome ||
    'Não informado'

  const descricao =
    manutencao.descricao ||
    'Sem descrição registrada.'

  return (
    <button
      type="button"
      className="manutencao-card"
      onClick={() => onAbrir(manutencao)}
    >
      <div className="manutencao-card-foto">
        {manutencao.foto_url ? (
          <img
            src={manutencao.foto_url}
            alt={`Registro de manutenção de ${
              manutencao.tipo_material || 'material'
            }`}
          />
        ) : (
          <span aria-hidden="true">🔧</span>
        )}
      </div>

      <div className="manutencao-card-conteudo">
        <div className="manutencao-card-topo">
          <div>
            <span>
              {manutencao.modulo || 'OUTROS'}
            </span>

            <h3>
              {manutencao.tipo_material || 'Material'}
            </h3>
          </div>

          <span
            className={`manutencao-status manutencao-status-${String(
              manutencao.status || ''
            ).toLowerCase()}`}
          >
            {statusLabel(manutencao.status)}
          </span>
        </div>

        <div className="manutencao-card-ocorrencia">
          <strong>
            {textoOcorrencia(manutencao.tipo_novidade)}
          </strong>

          <p>
            {descricao}
          </p>
        </div>

        <dl>
          <div>
            <dt>Responsável</dt>
            <dd>{responsavel}</dd>
          </div>

          <div>
            <dt>Data</dt>
            <dd>
              {dataHora(
                manutencao.registrada_em ||
                manutencao.created_at
              )}
            </dd>
          </div>

          <div>
            <dt>Quantidade</dt>
            <dd>{manutencao.quantidade || 1}</dd>
          </div>
        </dl>
      </div>
    </button>
  )
}
