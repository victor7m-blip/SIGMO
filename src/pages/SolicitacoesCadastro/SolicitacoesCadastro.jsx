import {
  useMemo
} from 'react'

import useSolicitacoes from '../../features/solicitacoes/hooks/useSolicitacoes'

import SolicitacaoTable from '../../features/solicitacoes/components/SolicitacaoTable'
import SolicitacaoModal from '../../features/solicitacoes/components/SolicitacaoModal'
import HistoricoSolicitacao from '../../features/solicitacoes/components/HistoricoSolicitacao'
import FiltrosSolicitacao from '../../features/solicitacoes/components/FiltrosSolicitacao'

import {
  registerAudit
} from '../../services/auditoriaService'

import {
  podeAprovarAlteracaoPolicial
} from '../../services/permissionService'

import './SolicitacoesCadastro.css'

import {
  registerAudit
} from '../../services/auditoriaService'

import {
  podeAprovarAlteracaoPolicial
} from '../../services/permissionService'

import './SolicitacoesCadastro.css'

const LIMITE_POR_PAGINA = 20

const CAMPOS = {
  nome: 'Nome completo',
  nome_guerra: 'Nome de guerra',
  re: 'RE',
  posto_graduacao: 'Posto/Graduação',
  companhia: 'Companhia',
  pelotao: 'Pelotão',
  equipe: 'Equipe',
  funcao: 'Função',
  telefone: 'Telefone',
  email: 'E-mail',
  cpf: 'CPF',
  rg: 'RG',
  perfil: 'Perfil',
  situacao: 'Situação',
  observacoes: 'Observações',
  foto_url: 'Foto',
  qr_code: 'QR Code'
}

const STATUS = [
  {
    value: 'PENDENTE',
    label: 'Pendentes'
  },
  {
    value: 'APROVADO',
    label: 'Aprovadas'
  },
  {
    value: 'REPROVADO',
    label: 'Reprovadas'
  },
  {
    value: 'CANCELADO',
    label: 'Canceladas'
  },
  {
    value: '',
    label: 'Todas'
  }
]

function texto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 'NÃO INFORMADO'
  }

  if (
    typeof valor === 'object'
  ) {
    try {
      return JSON.stringify(valor)
    } catch {
      return String(valor)
    }
  }

  return String(valor)
}

function formatarDataHora(valor) {
  if (!valor) {
    return 'Não informado'
  }

  const data = new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
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

function obterNomePolicial(
  solicitacao
) {
  return (
    solicitacao?.policial
      ?.nome_guerra ||
    solicitacao?.policial
      ?.nome ||
    solicitacao?.dados_novos
      ?.nome_guerra ||
    solicitacao?.dados_novos
      ?.nome ||
    'POLICIAL'
  )
}

function obterIdentificacao(
  solicitacao
) {
  const policial =
    solicitacao?.policial || {}

  const posto =
    policial.posto_graduacao ||
    solicitacao?.dados_novos
      ?.posto_graduacao ||
    ''

  const nome =
    obterNomePolicial(
      solicitacao
    )

  const re =
    policial.re ||
    solicitacao?.dados_novos
      ?.re ||
    ''

  return [
    posto,
    nome,
    re
      ? `RE ${re}`
      : ''
  ]
    .filter(Boolean)
    .join(' • ')
}

function obterNomeUsuario(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.re ||
    'SIGMO'
  )
}

function obterIdUsuario(user) {
  return (
    user?.policial_id ||
    user?.id_policial ||
    user?.id ||
    null
  )
}

function classeStatus(status) {
  const chave =
    String(status || '')
      .toUpperCase()

  if (chave === 'APROVADO') {
    return 'aprovado'
  }

  if (chave === 'REPROVADO') {
    return 'reprovado'
  }

  if (chave === 'CANCELADO') {
    return 'cancelado'
  }

  return 'pendente'
}

function labelStatus(status) {
  const chave =
    String(status || '')
      .toUpperCase()

  const nomes = {
    PENDENTE: 'Pendente',
    APROVADO: 'Aprovada',
    REPROVADO: 'Reprovada',
    CANCELADO: 'Cancelada'
  }

  return (
    nomes[chave] ||
    chave ||
    'Pendente'
  )
}

