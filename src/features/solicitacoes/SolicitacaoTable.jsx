import StatusBadge from './components/StatusBadge'

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

function obterNome(item) {
  return (
    item?.policial_nome ||
    item?.policial?.nome_guerra ||
    item?.policial?.nome ||
    item?.solicitante_nome ||
    'POLICIAL'
  )
}

function obterRE(item) {
  return (
    item?.policial_re ||
    item?.policial?.re ||
    '---'
  )
}

function obterPosto(item) {
  return (
    item?.posto_graduacao ||
    item?.policial?.posto_graduacao ||
    ''
  )
}

function quantidadeAlteracoes(item) {
  if (
    Array.isArray(item?.alteracoes)
  ) {
    return item.alteracoes.length
  }

  if (
    item?.dados_novos &&
    typeof item.dados_novos ===
      'object'
  ) {
    return Object.keys(
      item.dados_novos
    ).length
  }

  return 0
}

export default function SolicitacaoTable({
  loading,
  solicitacoes,
  pagina,
  totalPaginas,
  onPagina,
  onVisualizar
}) {
  return (
    <>
      <div className="solicitacoes-table-wrap">
        <table className="solicitacoes-table">

          <thead>

            <tr>

              <th>
                Policial
              </th>

              <th>
                RE
              </th>

              <th>
                Tipo
              </th>

              <th>
                Data
              </th>

              <th>
                Alterações
              </th>

              <th>
                Status
              </th>

              <th>
                Ações
              </th>

            </tr>

          </thead>

          <tbody>

            {solicitacoes.map(
              (
                solicitacao
              ) => {

                const quantidade =
                  quantidadeAlteracoes(
                    solicitacao
                  )

                return (

                  <tr
                    key={
                      solicitacao.id
                    }
                  >

                    <td>

                      <strong>
                        {obterNome(
                          solicitacao
                        )}
                      </strong>

                      <span>
                        {obterPosto(
                          solicitacao
                        )}
                      </span>

                    </td>

                    <td>

                      {obterRE(
                        solicitacao
                      )}

                    </td>

                    <td>

                      {solicitacao.tipo}

                    </td>

                    <td>

                      {formatarDataHora(
                        solicitacao.created_at ||
                        solicitacao.criado_em
                      )}

                    </td>

                    <td>

                      {quantidade}{' '}

                      {quantidade === 1
                        ? 'campo'
                        : 'campos'}

                    </td>

                    <td>

                      <StatusBadge
                        status={
                          solicitacao.status
                        }
                      />

                    </td>

                    <td>

                      <button
                        type="button"
                        className="solicitacao-btn-visualizar"
                        onClick={() =>
                          onVisualizar(
                            solicitacao
                          )
                        }
                      >
                        Visualizar
                      </button>

                    </td>

                  </tr>

                )

              }
            )}

            {!loading &&
              solicitacoes.length ===
                0 && (

              <tr>

                <td
                  colSpan={7}
                >

                  <div className="solicitacao-feedback">

                    Nenhuma solicitação encontrada.

                  </div>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>
            <div className="solicitacoes-pagination">

        <button
          type="button"
          disabled={
            pagina <= 1 ||
            loading
          }
          onClick={() =>
            onPagina(
              Math.max(
                pagina - 1,
                1
              )
            )
          }
        >
          Anterior
        </button>

        <span>

          Página {pagina} de{' '}

          {totalPaginas}

        </span>

        <button
          type="button"
          disabled={
            pagina >=
              totalPaginas ||
            loading
          }
          onClick={() =>
            onPagina(
              Math.min(
                pagina + 1,
                totalPaginas
              )
            )
          }
        >
          Próxima
        </button>

      </div>

    </>
  )
}