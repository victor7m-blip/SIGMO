import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  diagnosticarBanco,
  resumirDiagnostico
} from '../../services/diagnosticoService'

import {
  registerAudit
} from '../../services/auditoriaService'

import './Diagnostico.css'

function formatarDataHora(
  valor
) {
  if (!valor) {
    return 'Ainda não executado'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle:
        'short',

      timeStyle:
        'medium'
    }
  ).format(valor)
}

function formatarPadrao(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 'Sem valor padrão'
  }

  return String(valor)
}

function formatarTipo(
  coluna
) {
  if (
    coluna.tipoBanco &&
    coluna.tipoBanco !==
      coluna.tipo
  ) {
    return (
      `${coluna.tipo} ` +
      `(${coluna.tipoBanco})`
    )
  }

  return coluna.tipo
}

function obterNomeUsuario(
  user
) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.re ||
    'SIGMO'
  )
}

function CartaoResumo({
  titulo,
  valor,
  detalhe,
  status = ''
}) {
  return (
    <article
      className={[
        'diagnostico-resumo-card',
        status
          ? `diagnostico-resumo-${status}`
          : ''
      ].join(' ')}
    >
      <span>
        {titulo}
      </span>

      <strong>
        {valor}
      </strong>

      <small>
        {detalhe}
      </small>
    </article>
  )
}

