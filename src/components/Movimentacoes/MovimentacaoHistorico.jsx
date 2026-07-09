import './MovimentacaoHistorico.css'

export default function MovimentacaoHistorico({
  historico = []
}) {
  if (historico.length === 0) {
    return (
      <div className="mov-historico-vazio">
        Nenhuma movimentação registrada.
      </div>
    )
  }

  return (
    <section className="mov-historico">

      {historico.map(item => (

        <article
          key={item.id}
          className="mov-historico-card"
        >

          <header>

            <strong>
              {item.tipo_movimentacao}
            </strong>

            <span>
              {new Date(item.created_at).toLocaleString('pt-BR')}
            </span>

          </header>

          <div className="mov-historico-grid">

            <div>

              <small>Origem</small>

              <strong>
                {item.origem_local || '-'}
              </strong>

            </div>

            <div>

              <small>Destino</small>

              <strong>
                {item.destino_local || '-'}
              </strong>

            </div>

            <div>

              <small>Status</small>

              <strong>
                {item.status}
              </strong>

            </div>

            <div>

              <small>Solicitante</small>

              <strong>
                {item.solicitante_nome}
              </strong>

            </div>

            <div>

              <small>Recebedor</small>

              <strong>
                {item.recebedor_nome}
              </strong>

            </div>

          </div>

          {item.observacoes && (

            <div className="mov-historico-observacao">

              {item.observacoes}

            </div>

          )}

        </article>

      ))}

    </section>
  )
}