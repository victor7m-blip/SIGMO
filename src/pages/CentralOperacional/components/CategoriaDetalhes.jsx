import StatusOperacionalBadge from './StatusOperacionalBadge'
import ResponsabilidadeTable from './ResponsabilidadeTable'

function obterStatusOperacional(item) {
  if (item.com_policial) {
    return 'COM POLICIAL'
  }

  if (item.no_cofre) {
    return 'NO COFRE'
  }

  return 'SEM LOCALIZAÇÃO'
}

export default function CategoriaDetalhes({
  categoria,
  patrimonios = [],
  responsaveis = [],
  carregando = false,
  onVoltar,
  onAbrirConferencia,
  onSelecionarPatrimonio,
  onSelecionarResponsavel
}) {
  if (!categoria) {
    return null
  }

  return (
    <section className="central-detalhes">
      <header className="central-section-header central-detalhes-header">
        <div>
          <button
            type="button"
            className="central-link-button"
            onClick={onVoltar}
          >
            ← Voltar às categorias
          </button>

          <span className="central-section-eyebrow">
            Central Operacional
          </span>

          <h2>{categoria.categoria}</h2>

          <p>
            Responsabilidades, localização e situação operacional desta
            categoria.
          </p>
        </div>

        <button
          type="button"
          className="central-button central-button-primary"
          onClick={onAbrirConferencia}
        >
          Iniciar conferência
        </button>
      </header>

      <div className="central-detalhes-metricas">
        <div>
          <span>Total</span>
          <strong>{categoria.total ?? 0}</strong>
        </div>

        <div>
          <span>Com policial</span>
          <strong>{categoria.com_policial ?? 0}</strong>
        </div>

        <div>
          <span>No cofre</span>
          <strong>{categoria.no_cofre ?? 0}</strong>
        </div>

        <div>
          <span>Sem localização</span>
          <strong>{categoria.sem_localizacao ?? 0}</strong>
        </div>

        <div>
          <span>Divergências</span>
          <strong>{categoria.divergencias ?? 0}</strong>
        </div>
      </div>

      {carregando ? (
        <div className="central-loading">Carregando categoria...</div>
      ) : (
        <>
          <section className="central-panel">
            <div className="central-panel-header">
              <div>
                <span className="central-section-eyebrow">
                  Responsabilidade
                </span>

                <h3>Policiais com patrimônio</h3>
              </div>

              <span className="central-count">
                {responsaveis.length} responsáveis
              </span>
            </div>

            <ResponsabilidadeTable
              responsaveis={responsaveis}
              onSelecionar={onSelecionarResponsavel}
            />
          </section>

          <section className="central-panel">
            <div className="central-panel-header">
              <div>
                <span className="central-section-eyebrow">Patrimônios</span>
                <h3>Relação completa</h3>
              </div>

              <span className="central-count">
                {patrimonios.length} itens
              </span>
            </div>

            {patrimonios.length === 0 ? (
              <div className="central-empty">
                Nenhum patrimônio localizado nesta categoria.
              </div>
            ) : (
              <div className="central-table-wrapper">
                <table className="central-table">
                  <thead>
                    <tr>
                      <th>Patrimônio</th>
                      <th>Status</th>
                      <th>RE</th>
                      <th>Responsável</th>
                      <th>Local</th>
                    </tr>
                  </thead>

                  <tbody>
                    {patrimonios.map((item) => (
                      <tr
                        key={item.id}
                        className="central-table-row-clickable"
                        onClick={() => onSelecionarPatrimonio?.(item)}
                      >
                        <td data-label="Patrimônio">
                          <strong>{item.identificador}</strong>
                        </td>

                        <td data-label="Status">
                          <StatusOperacionalBadge
                            status={obterStatusOperacional(item)}
                          />
                        </td>

                        <td data-label="RE">
                          {item.responsavel_re || '—'}
                        </td>

                        <td data-label="Responsável">
                          {item.responsavel_nome || '—'}
                        </td>

                        <td data-label="Local">
                          {item.local_atual || 'NÃO INFORMADO'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}