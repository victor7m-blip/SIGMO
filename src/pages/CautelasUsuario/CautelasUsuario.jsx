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
    ['tonfa', 'cassetete'].includes(
      normalizar(item?.tipo_patrimonio)
    ) ||
    ['tonfa', 'cassetete'].includes(
      normalizar(item?.tipo)
    ) ||
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

function chaveItemEstavel(item) {
  const observacao = lerObservacao(item)

  if (itemEhQuantitativo(item)) {
    return String(
      item?.movimentacao_tonfa_id ||
      observacao?.movimentacao_tonfa_id ||
      item?.id ||
      item?.patrimonio_id ||
      ''
    )
  }

  return String(
    item?.patrimonio_id ||
    item?.id ||
    ''
  )
}

function chaveQuantidadeRecebimento(
  movimentacaoId,
  item
) {
  return [
    movimentacaoId,
    chaveItemEstavel(item)
  ].join(':')
}

function chaveQuantidadeDevolucao(item) {
  return `DEVOLUCAO:${chaveItemEstavel(item)}`
}

function ItensMovimentacao({
  movimentacaoId = '',
  itens = []
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
      {itens.map((item, index) => (
        <article
          key={item?.id || item?.patrimonio_id || index}
          className="cautela-usuario-item"
        >
          <div className="cautela-usuario-item-identificacao">
            <strong>{obterDescricao(item)}</strong>
            <span>{obterIdentificacao(item)}</span>
          </div>

          <b>Qtd. {quantidadeEnviada(item)}</b>
        </article>
      ))}
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
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [quantidadesDevolver, setQuantidadesDevolver] = useState({})
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

              const chave =
                chaveQuantidadeRecebimento(
                  movimentacao.id,
                  item
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

  const chavesItensEmDevolucao = useMemo(() => {
    const chaves = new Set()

    for (const movimentacao of devolucoes) {
      for (const item of movimentacao?.itens || []) {
        const statusItem =
          normalizar(
            item?.status_item ||
            item?.status ||
            ''
          ).replace(/\s+/g, '_')

        const itemJaEncerrado = [
          'recebido',
          'concluido',
          'concluida',
          'cancelado',
          'cancelada'
        ].includes(statusItem)

        if (itemJaEncerrado) {
          continue
        }

        const observacao = lerObservacao(item)

        const movimentacaoTonfaId =
          observacao?.movimentacao_tonfa_id ||
          null

        if (movimentacaoTonfaId) {
          chaves.add(
            `Q:${String(movimentacaoTonfaId)}`
          )
          continue
        }

        const patrimonioId =
          item?.patrimonio_id ||
          item?.id ||
          null

        if (patrimonioId) {
          chaves.add(
            `P:${String(patrimonioId)}`
          )
        }
      }
    }

    return chaves
  }, [devolucoes])

  function chaveBloqueioItem(item) {
    if (
      item?.tipo_registro ===
      'TONFA_QUANTIDADE'
    ) {
      const observacao =
        lerObservacao(item)

      const movimentacaoTonfaId =
        item?.movimentacao_tonfa_id ||
        observacao?.movimentacao_tonfa_id ||
        null

      if (movimentacaoTonfaId) {
        return `Q:${String(movimentacaoTonfaId)}`
      }
    }

    const patrimonioId =
      item?.patrimonio_id ||
      item?.id ||
      null

    return patrimonioId
      ? `P:${String(patrimonioId)}`
      : ''
  }

  function itemEstaEmDevolucaoPendente(item) {
    const chave = chaveBloqueioItem(item)

    return Boolean(
      chave &&
      chavesItensEmDevolucao.has(chave)
    )
  }

  const materiaisDisponiveisDevolucao =
    useMemo(
      () =>
        materiais.filter(
          (item) =>
            !itemEstaEmDevolucaoPendente(item)
        ),
      [materiais, chavesItensEmDevolucao]
    )

  function itemEstaSelecionado(item) {
  const chave =
    chaveItemEstavel(item)

  return itensSelecionados.some(
    (selecionado) =>
      chaveItemEstavel(
        selecionado
      ) === chave
  )
}

function alternarItemSelecionado(item) {
  if (itemEstaEmDevolucaoPendente(item)) {
    return
  }

  const chaveItem =
    chaveItemEstavel(item)

  const quantitativo =
    itemEhQuantitativo(item)

  const chaveQuantidade =
    chaveQuantidadeDevolucao(item)

  setItensSelecionados((estadoAtual) => {
    const jaSelecionado =
      estadoAtual.some(
        (selecionado) =>
          chaveItemEstavel(
            selecionado
          ) === chaveItem
      )

    if (jaSelecionado) {
      if (quantitativo) {
        setQuantidadesDevolver(
          (estadoQuantidades) => {
            const proximo = {
              ...estadoQuantidades
            }

            delete proximo[
              chaveQuantidade
            ]

            return proximo
          }
        )
      }

      return estadoAtual.filter(
        (selecionado) =>
          chaveItemEstavel(
            selecionado
          ) !== chaveItem
      )
    }

    if (quantitativo) {
      setQuantidadesDevolver(
        (estadoQuantidades) => ({
          ...estadoQuantidades,
          [chaveQuantidade]:
            quantidadeEnviada(item)
        })
      )
    }

    return [
      ...estadoAtual,
      item
    ]
  })

  setErro('')
}

function selecionarTodosMateriais() {
  if (
    materiaisDisponiveisDevolucao.length > 0 &&
    itensSelecionados.length ===
      materiaisDisponiveisDevolucao.length
  ) {
    setItensSelecionados([])
    setQuantidadesDevolver({})
    return
  }

  setItensSelecionados(
    materiaisDisponiveisDevolucao
  )

  const quantidadesIniciais = {}

  materiaisDisponiveisDevolucao.forEach(
    (item) => {
      if (!itemEhQuantitativo(item)) {
        return
      }

      const chave =
        chaveQuantidadeDevolucao(item)

      quantidadesIniciais[chave] =
        quantidadeEnviada(item)
    }
  )

  setQuantidadesDevolver(
    quantidadesIniciais
  )

  setErro('')
}

function alterarQuantidadeDevolver(
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

  setQuantidadesDevolver((estadoAtual) => ({
    ...estadoAtual,
    [chave]: quantidade
  }))
}

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
        const chave =
          chaveQuantidadeRecebimento(
            movimentacao.id,
            item
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

  function removerItemRecebimento(
    movimentacaoId,
    item
  ) {
    const chave =
      chaveQuantidadeRecebimento(
        movimentacaoId,
        item
      )

    if (!itemEhQuantitativo(item)) {
      return
    }

    setQuantidadesReceber((estadoAtual) => {
      const proximo = {
        ...estadoAtual
      }

      delete proximo[chave]

      return proximo
    })
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

  async function devolverSelecionados() {
  if (itensSelecionados.length === 0) {
    setErro(
      'Selecione pelo menos um material para devolução.'
    )
    return
  }

  if (
    !window.confirm(
      `Confirma a devolução de ${itensSelecionados.length} item(ns) ao SVDD? A responsabilidade só será encerrada após o aceite do SVDD.`
    )
  ) {
    return
  }

  try {
    setProcessando('devolucao')
    setErro('')
    setMensagem('')

    const itensParaDevolucao =
      itensSelecionados.map((item) => {
        if (!itemEhQuantitativo(item)) {
          return item
        }

        const chave =
          chaveQuantidadeDevolucao(item)

        return {
          ...item,
          quantidade: Math.max(
            1,
            Math.min(
              Number(
                quantidadesDevolver[chave] ??
                quantidadeEnviada(item)
              ) || 1,
              quantidadeEnviada(item)
            )
          )
        }
      })

    await solicitarDevolucaoCautela({
      user,
      itens: itensParaDevolucao
    })

    setMensagem(
      'Solicitação de devolução enviada ao SVDD. Aguarde a conferência e o aceite do responsável.'
    )

    setItensSelecionados([])
    setQuantidadesDevolver({})

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
              ? 'Selecione os materiais que serão apresentados ao SVDD. A baixa ocorrerá somente após a conferência física.'
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
              Há material com devolução já encaminhada ao SVDD. Somente esses itens ficam bloqueados até a conferência; os demais continuam disponíveis para nova devolução.
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
                  <span>SELECIONE OS MATERIAIS</span>
                  <h2>Carrinho de devolução</h2>
                </div>
                <small>
                  Conferência obrigatória pelo SVDD
                </small>
              </div>

              <div className="cautela-usuario-selecao-topo">
  <label>
    <input
      type="checkbox"
      checked={
        materiaisDisponiveisDevolucao.length > 0 &&
        itensSelecionados.length ===
          materiaisDisponiveisDevolucao.length
      }
      onChange={selecionarTodosMateriais}
      disabled={
        materiaisDisponiveisDevolucao.length === 0
      }
    />

    <span>Selecionar todos</span>
  </label>

  <small>
    {itensSelecionados.length} de {materiais.length} selecionado(s)
  </small>
</div>

<div className="cautela-usuario-itens">
  {materiais.map((item, index) => {
    const selecionado =
      itemEstaSelecionado(item)

    const maxima =
      quantidadeEnviada(item)

    const bloqueado =
      itemEstaEmDevolucaoPendente(item)

    return (
      <article
        key={item?.id || item?.patrimonio_id || index}
        className={`cautela-usuario-item${
          selecionado
            ? ' is-selecionado'
            : ''
        }`}
      >
        <label className="cautela-usuario-item-selecao">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={() =>
              alternarItemSelecionado(
                item
              )
            }
            disabled={bloqueado}
          />

          <div className="cautela-usuario-item-identificacao">
            <strong>{obterDescricao(item)}</strong>
            <span>{obterIdentificacao(item)}</span>

            {bloqueado && (
              <small>
                DEVOLUÇÃO JÁ ENCAMINHADA AO SVDD
              </small>
            )}
          </div>
        </label>

        <b>Qtd. {maxima}</b>
      </article>
    )
  })}
</div>

<div className="cautela-usuario-carrinho">
  <h3>Materiais selecionados</h3>

  {itensSelecionados.length === 0 ? (
    <div className="cautela-usuario-carrinho-vazio">
      Nenhum material selecionado.
    </div>
  ) : (
    itensSelecionados.map((item, index) => {
      const quantitativo =
        itemEhQuantitativo(item)

      const maxima =
        quantidadeEnviada(item)

      const chave =
        chaveQuantidadeDevolucao(item)

      const quantidadeDevolver =
        Math.max(
          1,
          Math.min(
            Number(
              quantidadesDevolver[chave] ??
              maxima
            ) || 1,
            maxima
          )
        )

      return (
        <article
          key={`selecionado-${chaveItemEstavel(item)}-${index}`}
          className="cautela-usuario-carrinho-item"
        >
          <div className="cautela-usuario-carrinho-info">
            <strong>
              {obterIdentificacao(item)}
            </strong>

            <span>
              {obterDescricao(item)}
            </span>

            {quantitativo && (
              <label className="cautela-usuario-carrinho-quantidade">
                <span>Quantidade</span>

                <input
                  type="number"
                  min="1"
                  max={maxima}
                  value={quantidadeDevolver}
                  onChange={(event) =>
                    alterarQuantidadeDevolver(
                      chave,
                      event.target.value,
                      maxima
                    )
                  }
                />

                <small>
                  Saldo em cautela: {maxima}
                </small>
              </label>
            )}
          </div>

          <button
            type="button"
            className="cautela-usuario-carrinho-remover"
            aria-label="Remover material"
            onClick={() =>
              alternarItemSelecionado(item)
            }
          >
            ×
          </button>
        </article>
      )
    })
  )}
</div>

              <button
                type="button"
                className="cautela-usuario-primary"
                onClick={devolverSelecionados}
                disabled={
  processando === 'devolucao' ||
  itensSelecionados.length === 0
}
              >
                {processando === 'devolucao'
                  ? 'Enviando...'
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
                />

                <div className="cautela-usuario-carrinho">
                  <h3>Materiais para recebimento</h3>

                  {(movimentacao?.itens || []).length === 0 ? (
                    <div className="cautela-usuario-carrinho-vazio">
                      Nenhum material neste carrinho.
                    </div>
                  ) : (
                    (movimentacao?.itens || []).map(
                      (item, index) => {
                        const quantitativo =
                          itemEhQuantitativo(item)

                        const enviada =
                          quantidadeEnviada(item)

                        const chave =
                          chaveQuantidadeRecebimento(
                            movimentacao.id,
                            item
                          )

                        const quantidadeReceber =
                          Math.max(
                            1,
                            Math.min(
                              Number(
                                quantidadesReceber[chave] ??
                                enviada
                              ) || 1,
                              enviada
                            )
                          )

                        return (
                          <article
                            key={`receber-${movimentacao.id}-${chaveItemEstavel(item)}-${index}`}
                            className="cautela-usuario-carrinho-item"
                          >
                            <div className="cautela-usuario-carrinho-info">
                              <strong>
                                {obterIdentificacao(item)}
                              </strong>

                              <span>
                                {obterDescricao(item)}
                              </span>

                              {quantitativo && (
                                <label className="cautela-usuario-carrinho-quantidade">
                                  <span>Quantidade</span>

                                  <input
                                    type="number"
                                    min="1"
                                    max={enviada}
                                    value={quantidadeReceber}
                                    onChange={(event) =>
                                      alterarQuantidadeReceber(
                                        chave,
                                        event.target.value,
                                        enviada
                                      )
                                    }
                                  />

                                  <small>
                                    Quantidade enviada pelo SVDD: {enviada}
                                  </small>
                                </label>
                              )}
                            </div>
                          </article>
                        )
                      }
                    )
                  )}
                </div>

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
