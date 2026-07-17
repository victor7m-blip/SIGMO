import {
  useMemo
} from 'react'

import useSolicitacoes from '../../features/solicitacoes/hooks/useSolicitacoes'

import SolicitacaoTable from '../../features/solicitacoes/SolicitacaoTable'

import SolicitacaoModal from '../../features/solicitacoes/components/SolicitacaoModal'

import HistoricoSolicitacao from '../../features/solicitacoes/components/HistoricoSolicitacao'

import FiltrosSolicitacao from '../../features/solicitacoes/components/FiltrosSolicitacao'

import {
  registerAudit
} from '../../services/auditoriaService'

import './SolicitacoesCadastro.css'

function obterNomeUsuario(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.re ||
    'SIGMO'
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

  const total =
    paginacao.total

  const historico =
    useMemo(
      () =>
        selecionada?.historico ||
        [],
      [selecionada]
    )

  async function handleAprovar() {
  if (!selecionada) {
    return
  }

  try {
    await aprovar(
      selecionada.id,
      {
        responsavel: {
          re: user?.re,
          nome:
            user?.nome_guerra ||
            user?.nome ||
            user?.nome_completo ||
            'Usuário SIGMO'
        }
      }
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

    if (!selecionada) {
      return
    }

    try {

     await reprovar(
  selecionada.id,
  {
    motivo,
    responsavel: {
      re: user?.re,
      nome:
        user?.nome_guerra ||
        user?.nome ||
        user?.nome_completo ||
        'Usuário SIGMO'
    }
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

            Analise e aprove solicitações cadastradas pelos policiais.

          </p>

        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={carregarSolicitacoes}
          disabled={loading}
        >

          {loading
            ? 'Atualizando...'
            : 'Atualizar'}

        </button>

      </header>

      <section className="solicitacoes-resumo">

        <div>

          <span>

            TOTAL

          </span>

          <strong>

            {total}

          </strong>

          <small>

            solicitações

          </small>

        </div>

        <div>

          <span>

            FILTRO

          </span>

          <strong>

            {filtros.status || 'TODAS'}

          </strong>

          <small>

            status atual

          </small>

        </div>

      </section>
            <section className="panel solicitacoes-panel">

        <FiltrosSolicitacao
          filtros={filtros}
          onChange={atualizarFiltros}
          loading={loading}
        />

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

        <SolicitacaoTable
  solicitacoes={solicitacoes}
  loading={loading}
  pagina={paginacao.pagina}
  totalPaginas={totalPaginas}
  total={total}
  onPagina={alterarPagina}
  onVisualizar={selecionar}
/>

      </section>

      <HistoricoSolicitacao
        historico={historico}
      />

      <SolicitacaoModal
        open={Boolean(selecionada)}
        solicitacao={selecionada}
        loading={loading}
        onClose={limparSelecao}
        onAprovar={handleAprovar}
        onReprovar={handleReprovar}
      />

    </main>

  )

}