function TabelaDiagnostico({
  item,
  aberta,
  onToggle
}) {
  return (
    <article
      className={[
        'diagnostico-tabela-card',
        item.existe
          ? 'diagnostico-tabela-ok'
          : 'diagnostico-tabela-falha'
      ].join(' ')}
    >
      <button
        type="button"
        className="diagnostico-tabela-header"
        onClick={
          onToggle
        }
      >
        <div className="diagnostico-tabela-identificacao">
          <span
            className={
              item.existe
                ? 'diagnostico-status-dot ok'
                : 'diagnostico-status-dot erro'
            }
          />

          <div>
            <strong>
              {item.tabela}
            </strong>

            <small>
              {item.existe
                ? `${item.totalColunas} colunas encontradas`
                : 'Tabela não localizada'}
            </small>
          </div>
        </div>

        <div className="diagnostico-tabela-acoes">
          <span
            className={
              item.existe
                ? 'diagnostico-status-label ok'
                : 'diagnostico-status-label erro'
            }
          >
            {item.existe
              ? 'Disponível'
              : 'Ausente'}
          </span>

          <span
            className={
              aberta
                ? 'diagnostico-chevron aberto'
                : 'diagnostico-chevron'
            }
          >
           ⌄
          </span>
        </div>
      </button>

      {aberta && (
        <div className="diagnostico-tabela-conteudo">
          {!item.existe ? (
            <div className="diagnostico-feedback diagnostico-feedback-erro">
              Essa tabela não foi encontrada no schema público.
            </div>
          ) : item.colunas.length === 0 ? (
            <div className="diagnostico-feedback">
              Nenhuma coluna foi retornada.
            </div>
          ) : (
            <div className="diagnostico-colunas-wrap">
              <table className="diagnostico-colunas">
                <thead>
                  <tr>
                    <th>
                      #
                    </th>

                    <th>
                      Coluna
                    </th>

                    <th>
                      Tipo
                    </th>

                    <th>
                      Aceita nulo
                    </th>

                    <th>
                      Valor padrão
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {item.colunas.map(
                    (coluna) => (
                      <tr
                        key={
                          `${item.tabela}-${coluna.nome}`
                        }
                      >
                        <td>
                          {coluna.posicao}
                        </td>

                        <td>
                          <code>
                            {coluna.nome}
                          </code>
                        </td>

                        <td>
                          {formatarTipo(
                            coluna
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              coluna.aceitaNulo
                                ? 'diagnostico-null sim'
                                : 'diagnostico-null nao'
                            }
                          >
                            {coluna.aceitaNulo
                              ? 'Sim'
                              : 'Não'}
                          </span>
                        </td>

                        <td>
                          <code>
                            {formatarPadrao(
                              coluna.padrao
                            )}
                          </code>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

export default function Diagnostico({
  user
}) {
  const [
    tabelas,
    setTabelas
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    atualizadoEm,
    setAtualizadoEm
  ] = useState(null)

  const [
    tabelaAberta,
    setTabelaAberta
  ] = useState(
    'sigmo_solicitacoes_cadastro'
  )

  const resumo =
    useMemo(
      () =>
        resumirDiagnostico(
          tabelas
        ),
      [
        tabelas
      ]
    )

  useEffect(() => {
    executarDiagnostico()
  }, [])

  async function registrarAuditoriaSegura() {
    try {
      await registerAudit(
        'DIAGNOSTICO_BANCO',
        `${obterNomeUsuario(
          user
        )} executou o diagnóstico estrutural do banco do SIGMO.`,
        user,
        'Administração',
        'Informativo'
      )
    } catch (error) {
      console.error(
        'Erro ao registrar auditoria do diagnóstico:',
        error
      )
    }
  }

  async function executarDiagnostico() {
    try {
      setLoading(true)
      setErro('')

      const resultado =
        await diagnosticarBanco()

      setTabelas(
        resultado
      )

      setAtualizadoEm(
        new Date()
      )

      await registrarAuditoriaSegura()
    } catch (error) {
      console.error(
        'Erro ao executar diagnóstico:',
        error
      )

      setTabelas([])

      setErro(
        error?.message ||
        error?.details ||
        'Não foi possível executar o diagnóstico do banco.'
      )
    } finally {
      setLoading(false)
    }
  }

  function alternarTabela(
    nome
  ) {
    setTabelaAberta(
      (atual) =>
        atual === nome
          ? ''
          : nome
    )
  }

  return (
    <main className="page diagnostico-page">
      <header className="diagnostico-header">
        <div>
          <span className="diagnostico-kicker">
            ADMINISTRAÇÃO DO SIGMO
          </span>

          <h1>
            Diagnóstico do Sistema
          </h1>

          <p>
            Consulte a disponibilidade e a estrutura das principais tabelas do banco.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={
            executarDiagnostico
          }
          disabled={
            loading
          }
        >
          {loading
            ? 'Verificando...'
            : 'Verificar banco'}
        </button>
      </header>

      <section className="diagnostico-atualizacao">
        <span
          className={[
            'diagnostico-conexao-dot',
            erro
              ? 'erro'
              : 'ok'
          ].join(' ')}
        />

        <div>
          <strong>
            {erro
              ? 'Falha no diagnóstico'
              : loading
                ? 'Diagnóstico em andamento'
                : 'Diagnóstico concluído'}
          </strong>

          <span>
            Última verificação:{' '}
            {formatarDataHora(
              atualizadoEm
            )}
          </span>
        </div>
      </section>

      {erro && (
        <div className="diagnostico-feedback diagnostico-feedback-erro">
          {erro}
        </div>
      )}

      <section className="diagnostico-resumo">
        <CartaoResumo
          titulo="Tabelas verificadas"
          valor={
            resumo.total
          }
          detalhe="Estruturas monitoradas"
        />

        <CartaoResumo
          titulo="Disponíveis"
          valor={
            resumo.existentes
          }
          detalhe="Tabelas encontradas"
          status="ok"
        />

        <CartaoResumo
          titulo="Ausentes"
          valor={
            resumo.ausentes
          }
          detalhe="Tabelas não localizadas"
          status={
            resumo.ausentes > 0
              ? 'erro'
              : 'ok'
          }
        />

        <CartaoResumo
          titulo="Colunas"
          valor={
            resumo.totalColunas
          }
          detalhe="Campos identificados"
        />
      </section>

      <section className="panel diagnostico-panel">
        <div className="diagnostico-panel-header">
          <div>
            <span>
              ESTRUTURA DO BANCO
            </span>

            <h2>
              Tabelas monitoradas
            </h2>
          </div>

          <strong
            className={
              resumo.saudavel
                ? 'diagnostico-saude ok'
                : 'diagnostico-saude atencao'
            }
          >
            {loading
              ? 'VERIFICANDO'
              : resumo.saudavel
                ? 'ESTRUTURA DISPONÍVEL'
                : 'REQUER ATENÇÃO'}
          </strong>
        </div>

        {loading &&
          tabelas.length ===
            0 && (
            <div className="diagnostico-feedback">
              Consultando a estrutura do banco...
            </div>
          )}

        <div className="diagnostico-tabelas-lista">
          {tabelas.map(
            (item) => (
              <TabelaDiagnostico
                key={
                  item.tabela
                }
                item={
                  item
                }
                aberta={
                  tabelaAberta ===
                  item.tabela
                }
                onToggle={() =>
                  alternarTabela(
                    item.tabela
                  )
                }
              />
            )
          )}
        </div>
      </section>
    </main>
  )
}
