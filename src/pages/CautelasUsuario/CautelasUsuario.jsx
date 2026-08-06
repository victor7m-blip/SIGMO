import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  confirmarRecebimentoCautela,
  listarCautelasAguardandoUsuario,
  listarDevolucoesPendentesUsuario,
  listarMateriaisEmServicoUsuario,
  solicitarDevolucaoCautela
} from '../../services/cautelasUsuarioService'

import './CautelasUsuario.css'

function formatarData(valor) {
  if (!valor) return 'Não informada'

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return String(valor)
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function obterDescricao(item) {
  return (
    item?.descricao ||
    item?.nome ||
    item?.tipo ||
    item?.categoria ||
    item?.patrimonio_descricao ||
    'Material operacional'
  )
}

function obterIdentificacao(item) {
  return (
    item?.numero_patrimonio ||
    item?.patrimonio ||
    item?.identificador ||
    item?.numero_serie ||
    item?.codigo ||
    item?.patrimonio_id ||
    item?.id ||
    'Sem identificação'
  )
}

function lerObservacao(item) {
  if (!item?.observacao) {
    return {}
  }

  if (typeof item.observacao === 'object') {
    return item.observacao
  }

  try {
    return JSON.parse(item.observacao)
  } catch {
    return {}
  }
}

function itemEhQuantitativo(item) {
  const observacao = lerObservacao(item)

  return (
    normalizar(item?.tipo_patrimonio) === 'tonfa' ||
    normalizar(item?.tipo) === 'tonfa' ||
    normalizar(observacao?.tipo_registro) ===
      'tonfa_quantidade'
  )
}

function quantidadeEnviada(item) {
  const quantidade = Number(item?.quantidade || 1)

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return 1
  }

  return Math.trunc(quantidade)
}

function chaveQuantidade(movimentacaoId, item, index) {
  return [
    movimentacaoId,
    item?.id || item?.patrimonio_id || index
  ].join(':')
}