function montarAlteracoes(
  solicitacao
) {
  const anteriores =
    solicitacao
      ?.dados_anteriores || {}

  const novos =
    solicitacao
      ?.dados_novos || {}

  return Object
    .keys(novos)
    .map(
      (campo) => ({
        campo,
        label:
          CAMPOS[campo] ||
          campo
            .replace(/_/g, ' ')
            .replace(
              /(^|\s)\S/g,
              (letra) =>
                letra.toUpperCase()
            ),

        anterior:
          anteriores[campo],

        novo:
          novos[campo]
      })
    )
}

function SolicitacaoModal({
  solicitacao,
  user,
  processando,
  erro,
  onClose,
  onAprovar,
  onReprovar
}) {
  const [
    modoReprovacao,
    setModoReprovacao
  ] = useState(false)

  const [
    observacao,
    setObservacao
  ] = useState('')

  const alteracoes =
    useMemo(
      () =>
        montarAlteracoes(
          solicitacao
        ),
      [
        solicitacao
      ]
    )

  const pendente =
    solicitacao?.status ===
    'PENDENTE'

  const podeAnalisar =
    pendente &&
    podeAprovarAlteracaoPolicial(
      user
    )

  function confirmarReprovacao() {
    if (
      !observacao.trim()
    ) {
      return
    }

    onReprovar(
      observacao.trim()
    )
  }

  if (!solicitacao) {
    return null
  }

  return (
    <div className="solicitacao-modal-overlay">
      <section className="solicitacao-modal">
        <header className="solicitacao-modal-header">
          <div>
            <span>
              SOLICITAÇÃO CADASTRAL
            </span>

            <h2>
              {obterIdentificacao(
                solicitacao
              )}
            </h2>

            <p>
              Solicitada em{' '}
              {formatarDataHora(
                solicitacao.criado_em
              )}
            </p>
          </div>

          <button
            type="button"
            className="solicitacao-modal-close"
            onClick={
              onClose
            }
            disabled={
              processando
            }
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="solicitacao-modal-status-row">
          <span
            className={
              `solicitacao-status ` +
              `solicitacao-status-${classeStatus(
                solicitacao.status
              )}`
            }
          >
            {labelStatus(
              solicitacao.status
            )}
          </span>

          <span>
            Solicitante:{' '}
            <strong>
              {solicitacao
                ?.solicitante
                ?.nome_guerra ||
                solicitacao
                  ?.solicitante
                  ?.nome ||
                obterNomePolicial(
                  solicitacao
                )}
            </strong>
          </span>
        </div>

        {alteracoes.length === 0 ? (
          <div className="solicitacao-feedback">
            Nenhuma alteração foi encontrada.
          </div>
        ) : (
          <div className="solicitacao-comparacoes">
            {alteracoes.map(
              (alteracao) => (
                <article
                  key={
                    alteracao.campo
                  }
                  className="solicitacao-comparacao"
                >
                  <h3>
                    {alteracao.label}
                  </h3>

                  <div className="solicitacao-valores">
                    <div className="solicitacao-valor solicitacao-valor-anterior">
                      <span>
                        ANTES
                      </span>

                      <strong>
                        {texto(
                          alteracao.anterior
                        )}
                      </strong>
                    </div>

                    <div
                      className="solicitacao-seta"
                      aria-hidden="true"
                    >
                      →
                    </div>

                    <div className="solicitacao-valor solicitacao-valor-novo">
                      <span>
                        DEPOIS
                      </span>

                      <strong>
                        {texto(
                          alteracao.novo
                        )}
                      </strong>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}

        {solicitacao
          .observacao_solicitante && (
          <div className="solicitacao-observacao">
            <span>
              OBSERVAÇÃO DO SOLICITANTE
            </span>

            <p>
              {
                solicitacao
                  .observacao_solicitante
              }
            </p>
          </div>
        )}

        {solicitacao
          .observacao_analise && (
          <div className="solicitacao-observacao">
            <span>
              OBSERVAÇÃO DA ANÁLISE
            </span>

            <p>
              {
                solicitacao
                  .observacao_analise
              }
            </p>
          </div>
        )}

        {erro && (
          <div className="solicitacao-feedback solicitacao-feedback-error">
            {erro}
          </div>
        )}

        {modoReprovacao && (
          <div className="solicitacao-reprovacao">
            <label>
              Motivo da reprovação

              <textarea
                value={
                  observacao
                }
                onChange={
                  (event) =>
                    setObservacao(
                      event.target.value
                    )
                }
                rows={4}
                placeholder="Informe o motivo da reprovação."
                disabled={
                  processando
                }
              />
            </label>
          </div>
        )}

        <footer className="solicitacao-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={
              onClose
            }
            disabled={
              processando
            }
          >
            Fechar
          </button>

          {podeAnalisar &&
            !modoReprovacao && (
              <>
                <button
                  type="button"
                  className="solicitacao-btn-reprovar"
                  onClick={() =>
                    setModoReprovacao(
                      true
                    )
                  }
                  disabled={
                    processando
                  }
                >
                  Reprovar
                </button>

                <button
                  type="button"
                  className="solicitacao-btn-aprovar"
                  onClick={
                    onAprovar
                  }
                  disabled={
                    processando
                  }
                >
                  {processando
                    ? 'Processando...'
                    : 'Aprovar alteração'}
                </button>
              </>
            )}

          {podeAnalisar &&
            modoReprovacao && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setModoReprovacao(
                      false
                    )

                    setObservacao('')
                  }}
                  disabled={
                    processando
                  }
                >
                  Voltar
                </button>

                <button
                  type="button"
                  className="solicitacao-btn-reprovar"
                  onClick={
                    confirmarReprovacao
                  }
                  disabled={
                    processando ||
                    !observacao.trim()
                  }
                >
                  {processando
                    ? 'Processando...'
                    : 'Confirmar reprovação'}
                </button>
              </>
            )}
        </footer>
      </section>
    </div>
  )
}

