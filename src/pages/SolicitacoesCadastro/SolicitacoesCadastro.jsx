import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import useSolicitacoes from '../../features/solicitacoes/hooks/useSolicitacoes'
import SolicitacaoTable from '../../features/solicitacoes/SolicitacaoTable'
import SolicitacaoModal from '../../features/solicitacoes/components/SolicitacaoModal'
import HistoricoSolicitacao from '../../features/solicitacoes/components/HistoricoSolicitacao'
import FiltrosSolicitacao from '../../features/solicitacoes/components/FiltrosSolicitacao'

import {
  registerAudit
} from '../../services/auditoriaService'

import {
  aprovarRecuperacaoPin,
  listarRecuperacoesPin,
  reprovarRecuperacaoPin
} from '../../services/recuperacoesPinService'

import {
  podeAcessarRecuperacaoPin,
  podeGerenciarSolicitacoesCadastrais
} from '../../services/permissionService'

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

function formatarDataHora(valor) {
  if (!valor) return 'Data não informada'

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return String(valor)
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(data)
}

function SolicitacoesCadastraisPainel({
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

  const historico = useMemo(
    () => selecionada?.historico || [],
    [selecionada]
  )

  async function handleAprovar() {
    if (!selecionada) return

    try {
      await aprovar(
        selecionada.id,
        {
          responsavel: {
            re: user?.re,
            nome: obterNomeUsuario(user)
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

  async function handleReprovar(motivo) {
    if (!selecionada) return

    try {
      await reprovar(
        selecionada.id,
        {
          motivo,
          responsavel: {
            re: user?.re,
            nome: obterNomeUsuario(user)
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
    <>
      <section className="solicitacoes-subtitulo">
        <div>
          <span>ALTERAÇÕES CADASTRAIS</span>
          <h2>Solicitações dos policiais</h2>
          <p>
            Analise pedidos de atualização dos dados cadastrais.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={carregarSolicitacoes}
          disabled={loading}
        >
          {loading ? 'Atualizando...' : 'Atualizar cadastros'}
        </button>
      </section>

      <section className="solicitacoes-resumo">
        <div>
          <span>TOTAL</span>
          <strong>{paginacao.total}</strong>
          <small>solicitações cadastrais</small>
        </div>

        <div>
          <span>FILTRO</span>
          <strong>{filtros.status || 'TODAS'}</strong>
          <small>status atual</small>
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
          total={paginacao.total}
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
    </>
  )
}

function RecuperacoesPinPainel({
  user
}) {
  const [status, setStatus] = useState('PENDENTE')
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [confirmacao, setConfirmacao] = useState(null)
  const [rejeicao, setRejeicao] = useState(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [credencialGerada, setCredencialGerada] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')

    try {
      const resultado = await listarRecuperacoesPin({
        usuarioId: user?.user_id,
        status,
        limite: 100
      })

      setSolicitacoes(resultado)
    } catch (error) {
      console.error(error)
      setSolicitacoes([])
      setErro(
        error?.message ||
        'Não foi possível carregar as recuperações de PIN.'
      )
    } finally {
      setLoading(false)
    }
  }, [status, user?.user_id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function confirmarAprovacao() {
    if (!confirmacao || processando) return

    setProcessando(true)
    setErro('')
    setSucesso('')

    try {
      const resultado = await aprovarRecuperacaoPin({
        usuarioId: user?.user_id,
        recuperacaoId: confirmacao.id
      })

      setConfirmacao(null)
      setCredencialGerada(resultado)
      setCopiado(false)

      try {
        await registerAudit(
          'RECUPERACAO_PIN_APROVADA',
          `${obterNomeUsuario(user)} aprovou a recuperação de PIN de ${resultado.solicitante_nome || confirmacao.solicitante_nome || 'policial'}.`,
          user,
          'Solicitações'
        )
      } catch (auditError) {
        console.error('Erro ao registrar auditoria:', auditError)
      }

      await carregar()
    } catch (error) {
      console.error(error)
      setErro(
        error?.message ||
        'Não foi possível gerar o novo PIN.'
      )
    } finally {
      setProcessando(false)
    }
  }

  async function confirmarRejeicao() {
    if (!rejeicao || processando) return

    const motivo = motivoRejeicao.trim()

    if (motivo.length < 5) {
      setErro(
        'Informe uma justificativa com pelo menos 5 caracteres.'
      )
      return
    }

    setProcessando(true)
    setErro('')
    setSucesso('')

    try {
      await reprovarRecuperacaoPin({
        usuarioId: user?.user_id,
        recuperacaoId: rejeicao.id,
        motivo
      })

      try {
        await registerAudit(
          'RECUPERACAO_PIN_REPROVADA',
          `${obterNomeUsuario(user)} reprovou a recuperação de PIN de ${rejeicao.solicitante_nome || 'policial'}. Motivo: ${motivo}`,
          user,
          'Solicitações',
          'Atenção'
        )
      } catch (auditError) {
        console.error('Erro ao registrar auditoria:', auditError)
      }

      setRejeicao(null)
      setMotivoRejeicao('')
      setSucesso('Solicitação de recuperação de PIN reprovada.')
      await carregar()
    } catch (error) {
      console.error(error)
      setErro(
        error?.message ||
        'Não foi possível reprovar a solicitação.'
      )
    } finally {
      setProcessando(false)
    }
  }

  async function copiarPin() {
    const pin = credencialGerada?.pin_temporario

    if (!pin) return

    try {
      await navigator.clipboard.writeText(String(pin))
      setCopiado(true)
    } catch {
      setErro(
        'Não foi possível copiar automaticamente. Selecione o PIN e copie manualmente.'
      )
    }
  }

  function abrirRejeicao(solicitacao) {
    setErro('')
    setSucesso('')
    setMotivoRejeicao('')
    setRejeicao(solicitacao)
  }

  return (
    <section className="recuperacoes-pin-bloco">
      <div className="solicitacoes-subtitulo">
        <div>
          <span>RECUPERAÇÃO DE ACESSO</span>
          <h2>Solicitações de recuperação de PIN</h2>
          <p>
            Pedidos encaminhados ao responsável selecionado na tela de login.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={carregar}
          disabled={loading || processando}
        >
          {loading ? 'Atualizando...' : 'Atualizar recuperações'}
        </button>
      </div>

      <section className="solicitacoes-resumo recuperacoes-pin-resumo">
        <div>
          <span>TOTAL</span>
          <strong>{solicitacoes.length}</strong>
          <small>pedidos encontrados</small>
        </div>

        <div>
          <span>STATUS</span>
          <strong>{status || 'TODOS'}</strong>
          <small>filtro atual</small>
        </div>
      </section>

      <section className="panel solicitacoes-panel recuperacoes-pin-panel">
        <div className="recuperacoes-pin-filtros">
          <label htmlFor="recuperacao-pin-status">
            Status
          </label>

          <select
            id="recuperacao-pin-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={loading || processando}
          >
            <option value="PENDENTE">Pendentes</option>
            <option value="APROVADA">Aprovadas</option>
            <option value="REPROVADA">Reprovadas</option>
            <option value="CONCLUIDA">Concluídas</option>
            <option value="">Todos os status</option>
          </select>
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

        {loading ? (
          <div className="solicitacao-feedback">
            Carregando solicitações de recuperação de PIN...
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="solicitacao-feedback">
            Nenhuma solicitação de recuperação de PIN encontrada.
          </div>
        ) : (
          <div className="recuperacoes-pin-lista">
            {solicitacoes.map((solicitacao) => (
              <article
                key={solicitacao.id}
                className="recuperacao-pin-card"
              >
                <div className="recuperacao-pin-card-topo">
                  <div>
                    <span className="recuperacao-pin-tipo">
                      RECUPERAÇÃO DE PIN
                    </span>
                    <h3>
                      {solicitacao.solicitante_nome || 'Policial'}
                    </h3>
                    <p>
                      RE {solicitacao.solicitante_re || 'não informado'}
                      {solicitacao.solicitante_companhia
                        ? ` • ${solicitacao.solicitante_companhia}`
                        : ''}
                    </p>
                  </div>

                  <span
                    className={`solicitacao-status solicitacao-status-${String(
                      solicitacao.status || 'PENDENTE'
                    ).toLowerCase()}`}
                  >
                    {solicitacao.status || 'PENDENTE'}
                  </span>
                </div>

                <div className="recuperacao-pin-detalhes">
                  <span>
                    <strong>Solicitado em</strong>
                    {formatarDataHora(solicitacao.solicitado_em)}
                  </span>

                  <span>
                    <strong>Destinatário</strong>
                    {solicitacao.responsavel_nome || obterNomeUsuario(user)}
                  </span>
                </div>

                {solicitacao.observacao && (
                  <p className="recuperacao-pin-observacao">
                    {solicitacao.observacao}
                  </p>
                )}

                {solicitacao.status === 'PENDENTE' && (
                  <div className="recuperacao-pin-acoes">
                    <button
                      type="button"
                      className="recuperacao-pin-btn recuperacao-pin-btn-reprovar"
                      onClick={() => abrirRejeicao(solicitacao)}
                      disabled={processando}
                    >
                      Rejeitar
                    </button>

                    <button
                      type="button"
                      className="recuperacao-pin-btn recuperacao-pin-btn-aprovar"
                      onClick={() => {
                        setErro('')
                        setSucesso('')
                        setConfirmacao(solicitacao)
                      }}
                      disabled={processando}
                    >
                      Gerar novo PIN
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {confirmacao && (
        <div className="recuperacao-pin-modal-fundo">
          <section
            className="recuperacao-pin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-recuperacao-pin"
          >
            <span className="recuperacao-pin-modal-kicker">
              CONFIRMAÇÃO
            </span>

            <h3 id="confirmar-recuperacao-pin">
              Gerar um novo PIN temporário?
            </h3>

            <p>
              O PIN atual de <strong>{confirmacao.solicitante_nome}</strong>{' '}
              deixará de funcionar imediatamente.
            </p>

            <div className="recuperacao-pin-modal-aviso">
              O novo PIN terá validade de 24 horas e exigirá troca no primeiro acesso.
            </div>

            <div className="recuperacao-pin-modal-acoes">
              <button
                type="button"
                className="recuperacao-pin-btn recuperacao-pin-btn-cancelar"
                onClick={() => setConfirmacao(null)}
                disabled={processando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="recuperacao-pin-btn recuperacao-pin-btn-aprovar"
                onClick={confirmarAprovacao}
                disabled={processando}
              >
                {processando ? 'Gerando...' : 'Confirmar e gerar PIN'}
              </button>
            </div>
          </section>
        </div>
      )}

      {rejeicao && (
        <div className="recuperacao-pin-modal-fundo">
          <section
            className="recuperacao-pin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rejeitar-recuperacao-pin"
          >
            <span className="recuperacao-pin-modal-kicker recuperacao-pin-modal-kicker-alerta">
              REJEIÇÃO
            </span>

            <h3 id="rejeitar-recuperacao-pin">
              Rejeitar solicitação
            </h3>

            <p>
              Informe o motivo da rejeição do pedido de{' '}
              <strong>{rejeicao.solicitante_nome}</strong>.
            </p>

            <textarea
              value={motivoRejeicao}
              onChange={(event) => setMotivoRejeicao(event.target.value)}
              placeholder="Digite a justificativa..."
              rows={4}
              maxLength={500}
              disabled={processando}
              autoFocus
            />

            <div className="recuperacao-pin-modal-acoes">
              <button
                type="button"
                className="recuperacao-pin-btn recuperacao-pin-btn-cancelar"
                onClick={() => {
                  setRejeicao(null)
                  setMotivoRejeicao('')
                }}
                disabled={processando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="recuperacao-pin-btn recuperacao-pin-btn-reprovar"
                onClick={confirmarRejeicao}
                disabled={processando || motivoRejeicao.trim().length < 5}
              >
                {processando ? 'Rejeitando...' : 'Confirmar rejeição'}
              </button>
            </div>
          </section>
        </div>
      )}

      {credencialGerada && (
        <div className="recuperacao-pin-modal-fundo">
          <section
            className="recuperacao-pin-modal recuperacao-pin-credencial"
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-pin-temporario"
          >
            <span className="recuperacao-pin-modal-kicker">
              RECUPERAÇÃO APROVADA
            </span>

            <h3 id="novo-pin-temporario">
              Novo PIN temporário
            </h3>

            <div className="recuperacao-pin-identificacao">
              <strong>{credencialGerada.solicitante_nome}</strong>
              <span>RE {credencialGerada.solicitante_re}</span>
            </div>

            <div className="recuperacao-pin-codigo">
              {credencialGerada.pin_temporario}
            </div>

            <button
              type="button"
              className="recuperacao-pin-copiar"
              onClick={copiarPin}
            >
              {copiado ? 'PIN copiado' : 'Copiar PIN'}
            </button>

            <div className="recuperacao-pin-modal-aviso">
              Entregue este PIN pessoalmente ao solicitante. Ele não ficará visível novamente depois que esta janela for fechada.
            </div>

            <p className="recuperacao-pin-validade">
              Validade: {formatarDataHora(credencialGerada.expira_em)}
            </p>

            <button
              type="button"
              className="recuperacao-pin-btn recuperacao-pin-btn-aprovar recuperacao-pin-concluir"
              onClick={() => {
                setCredencialGerada(null)
                setSucesso('Novo PIN temporário gerado com sucesso.')
              }}
            >
              Concluir
            </button>
          </section>
        </div>
      )}
    </section>
  )
}

export default function SolicitacoesCadastro({
  user
}) {
  const podeVerRecuperacoes =
    podeAcessarRecuperacaoPin(user)

  const podeVerCadastros =
    podeGerenciarSolicitacoesCadastrais(user)

  return (
    <main className="page solicitacoes-page">
      <header className="solicitacoes-header">
        <div>
          <span className="solicitacoes-kicker">
            GESTÃO ADMINISTRATIVA
          </span>

          <h1>Solicitações</h1>

          <p>
            Central de solicitações cadastrais e recuperação de acesso.
          </p>
        </div>
      </header>

      {podeVerRecuperacoes && (
        <RecuperacoesPinPainel
          user={user}
        />
      )}

      {podeVerCadastros && (
        <SolicitacoesCadastraisPainel
          user={user}
        />
      )}

      {!podeVerRecuperacoes && !podeVerCadastros && (
        <div className="solicitacao-feedback solicitacao-feedback-error">
          Você não possui permissão para visualizar esta página.
        </div>
      )}
    </main>
  )
}