function ItensMovimentacao({
  movimentacaoId = '',
  itens = [],
  permitirQuantidade = false,
  quantidades = {},
  onQuantidadeChange = null
}) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return (
      <p className="cautela-usuario-vazio-item">
        Os itens deste carrinho não puderam ser detalhados.
      </p>
    )
  }

  return (
    <div className="cautela-usuario-itens">
      {itens.map((item, index) => {
        const quantitativo = itemEhQuantitativo(item)
        const enviada = quantidadeEnviada(item)
        const chave = chaveQuantidade(
          movimentacaoId,
          item,
          index
        )
        const receber = Math.max(
          1,
          Math.min(
            Number(quantidades[chave] ?? enviada) || 1,
            enviada
          )
        )
        const permaneceSvdd = Math.max(
          0,
          enviada - receber
        )

        return (
          <article
            key={item?.id || item?.patrimonio_id || index}
            className={`cautela-usuario-item${
              quantitativo && permitirQuantidade
                ? ' cautela-usuario-item-quantitativo'
                : ''
            }`}
          >
            <div className="cautela-usuario-item-identificacao">
              <strong>{obterDescricao(item)}</strong>
              <span>{obterIdentificacao(item)}</span>
            </div>

            {quantitativo && permitirQuantidade ? (
              <div className="cautela-usuario-quantidade-parcial">
                <div className="cautela-usuario-quantidade-resumo">
                  <small>Quantidade enviada</small>
                  <b>{enviada}</b>
                </div>

                <label>
                  <span>Quantidade a receber</span>

                  <div className="cautela-usuario-stepper">
                    <button
                      type="button"
                      aria-label="Diminuir quantidade"
                      disabled={receber <= 1}
                      onClick={() =>
                        onQuantidadeChange?.(
                          chave,
                          receber - 1,
                          enviada
                        )
                      }
                    >
                      −
                    </button>

                    <input
                      type="number"
                      min="1"
                      max={enviada}
                      value={receber}
                      onChange={(event) =>
                        onQuantidadeChange?.(
                          chave,
                          event.target.value,
                          enviada
                        )
                      }
                    />

                    <button
                      type="button"
                      aria-label="Aumentar quantidade"
                      disabled={receber >= enviada}
                      onClick={() =>
                        onQuantidadeChange?.(
                          chave,
                          receber + 1,
                          enviada
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </label>

                <small className="cautela-usuario-saldo-svdd">
                  {permaneceSvdd > 0
                    ? `${permaneceSvdd} unidade(s) permanecerão no Cofre do SVDD.`
                    : 'Todo o quantitativo será recebido.'}
                </small>
              </div>
            ) : (
              <b>Qtd. {enviada}</b>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default function CautelasUsuario({
  user,
  modo = 'receber',
  onConcluido
}) {
  const [cautelas, setCautelas] = useState([])
  const [materiais, setMateriais] = useState([])
  const [devolucoes, setDevolucoes] = useState([])
  const [quantidadesReceber, setQuantidadesReceber] = useState({})
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const [pendentes, ativos, devolucoesPendentes] =
        await Promise.all([
          listarCautelasAguardandoUsuario(user),
          listarMateriaisEmServicoUsuario(user),
          listarDevolucoesPendentesUsuario(user)
        ])

      const listaPendentes = pendentes || []

      setCautelas(listaPendentes)
      setMateriais(ativos || [])
      setDevolucoes(devolucoesPendentes || [])

      setQuantidadesReceber((estadoAtual) => {
        const proximoEstado = {}

        for (const movimentacao of listaPendentes) {
          ;(movimentacao?.itens || []).forEach(
            (item, index) => {
              if (!itemEhQuantitativo(item)) {
                return
              }

              const chave = chaveQuantidade(
                movimentacao.id,
                item,
                index
              )
              const maxima = quantidadeEnviada(item)
              const atual = Number(estadoAtual[chave])

              proximoEstado[chave] =
                Number.isFinite(atual) && atual > 0
                  ? Math.min(atual, maxima)
                  : maxima
            }
          )
        }

        return proximoEstado
      })
    } catch (error) {
      console.error(
        'Erro ao carregar cautelas do usuário:',
        error
      )

      setErro(
        error?.message ||
          'Não foi possível carregar suas cautelas.'
      )
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    carregar()
  }, [carregar])

  const quantidadeEmServico = useMemo(
    () =>
      materiais.reduce(
        (total, item) =>
          total + (Number(item?.quantidade || 1) || 1),
        0
      ),
    [materiais]
  )

  const existeDevolucaoPendente = devolucoes.length > 0
  const telaDevolucao = modo === 'devolver'

  function alterarQuantidadeReceber(
    chave,
    valor,
    quantidadeMaxima
  ) {
    const maxima = Math.max(
      1,
      Number(quantidadeMaxima) || 1
    )
    const quantidade = Math.max(
      1,
      Math.min(
        Number(valor) || 1,
        maxima
      )
    )

    setQuantidadesReceber((estadoAtual) => ({
      ...estadoAtual,
      [chave]: quantidade
    }))
  }

  function prepararItensRecebimento(movimentacao) {
    return (movimentacao?.itens || []).map(
      (item, index) => {
        const enviada = quantidadeEnviada(item)
        const quantitativo = itemEhQuantitativo(item)
        const chave = chaveQuantidade(
          movimentacao.id,
          item,
          index
        )

        return {
          itemId: item?.id || null,
          patrimonioId: item?.patrimonio_id || null,
          quantidadeEnviada: enviada,
          quantidadeReceber: quantitativo
            ? Math.max(
                1,
                Math.min(
                  Number(quantidadesReceber[chave] ?? enviada) || 1,
                  enviada
                )
              )
            : enviada,
          quantitativo
        }
      }
    )
  }

  async function receberCarrinho(movimentacao) {
    const itensRecebimento =
      prepararItensRecebimento(movimentacao)

    const quantitativosParciais = itensRecebimento.filter(
      (item) =>
        item.quantitativo &&
        item.quantidadeReceber < item.quantidadeEnviada
    )

    const mensagemConfirmacao = quantitativosParciais.length > 0
      ? 'Confirma o recebimento das quantidades selecionadas? As unidades não recebidas permanecerão no Cofre do SVDD.'
      : 'Confirma o recebimento de todos os materiais deste carrinho?'

    if (!window.confirm(mensagemConfirmacao)) {
      return
    }

    try {
      setProcessando(movimentacao.id)
      setErro('')
      setMensagem('')

      const resultado =
        await confirmarRecebimentoCautela({
          movimentacaoId: movimentacao.id,
          itens: itensRecebimento,
          user
        })

      setMensagem(
        resultado?.mensagem ||
          (quantitativosParciais.length > 0
            ? 'Recebimento parcial concluído. As quantidades não recebidas permaneceram no Cofre do SVDD.'
            : 'Cautela recebida com sucesso. Os materiais já estão sob sua responsabilidade.')
      )

      await carregar()
      onConcluido?.(resultado)
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível confirmar o recebimento.'
      )
    } finally {
      setProcessando('')
    }
  }

  async function devolverTudo() {
    if (existeDevolucaoPendente) {
      setErro(
        'Já existe uma devolução aguardando análise e recebimento pelo SVDD.'
      )
      return
    }

    if (!window.confirm(
      'Confirma que está apresentando todos os materiais ao SVDD? A responsabilidade só será encerrada após o aceite do SVDD.'
    )) {
      return
    }

    try {
      setProcessando('devolucao')
      setErro('')
      setMensagem('')

      await solicitarDevolucaoCautela({
        user,
        itens: materiais
      })

      setMensagem(
        'Solicitação de devolução enviada ao SVDD. Aguarde a conferência e o aceite do responsável.'
      )

      await carregar()
      onConcluido?.()
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível solicitar a devolução.'
      )
    } finally {
      setProcessando('')
    }
  }

  return (
    <main className="cautela-usuario-page">
      <header className="cautela-usuario-hero">
        <div>
          <span>FLUXO OPERACIONAL</span>
          <h1>
            {telaDevolucao
              ? 'Devolver materiais'
              : 'Receber material'}
          </h1>
          <p>
            {telaDevolucao
              ? 'Apresente o carrinho completo ao SVDD. A baixa ocorrerá somente após a conferência física.'
              : 'Confira o carrinho pago pelo SVDD e escolha a quantidade dos materiais quantitativos.'}
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          disabled={loading}
        >
          {loading ? 'Atualizando...' : '↻ Atualizar'}
        </button>
      </header>

      <section className="cautela-usuario-resumo">
        <article>
          <small>Aguardando recebimento</small>
          <strong>{cautelas.length}</strong>
        </article>
        <article>
          <small>Materiais sob responsabilidade</small>
          <strong>{quantidadeEmServico}</strong>
        </article>
        <article>
          <small>Devoluções pendentes</small>
          <strong>{devolucoes.length}</strong>
        </article>
      </section>

      {erro && (
        <div className="cautela-usuario-alerta erro">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="cautela-usuario-alerta sucesso">
          {mensagem}
        </div>
      )}

      {loading ? (
        <section className="cautela-usuario-estado">
          Carregando suas cautelas...
        </section>
      ) : telaDevolucao ? (
        <section className="cautela-usuario-lista">
          {existeDevolucaoPendente && (
            <div className="cautela-usuario-alerta info">
              Sua devolução já foi encaminhada. Os materiais continuam sob sua responsabilidade até o SVDD concluir a conferência.
            </div>
          )}

          {materiais.length === 0 ? (
            <div className="cautela-usuario-estado">
              <strong>
                Nenhum material disponível para devolução.
              </strong>
            </div>
          ) : (
            <article className="cautela-usuario-card">
              <div className="cautela-usuario-card-topo">
                <div>
                  <span>DEVOLUÇÃO INTEGRAL</span>
                  <h2>Carrinho de devolução</h2>
                </div>
                <small>
                  Conferência obrigatória pelo SVDD
                </small>
              </div>

              <ItensMovimentacao itens={materiais} />

              <button
                type="button"
                className="cautela-usuario-primary"
                onClick={devolverTudo}
                disabled={
                  processando === 'devolucao' ||
                  existeDevolucaoPendente
                }
              >
                {processando === 'devolucao'
                  ? 'Enviando...'
                  : existeDevolucaoPendente
                    ? 'Aguardando aceite do SVDD'
                    : 'Enviar devolução ao SVDD'}
              </button>
            </article>
          )}
        </section>
      ) : (
        <section className="cautela-usuario-lista">
          {cautelas.length === 0 ? (
            <div className="cautela-usuario-estado">
              <strong>
                Nenhum carrinho aguardando seu aceite.
              </strong>
              <p>
                Quando o SVDD pagar material para você, o carrinho aparecerá aqui.
              </p>
            </div>
          ) : (
            cautelas.map((movimentacao) => (
              <article
                key={movimentacao.id}
                className="cautela-usuario-card"
              >
                <div className="cautela-usuario-card-topo">
                  <div>
                    <span>CARRINHO DE CAUTELA</span>
                    <h2>
                      {movimentacao.protocolo ||
                        movimentacao.documento ||
                        `Cautela ${String(movimentacao.id).slice(0, 8)}`}
                    </h2>
                  </div>
                  <small>
                    {formatarData(
                      movimentacao.created_at ||
                        movimentacao.solicitado_em
                    )}
                  </small>
                </div>

                <ItensMovimentacao
                  movimentacaoId={movimentacao.id}
                  itens={movimentacao.itens}
                  permitirQuantidade
                  quantidades={quantidadesReceber}
                  onQuantidadeChange={alterarQuantidadeReceber}
                />

                <button
                  type="button"
                  className="cautela-usuario-primary"
                  onClick={() =>
                    receberCarrinho(movimentacao)
                  }
                  disabled={processando === movimentacao.id}
                >
                  {processando === movimentacao.id
                    ? 'Confirmando...'
                    : 'Confirmar recebimento'}
                </button>
              </article>
            ))
          )}
        </section>
      )}
    </main>
  )
}