export default function SolicitacoesCadastro({
  user
}) {
  const {
  loading,

  erro,

  sucesso,

  solicitacoes,

  selecionada,

  filtros,

  paginacao,

  totalPaginas,

  atualizarFiltros,

  alterarPagina,

  selecionar,

  limparSelecao,

  aprovar,

  reprovar,

  carregarSolicitacoes

} = useSolicitacoes({
  status: 'PENDENTE'
})

    
  async function registrarAuditoriaSegura({
    acao,
    descricao,
    severidade = 'Informativo'
  }) {
    try {
      await registerAudit(
        acao,
        descricao,
        user,
        'Policiais',
        severidade
      )
    } catch (error) {
      console.error(
        'Erro ao registrar auditoria:',
        error
      )
    }
  }

  async function handleAprovar() {

  if (!selecionada?.id) {
    return
  }

  try {

    await aprovar(
      selecionada.id
    )

    await registerAudit(
      'SOLICITACAO_APROVADA',
      `${obterNomeUsuario(user)} aprovou a solicitação ${selecionada.protocolo}.`,
      user,
      'Solicitações'
    )

    limparSelecao()

  } catch (error) {

    console.error(error)

  }

}

  async function handleReprovar(
  motivo
) {

  if (!selecionada?.id) {
    return
  }

  try {

    await reprovar(
      selecionada.id,
      {
        motivo
      }
    )

    await registerAudit(
      'SOLICITACAO_REPROVADA',
      `${obterNomeUsuario(user)} reprovou a solicitação ${selecionada.protocolo}.`,
      user,
      'Solicitações',
      'Atenção'
    )

    limparSelecao()

  } catch (error) {

    console.error(error)

  }

}

  function alterarStatus(
  status
) {

  atualizarFiltros({
    status
  })

}

  return (
    <main className="page solicitacoes-page">
      <header className="solicitacoes-header">
        <div>
          <span className="solicitacoes-kicker">
            SIGMO
          </span>

          <h1>
            Solicitações Cadastrais
          </h1>

          <p>
            Analise e decida sobre alterações solicitadas pelos policiais.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={
            carregarSolicitacoes
          }
          disabled={
            loading
          }
        >
          {loading
            ? 'Atualizando...'
            : 'Atualizar'}
        </button>
      </header>

      <section className="solicitacoes-resumo">
        <div>
          <span>
            RESULTADOS
          </span>

          <strong>
            {total}
          </strong>

          <small>
            solicitações encontradas
          </small>
        </div>

        <div>
          <span>
            FILTRO ATUAL
          </span>

          <strong>
            {STATUS.find(
              (item) =>
                item.value ===
                status
            )?.label || 'Todas'}
          </strong>

          <small>
            situação selecionada
          </small>
        </div>
      </section>

      <section className="panel solicitacoes-panel">
        <div className="solicitacoes-filtros">
          {STATUS.map(
            (item) => (
              <button
                type="button"
                key={
                  item.value ||
                  'TODAS'
                }
                className={
                  status ===
                  item.value
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  alterarStatus(
                    item.value
                  )
                }
              >
                {item.label}
              </button>
            )
          )}
        </div>

        {sucesso && (
          <div className="solicitacao-feedback solicitacao-feedback-success">
            {sucesso}
          </div>
        )}

        {erro && (
          <div className="solicitacao-feedback solicitacao-feedback-error">
            {erro}
          </div>
        )}

        {loading &&
          solicitacoes.length ===
            0 && (
            <div className="solicitacao-feedback">
              Carregando solicitações...
            </div>
          )}

        {!loading &&
          !erro &&
          solicitacoes.length ===
            0 && (
            <div className="solicitacao-feedback">
              Nenhuma solicitação encontrada para este filtro.
            </div>
          )}

        {solicitacoes.length >
          0 && (
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
                    Solicitado em
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
                      Object.keys(
                        solicitacao
                          .dados_novos ||
                          {}
                      ).length

                    return (
                      <tr
                        key={
                          solicitacao.id
                        }
                      >
                        <td>
                          <strong>
                            {solicitacao
                              ?.policial
                              ?.nome_guerra ||
                              solicitacao
                                ?.policial
                                ?.nome ||
                              'POLICIAL'}
                          </strong>

                          <span>
                            {solicitacao
                              ?.policial
                              ?.posto_graduacao ||
                              'POSTO NÃO INFORMADO'}
                          </span>
                        </td>

                        <td>
                          {solicitacao
                            ?.policial
                            ?.re ||
                            'NÃO INFORMADO'}
                        </td>

                        <td>
                          {formatarDataHora(
                            solicitacao
                              .criado_em
                          )}
                        </td>

                        <td>
                          {quantidade}{' '}
                          {quantidade === 1
                            ? 'campo'
                            : 'campos'}
                        </td>

                        <td>
                          <span
                            className={
                              `solicitacao-status ` +
                              `solicitacao-status-${classeStatus(
                                solicitacao.status
                              )}`
                            }
                          >
                            {labelStatus(
                              solicitacao.status
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="solicitacao-btn-visualizar"
                            onClick={() => {
                              setErroModal('')

                              selecionar(
                                solicitacao
                              )
                            }}
                          >
                            Visualizar
                          </button>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="solicitacoes-pagination">
          <button
            type="button"
            disabled={
              pagina <= 1 ||
              loading
            }
            onClick={() =>
              setPagina(
                (atual) =>
                  Math.max(
                    atual - 1,
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
              setPagina(
                (atual) =>
                  Math.min(
                    atual + 1,
                    totalPaginas
                  )
              )
            }
          >
            Próxima
          </button>
        </div>
      </section>

      <SolicitacaoModal
        solicitacao={
          selecionada
        }
        user={
          user
        }
        processando={
          processando
        }
        erro={
          erroModal
        }
        onClose={() => {
          if (processando) {
            return
          }

          setSolicitacaoSelecionada(
            null
          )

          setErroModal('')
        }}
        onAprovar={
          handleAprovar
        }
        onReprovar={
          handleReprovar
        }
      />
    </main>
  )
}