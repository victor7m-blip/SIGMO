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
import './CautelasUsuarioNovidades.css'

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
  const identificacaoDireta =
    item?.numero_patrimonio ||
    item?.patrimonio ||
    item?.numero_serie ||
    item?.codigo ||
    item?.identificador ||
    null

  if (identificacaoDireta) {
    return String(identificacaoDireta).trim()
  }

  const descricao = String(
    item?.descricao ||
    item?.patrimonio_descricao ||
    ''
  ).trim()

  if (descricao) {
    const partes = descricao
      .split(' - ')
      .map((parte) => parte.trim())
      .filter(Boolean)

    const ultimaParte =
      partes[partes.length - 1] || ''

    if (
      ultimaParte &&
      ultimaParte !== descricao &&
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(ultimaParte)
    ) {
      return ultimaParte
    }
  }

  return 'SEM IDENTIFICAÇÃO PATRIMONIAL'
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
  const [novidadesRecebimento, setNovidadesRecebimento] = useState({})
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

  function obterNovidadeRecebimento(chave) {
    return (
      novidadesRecebimento[chave] ||
      null
    )
  }

  function alternarNovidadeRecebimento(chave) {
    setNovidadesRecebimento(
      (estadoAtual) => {
        const atual =
          estadoAtual[chave]

        if (!atual) {
          return {
            ...estadoAtual,
            [chave]: {
              aberta: true,
              tipo: '',
              descricao: '',
              providencia: 'ANALISE',
              quantidade_afetada: 1,
              fotos: [],
              previews: []
            }
          }
        }

        return {
          ...estadoAtual,
          [chave]: {
            ...atual,
            aberta: !atual.aberta
          }
        }
      }
    )

    setErro('')
    setMensagem('')
  }

  function alterarNovidadeRecebimento(
    chave,
    campo,
    valor,
    quantidadeMaxima = 1
  ) {
    setNovidadesRecebimento(
      (estadoAtual) => {
        const atual =
          estadoAtual[chave] || {
            aberta: true,
            tipo: '',
            descricao: '',
            providencia: 'ANALISE',
            quantidade_afetada: 1,
            fotos: [],
            previews: []
          }

        let novoValor = valor

        if (
          campo === 'tipo' ||
          campo === 'providencia'
        ) {
          novoValor = String(
            valor || ''
          ).toUpperCase()
        }

        if (campo === 'descricao') {
          novoValor = String(valor ?? '')
            .toUpperCase()
        }

        if (
          campo === 'quantidade_afetada'
        ) {
          const maxima = Math.max(
            1,
            Number(quantidadeMaxima) || 1
          )

          novoValor = Math.max(
            1,
            Math.min(
              Number(valor) || 1,
              maxima
            )
          )
        }

        return {
          ...estadoAtual,
          [chave]: {
            ...atual,
            [campo]: novoValor
          }
        }
      }
    )
  }

  function selecionarFotosNovidadeRecebimento(
    chave,
    event
  ) {
    const arquivos = Array.from(
      event.target.files || []
    )

    event.target.value = ''

    if (arquivos.length === 0) {
      return
    }

    const limiteBytes =
      5 * 1024 * 1024

    if (
      arquivos.some(
        (arquivo) =>
          !arquivo.type.startsWith(
            'image/'
          )
      )
    ) {
      setErro(
        'Selecione somente arquivos de imagem.'
      )
      return
    }

    if (
      arquivos.some(
        (arquivo) =>
          arquivo.size > limiteBytes
      )
    ) {
      setErro(
        'Cada foto deve possuir no máximo 5 MB.'
      )
      return
    }

    const novosPreviews =
      arquivos.map(
        (arquivo, indice) => ({
          id: `${Date.now()}-${indice}-${arquivo.name}`,
          url:
            URL.createObjectURL(
              arquivo
            ),
          nome: arquivo.name
        })
      )

    setNovidadesRecebimento(
      (estadoAtual) => {
        const atual =
          estadoAtual[chave] || {
            aberta: true,
            tipo: '',
            descricao: '',
            providencia: 'ANALISE',
            quantidade_afetada: 1,
            fotos: [],
            previews: []
          }

        return {
          ...estadoAtual,
          [chave]: {
            ...atual,
            aberta: true,
            fotos: [
              ...(atual.fotos || []),
              ...arquivos
            ],
            previews: [
              ...(atual.previews || []),
              ...novosPreviews
            ]
          }
        }
      }
    )

    setErro('')
  }

  function removerFotoNovidadeRecebimento(
    chave,
    indice
  ) {
    setNovidadesRecebimento(
      (estadoAtual) => {
        const atual =
          estadoAtual[chave]

        if (!atual) {
          return estadoAtual
        }

        const previews = [
          ...(atual.previews || [])
        ]

        const preview =
          previews[indice]

        if (preview?.url) {
          URL.revokeObjectURL(
            preview.url
          )
        }

        previews.splice(indice, 1)

        const fotos = [
          ...(atual.fotos || [])
        ]

        fotos.splice(indice, 1)

        return {
          ...estadoAtual,
          [chave]: {
            ...atual,
            fotos,
            previews
          }
        }
      }
    )
  }

  function removerNovidadeRecebimento(chave) {
    setNovidadesRecebimento(
      (estadoAtual) => {
        const atual =
          estadoAtual[chave]

        ;(atual?.previews || []).forEach(
          (preview) => {
            if (preview?.url) {
              URL.revokeObjectURL(
                preview.url
              )
            }
          }
        )

        const proximo = {
          ...estadoAtual
        }

        delete proximo[chave]

        return proximo
      }
    )
  }

  function novidadeParaEnvio(
    chave,
    quantidadeMaxima = 1
  ) {
    const novidade =
      novidadesRecebimento[chave]

    if (!novidade) {
      return null
    }

    const possuiConteudo = Boolean(
      novidade.tipo ||
      novidade.descricao ||
      (novidade.fotos || []).length
    )

    if (!possuiConteudo) {
      return null
    }

    return {
      tipo:
        String(novidade.tipo || '')
          .trim()
          .toUpperCase(),
      descricao:
        String(
          novidade.descricao || ''
        )
          .trim()
          .toUpperCase(),
      providencia:
        String(
          novidade.providencia ||
          'ANALISE'
        )
          .trim()
          .toUpperCase(),
      quantidade_afetada:
        Math.max(
          1,
          Math.min(
            Number(
              novidade.quantidade_afetada ||
              1
            ),
            Math.max(
              1,
              Number(
                quantidadeMaxima
              ) || 1
            )
          )
        ),
      fotos:
        novidade.fotos || []
    }
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
          quantitativo,
          novidade:
            novidadeParaEnvio(
              chave,
              quantitativo
                ? Math.max(
                    1,
                    Math.min(
                      Number(
                        quantidadesReceber[chave] ??
                        enviada
                      ) || 1,
                      enviada
                    )
                  )
                : enviada
            )
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

    for (const item of itensRecebimento) {
      if (!item.novidade) {
        continue
      }

      if (!item.novidade.tipo) {
        setErro(
          'Selecione o tipo de todas as novidades registradas.'
        )
        return
      }

      if (!item.novidade.descricao) {
        setErro(
          'Descreva todas as novidades registradas.'
        )
        return
      }
    }

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

      setNovidadesRecebimento(
        (estadoAtual) => {
          const proximo = {
            ...estadoAtual
          }

          ;(
            movimentacao?.itens || []
          ).forEach((item) => {
            const chave =
              chaveQuantidadeRecebimento(
                movimentacao.id,
                item
              )

            ;(
              proximo[chave]
                ?.previews || []
            ).forEach((preview) => {
              if (preview?.url) {
                URL.revokeObjectURL(
                  preview.url
                )
              }
            })

            delete proximo[chave]
          })

          return proximo
        }
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
      `Confirma a devolução de ${itensSelecionados.length} item(ns)? Cada material será encaminhado ao setor de origem da cautela. A responsabilidade só será encerrada após o aceite do setor responsável.`
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
      'Solicitação de devolução enviada ao setor responsável. Aguarde a conferência e o aceite.'
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
              ? 'Selecione os materiais que serão devolvidos. Cada item será encaminhado ao setor de origem da cautela e a baixa ocorrerá somente após a conferência física.'
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
              Há material com devolução já encaminhada ao setor responsável. Somente esses itens ficam bloqueados até a conferência; os demais continuam disponíveis para nova devolução.
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
                  Conferência obrigatória pelo setor responsável
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
                DEVOLUÇÃO JÁ ENCAMINHADA
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
                  : 'Enviar devolução'}
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
                                {obterDescricao(item)}
                              </strong>

                              <span>
                                {obterIdentificacao(item)}
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

                              <div className="cautela-usuario-novidade-acoes">
                                <button
                                  type="button"
                                  className="cautela-usuario-novidade-botao"
                                  onClick={() =>
                                    alternarNovidadeRecebimento(
                                      chave
                                    )
                                  }
                                >
                                  {obterNovidadeRecebimento(chave)
                                    ? obterNovidadeRecebimento(chave)?.aberta
                                      ? 'Fechar novidade'
                                      : 'Editar novidade'
                                    : 'Registrar novidade'}
                                </button>

                                {obterNovidadeRecebimento(chave) && (
                                  <>
                                    <span className="cautela-usuario-novidade-ok">
                                      ✓ Novidade registrada
                                    </span>

                                    <button
                                      type="button"
                                      className="cautela-usuario-novidade-remover"
                                      onClick={() =>
                                        removerNovidadeRecebimento(
                                          chave
                                        )
                                      }
                                    >
                                      Remover
                                    </button>
                                  </>
                                )}
                              </div>

                              {obterNovidadeRecebimento(chave)?.aberta && (
                                <div className="cautela-usuario-novidade-card">
                                  <div className="cautela-usuario-novidade-titulo">
                                    <span>REGISTRO DE NOVIDADE</span>
                                    <strong>
                                      {obterDescricao(item)}
                                    </strong>
                                  </div>

                                  <div className="cautela-usuario-novidade-grid">
                                    <label>
                                      Tipo

                                      <select
                                        value={
                                          obterNovidadeRecebimento(chave)?.tipo ||
                                          ''
                                        }
                                        onChange={(event) =>
                                          alterarNovidadeRecebimento(
                                            chave,
                                            'tipo',
                                            event.target.value,
                                            quantidadeReceber
                                          )
                                        }
                                      >
                                        <option value="">
                                          SELECIONE
                                        </option>
                                        <option value="AVARIA">
                                          AVARIA
                                        </option>
                                        <option value="DEFEITO">
                                          DEFEITO
                                        </option>
                                        <option value="MANUTENCAO_PREVENTIVA">
                                          MANUTENÇÃO PREVENTIVA
                                        </option>
                                        <option value="LIMPEZA">
                                          LIMPEZA NECESSÁRIA
                                        </option>
                                        <option value="EXTRAVIO_ACESSORIO">
                                          EXTRAVIO DE ACESSÓRIO
                                        </option>
                                        <option value="OUTRO">
                                          OUTRO
                                        </option>
                                      </select>

                                      {obterNovidadeRecebimento(chave)?.tipo && (
                                        <small
                                          style={{
                                            display: 'block',
                                            marginTop: 6,
                                            lineHeight: 1.35
                                          }}
                                        >
                                          Novidade selecionada. Confira a providência sugerida ao lado e altere se desejar.
                                        </small>
                                      )}
                                    </label>

                                    <label>
                                      Providência sugerida

                                      <select
                                        value={
                                          obterNovidadeRecebimento(chave)?.providencia ||
                                          'ANALISE'
                                        }
                                        onChange={(event) =>
                                          alterarNovidadeRecebimento(
                                            chave,
                                            'providencia',
                                            event.target.value,
                                            quantidadeReceber
                                          )
                                        }
                                      >
                                        <option value="ANALISE">
                                          ANÁLISE PELO SVDD/P4
                                        </option>
                                        <option value="MANUTENCAO">
                                          MANUTENÇÃO
                                        </option>
                                        <option value="BAIXA">
                                          AVALIAR BAIXA
                                        </option>
                                      </select>
                                    </label>

                                    {quantitativo && (
                                      <label>
                                        Quantidade com novidade

                                        <input
                                          type="number"
                                          min="1"
                                          max={quantidadeReceber}
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.quantidade_afetada ||
                                            1
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeRecebimento(
                                              chave,
                                              'quantidade_afetada',
                                              event.target.value,
                                              quantidadeReceber
                                            )
                                          }
                                        />
                                      </label>
                                    )}

                                    <label className="cautela-usuario-novidade-full">
                                      Descrição

                                      <textarea
                                        value={
                                          obterNovidadeRecebimento(chave)
                                            ?.descricao ||
                                          ''
                                        }
                                        onChange={(event) =>
                                          alterarNovidadeRecebimento(
                                            chave,
                                            'descricao',
                                            event.target.value,
                                            quantidadeReceber
                                          )
                                        }
                                        placeholder="DESCREVA O QUE FOI CONSTATADO NA CONFERÊNCIA"
                                      />
                                    </label>

                                    <label className="cautela-usuario-novidade-full">
                                      Fotos

                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        multiple
                                        onChange={(event) =>
                                          selecionarFotosNovidadeRecebimento(
                                            chave,
                                            event
                                          )
                                        }
                                      />

                                      <small>
                                        Cada foto pode ter no máximo 5 MB.
                                      </small>
                                    </label>
                                  </div>

                                  {(obterNovidadeRecebimento(chave)?.previews || [])
                                    .length > 0 && (
                                    <div className="cautela-usuario-novidade-fotos">
                                      {(obterNovidadeRecebimento(chave)?.previews || [])
                                        .map((preview, indice) => (
                                          <article
                                            key={preview.id}
                                            className="cautela-usuario-novidade-foto"
                                          >
                                            <a
                                              href={preview.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              title="Ampliar foto"
                                            >
                                              <img
                                                src={preview.url}
                                                alt={`Foto ${indice + 1} da novidade`}
                                              />
                                            </a>

                                            <div>
                                              <span>
                                                Foto {indice + 1}
                                              </span>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removerFotoNovidadeRecebimento(
                                                    chave,
                                                    indice
                                                  )
                                                }
                                              >
                                                Remover
                                              </button>
                                            </div>
                                          </article>
                                        ))}
                                    </div>
                                  )}
                                </div>
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
