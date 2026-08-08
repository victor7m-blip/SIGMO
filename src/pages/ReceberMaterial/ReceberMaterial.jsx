import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  listarTonfasEmServico
} from '../../services/tonfasMovimentacoesService'

import {
  receberCautelaTonfa
} from '../../services/tonfasService'

import {
  receberMateriais,
  LOCAL_RETORNO_PADRAO
} from '../../services/recebimentoService'

import {
  buscarDevolucaoPendentePolicial,
  confirmarItensDevolucao
} from '../../services/devolucoesPendentesService'

import RecebedorCard from '../PagarMaterial/components/RecebedorCard'
import CarrinhoMateriais from '../PagarMaterial/components/CarrinhoMateriais'

import '../PagarMaterial/PagarMaterial.css'
import './ReceberMaterial.css'

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
}

function somenteNumeros(valor) {
  return String(valor ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

function obterNomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    ''
  )
}

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function obterIdentificador(item) {
  return (
    item?.identificador ||
    item?.patrimonio ||
    item?.numero_patrimonio ||
    item?.numero_serie ||
    item?.serie ||
    item?.referencia_id ||
    item?.id ||
    'SEM IDENTIFICAÇÃO'
  )
}

function obterDescricao(item) {
  if (item?.descricao) {
    return item.descricao
  }

  const partes = [
    item?.tipo,
    item?.categoria,
    item?.marca,
    item?.modelo,
    item?.calibre
  ]
    .map((valor) =>
      String(valor ?? '').trim()
    )
    .filter(Boolean)

  return (
    partes.join(' ') ||
    'PATRIMÔNIO'
  )
}

function obterCategoria(item) {
  return normalizarTexto(
    item?.categoria ||
    item?.tipo ||
    item?.modulo ||
    'PATRIMÔNIO'
  )
}

function obterLocalOrigem(item) {
  return normalizarTexto(
    item?.local_origem ||
    item?.local_atual ||
    item?.local ||
    LOCAL_RETORNO_PADRAO
  )
}

function criarChaveItem(item) {
  if (
    item?.tipo_registro ===
    'TONFA_QUANTIDADE'
  ) {
    return String(
      item?.movimentacao_tonfa_id ||
      item?.id
    )
  }

  return String(
    item?.patrimonio_id ||
    item?.id ||
    item?.referencia_id ||
    obterIdentificador(item)
  )
}

function normalizarItem(item) {
  return {
    ...item,

    id:
      item?.id ||
      item?.patrimonio_id ||
      item?.referencia_id,

    patrimonio_id:
      item?.patrimonio_id ||
      item?.id,

    referencia_id:
      item?.referencia_id ||
      null,

    patrimonio:
      obterIdentificador(item),

    descricao:
      normalizarTexto(
        obterDescricao(item)
      ),

    categoria:
      obterCategoria(item),

    modulo:
      normalizarTexto(
        item?.modulo ||
        item?.tipo ||
        item?.categoria ||
        'PATRIMÔNIO'
      ),

    local_origem:
      obterLocalOrigem(item),

    local_atual:
      obterLocalOrigem(item),

    quantidade:
      Number(
        item?.quantidade ||
        1
      )
  }
}

export default function ReceberMaterial({
  user,
  onVoltar = null,
  onConcluido = null
}) {
  const [
    reEntregador,
    setReEntregador
  ] = useState('')

  const [
    fotosNovidade,
    setFotosNovidade
  ] = useState([])

  const [
    previewsFotosNovidade,
    setPreviewsFotosNovidade
  ] = useState([])
  const [
    policialEntregador,
    setPolicialEntregador
  ] = useState(null)

  const [
    patrimonios,
    setPatrimonios
  ] = useState([])

  const [
    devolucaoPendente,
    setDevolucaoPendente
  ] = useState(null)

  const [
    itensSelecionados,
    setItensSelecionados
  ] = useState([])

  const [
    busca,
    setBusca
  ] = useState('')

  const [
    documento,
    setDocumento
  ] = useState('')

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    registrarNovidade,
    setRegistrarNovidade
  ] = useState(false)

  const [
    tipoNovidade,
    setTipoNovidade
  ] = useState('')

  const [
    descricaoNovidade,
    setDescricaoNovidade
  ] = useState('')

  const [
    providenciaNovidade,
    setProvidenciaNovidade
  ] = useState('COFRE')

  const [
    localRetorno,
    setLocalRetorno
  ] = useState(
    LOCAL_RETORNO_PADRAO
  )

  const [
    carregandoCarga,
    setCarregandoCarga
  ] = useState(false)

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    mensagem,
    setMensagem
  ] = useState('')

  const nomeEntregador =
    obterNomePolicial(
      policialEntregador
    )

  function limparFotosNovidade() {
    previewsFotosNovidade.forEach(
      (preview) => {
        if (preview?.url) {
          URL.revokeObjectURL(
            preview.url
          )
        }
      }
    )

    setFotosNovidade([])
    setPreviewsFotosNovidade([])
  }

  function selecionarFotoNovidade(event) {
    const arquivos = Array.from(
      event.target.files || []
    )

    event.target.value = ''

    if (arquivos.length === 0) {
      return
    }

    const limiteBytes =
      5 * 1024 * 1024

    const arquivosInvalidos =
      arquivos.filter(
        (arquivo) =>
          !arquivo.type.startsWith(
            'image/'
          )
      )

    if (arquivosInvalidos.length > 0) {
      setErro(
        'Selecione somente arquivos de imagem.'
      )
      return
    }

    const arquivosGrandes =
      arquivos.filter(
        (arquivo) =>
          arquivo.size > limiteBytes
      )

    if (arquivosGrandes.length > 0) {
      setErro(
        'Cada foto deve possuir no máximo 5 MB.'
      )
      return
    }

    const novosPreviews =
      arquivos.map(
        (arquivo, indice) => ({
          id: `${Date.now()}-${indice}-${arquivo.name}`,
          nome: arquivo.name,
          url: URL.createObjectURL(
            arquivo
          )
        })
      )

    setFotosNovidade(
      (listaAtual) => [
        ...listaAtual,
        ...arquivos
      ]
    )

    setPreviewsFotosNovidade(
      (listaAtual) => [
        ...listaAtual,
        ...novosPreviews
      ]
    )

    setErro('')
    setMensagem('')
  }

  function removerFotoNovidade(indice) {
    setPreviewsFotosNovidade(
      (listaAtual) => {
        const preview =
          listaAtual[indice]

        if (preview?.url) {
          URL.revokeObjectURL(
            preview.url
          )
        }

        return listaAtual.filter(
          (_, posicao) =>
            posicao !== indice
        )
      }
    )

    setFotosNovidade(
      (listaAtual) =>
        listaAtual.filter(
          (_, posicao) =>
            posicao !== indice
        )
    )
  }

  const carregarCargaPatrimonial =
    useCallback(
      async () => {
        if (
          !policialEntregador ||
          reEntregador.length !== 6
        ) {
          setPatrimonios([])
          setItensSelecionados([])
          setDevolucaoPendente(null)
          return
        }

        try {
          setCarregandoCarga(true)
          setErro('')

          const policialId =
            policialEntregador?.id ||
            policialEntregador?.policial_id ||
            null

          const devolucao =
            await buscarDevolucaoPendentePolicial({
              policialId
            })

          if (!devolucao?.id) {
            setDevolucaoPendente(null)
            setPatrimonios([])
            setItensSelecionados([])
            setMensagem('Nenhuma devolução pendente para este policial.')
            return
          }

          const tonfasEmServico =
            await listarTonfasEmServico({
              re: reEntregador,
              policialId
            })

          const quantitativos =
            (tonfasEmServico ?? []).map(normalizarItem)

          if (devolucao?.id) {
            const itensPendentes =
              Array.isArray(devolucao.itens)
                ? devolucao.itens
                : []

            const lista = []
            const tonfasUsadas = new Set()

            for (const itemMov of itensPendentes) {
              const patrimonio = itemMov?.patrimonio || {}
              const patrimonioId =
                itemMov?.patrimonio_id ||
                patrimonio?.id ||
                null

              const tipoPatrimonio =
                normalizarTexto(
                  patrimonio?.tipo ||
                  itemMov?.tipo_patrimonio ||
                  ''
                )

              if (tipoPatrimonio === 'TONFA') {
                const tonfaId =
                  patrimonio?.referencia_id ||
                  null

                const candidato = quantitativos.find(
                  (item) =>
                    String(item?.tonfa_id || item?.referencia_id || '') ===
                      String(tonfaId || '') &&
                    !tonfasUsadas.has(
                      String(item?.movimentacao_tonfa_id || item?.id)
                    )
                )

                if (candidato) {
                  tonfasUsadas.add(
                    String(candidato?.movimentacao_tonfa_id || candidato?.id)
                  )

                  lista.push({
                    ...candidato,
                    quantidade: Math.min(
                      Number(candidato?.quantidade || 1),
                      Math.max(1, Number(itemMov?.quantidade || 1))
                    ),
                    devolucao_movimentacao_id: devolucao.id,
                    devolucao_item_id: itemMov.id
                  })
                }

                continue
              }

              lista.push(
                normalizarItem({
                  ...patrimonio,
                  id:
                    patrimonio?.id ||
                    patrimonioId,
                  patrimonio_id:
                    patrimonioId,
                  referencia_id:
                    patrimonio?.referencia_id ||
                    null,
                  patrimonio:
                    patrimonio?.identificador ||
                    patrimonio?.numero_patrimonio ||
                    patrimonio?.patrimonio ||
                    patrimonio?.numero_serie ||
                    patrimonio?.referencia_id ||
                    patrimonioId,
                  descricao:
                    patrimonio?.descricao ||
                    itemMov?.descricao ||
                    'PATRIMÔNIO',
                  categoria:
                    patrimonio?.tipo ||
                    itemMov?.tipo_patrimonio ||
                    'PATRIMÔNIO',
                  modulo:
                    patrimonio?.tipo ||
                    itemMov?.tipo_patrimonio ||
                    'PATRIMÔNIO',
                  local_origem: null,
                  local_atual:
                    patrimonio?.local_atual ||
                    'CAUTELA INDIVIDUAL',
                  status:
                    patrimonio?.status ||
                    'EM SERVIÇO',
                  quantidade:
                    Math.max(
                      1,
                      Number(itemMov?.quantidade || 1) || 1
                    ),
                  devolucao_movimentacao_id:
                    devolucao.id,
                  devolucao_item_id:
                    itemMov.id
                })
              )
            }

            setDevolucaoPendente(devolucao)
            setPatrimonios(lista)
            setItensSelecionados([])

            if (lista.length === 0) {
              setMensagem(
                'Existe uma devolução pendente, mas os itens não puderam ser conciliados com a carga atual. Atualize a tela e confira a movimentação.'
              )
            } else {
              setMensagem(
                `Devolução pendente localizada: ${lista.length} item(ns) apresentado(s) pelo usuário.`
              )
            }

            return
          }


        } catch (error) {
          console.error(
            'Erro ao carregar carga patrimonial:',
            error
          )

          setPatrimonios([])
          setItensSelecionados([])
          setDevolucaoPendente(null)

          setErro(
            error?.message ||
            'Não foi possível carregar a carga patrimonial.'
          )
        } finally {
          setCarregandoCarga(false)
        }
      },
      [
        nomeEntregador,
        policialEntregador,
        reEntregador
      ]
    )

  useEffect(() => {
    carregarCargaPatrimonial()
  }, [
    carregarCargaPatrimonial
  ])

  useEffect(() => {
    return () => {
      previewsFotosNovidade.forEach(
        (preview) => {
          if (preview?.url) {
            URL.revokeObjectURL(
              preview.url
            )
          }
        }
      )
    }
  }, [previewsFotosNovidade])

  const patrimoniosFiltrados =
    useMemo(() => {
      const termo =
        normalizarTexto(busca)

      if (!termo) {
        return patrimonios
      }

      return patrimonios.filter(
        (item) =>
          [
            item.patrimonio,
            item.descricao,
            item.categoria,
            item.modulo,
            item.local_atual,
            item.numero_serie,
            item.serie,
            item.status
          ].some((valor) =>
            normalizarTexto(
              valor
            ).includes(termo)
          )
      )
    }, [
      busca,
      patrimonios
    ])

  const todosSelecionados =
    patrimonios.length > 0 &&
    patrimonios.every(
      (item) =>
        itensSelecionados.some(
          (selecionado) =>
            criarChaveItem(
              selecionado
            ) ===
            criarChaveItem(item)
        )
    )

  function alterarRe(valor) {
    const re =
      somenteNumeros(valor)

    setReEntregador(re)
    setPolicialEntregador(null)
    setPatrimonios([])
    setItensSelecionados([])
    setDevolucaoPendente(null)
    setBusca('')
    setErro('')
    setMensagem('')
  }

  function selecionarEntregador(
    policial
  ) {
    setPolicialEntregador(
      policial
    )

    setPatrimonios([])
    setItensSelecionados([])
    setDevolucaoPendente(null)
    setBusca('')
    setErro('')
    setMensagem('')
  }

  function itemEstaSelecionado(item) {
    const chave =
      criarChaveItem(item)

    return itensSelecionados.some(
      (selecionado) =>
        criarChaveItem(
          selecionado
        ) === chave
    )
  }

  function adicionarItem(item) {
  if (itemEstaSelecionado(item)) {
    return
  }

  setItensSelecionados((listaAtual) => [
    ...listaAtual,
    {
      ...item,
      quantidade_receber: Number(item.quantidade || 1)
    }
  ])

  setErro('')
  setMensagem('')
}

  function removerItem(itemId) {
    setItensSelecionados(
      (listaAtual) =>
        listaAtual.filter(
          (item) =>
            String(item.id) !==
              String(itemId) &&
            String(
              item.patrimonio_id
            ) !== String(itemId)
        )
    )
  }

function alterarQuantidade(id, valor) {
  const quantidade = Number(valor)

  setItensSelecionados((lista) =>
    lista.map((item) => {
      if (String(item.id) !== String(id)) {
        return item
      }

      const maximo = Number(item.quantidade || 1)

      return {
        ...item,
        quantidade_receber: Math.max(
          1,
          Math.min(
            quantidade || 1,
            maximo
          )
        )
      }
    })
  )
}

  function alternarTodos() {
    if (todosSelecionados) {
      setItensSelecionados([])
      return
    }

    setItensSelecionados(
      patrimonios.map((item) => ({
        ...item,
        quantidade_receber: Number(item.quantidade || 1)
      }))
    )
  }

  function limpar() {
    setReEntregador('')
    setPolicialEntregador(null)
    setPatrimonios([])
    setItensSelecionados([])
    setDevolucaoPendente(null)
    setBusca('')
    setDocumento('')
    setObservacoes('')
    setRegistrarNovidade(false)
    setTipoNovidade('')
    setDescricaoNovidade('')
    setProvidenciaNovidade('COFRE')
    setLocalRetorno(
      LOCAL_RETORNO_PADRAO
    )
    limparFotosNovidade()
    setErro('')
    setMensagem('')
  }

const recebimentoEmAndamento = useRef(false)

async function confirmarRecebimento() {
  if (recebimentoEmAndamento.current) return

  if (!policialEntregador) {
    setErro(
      'Informe o RE de quem está entregando.'
    )
    return
  }

  if (reEntregador.length !== 6) {
    setErro(
      'O RE de quem está entregando deve possuir 6 dígitos.'
    )
    return
  }

  if (itensSelecionados.length === 0) {
    setErro(
      'Selecione pelo menos um patrimônio para receber.'
    )
    return
  }

  if (!localRetorno.trim()) {
    setErro(
      'Informe o local de retorno.'
    )
    return
  }

  if (
    registrarNovidade &&
    !tipoNovidade
  ) {
    setErro(
      'Selecione o tipo da novidade.'
    )
    return
  }

  if (
    registrarNovidade &&
    !descricaoNovidade.trim()
  ) {
    setErro(
      'Descreva a novidade registrada.'
    )
    return
  }

  recebimentoEmAndamento.current = true

  try {
    setSalvando(true)
    setErro('')
    setMensagem('')

      const novidadeRecebimento =
      registrarNovidade
        ? {
            tipo:
              normalizarTexto(
                tipoNovidade
              ),

            descricao:
              normalizarTexto(
                descricaoNovidade
              ),

            providencia:
              normalizarTexto(
                providenciaNovidade
              ),

            status:
              'PENDENTE',

            registrada_em:
              new Date().toISOString(),

            registrada_por_id:
              user?.id || null,

            registrada_por_nome:
              normalizarTexto(
                obterNomeUsuario(user)
              ),

            fotos:
              fotosNovidade,

            foto:
              fotosNovidade[0] ||
              null
          }
        : null

    const itensTonfa =
      itensSelecionados.filter(
        (item) =>
          item?.tipo_registro ===
          'TONFA_QUANTIDADE'
      )

    const itensIndividuais =
      itensSelecionados.filter(
        (item) =>
          item?.tipo_registro !==
          'TONFA_QUANTIDADE'
      )

    const resultadosIndividuais = []

    if (
      itensIndividuais.length > 0
    ) {
      const resultado =
        await receberMateriais({
          itens:
            itensIndividuais,

          entregadorRE:
            reEntregador,

          entregadorNome:
            nomeEntregador,

          localDestino:
            normalizarTexto(
              localRetorno
            ),

          documento:
            normalizarTexto(
              documento
            ),

          observacao:
            normalizarTexto(
              observacoes
            ),

          novidade:
            novidadeRecebimento,

          user
        })

      resultadosIndividuais.push(
        ...(
          resultado?.resultados ||
          []
        )
      )
    }

    const resultadosTonfas = []

    for (
      const item of itensTonfa
    ) {
      const resultado =
  await receberCautelaTonfa({
    movimentacaoId:
      item.movimentacao_tonfa_id,

    quantidade:
      item.quantidade_receber || 1,

    providencia:
      providenciaNovidade,

    observacoes:
      normalizarTexto(
        [
          observacoes,
          novidadeRecebimento
            ? `NOVIDADE: ${novidadeRecebimento.tipo} - ${novidadeRecebimento.descricao} | PROVIDÊNCIA: ${novidadeRecebimento.providencia}`
            : ''
        ]
          .filter(Boolean)
          .join(' | ')
      ),

    novidade:
      registrarNovidade
        ? {
            tipo:
              tipoNovidade,

            descricao:
              descricaoNovidade,

            fotos:
              fotosNovidade,

            foto:
              fotosNovidade[0] ||
              null,

            origem:
              'CAUTELA INDIVIDUAL',

            destino:
              providenciaNovidade,

            policial:
              policialEntregador
          }
        : null,

    user
  })

      resultadosTonfas.push({
        item,
        resultado
      })
    }

    let resultadoDevolucao = null

    if (devolucaoPendente?.id) {
      const itemIdsDevolucao = [
        ...new Set(
          itensSelecionados
            .map((item) => item?.devolucao_item_id)
            .filter(Boolean)
        )
      ]

      if (itemIdsDevolucao.length > 0) {
        resultadoDevolucao =
          await confirmarItensDevolucao({
            movimentacaoId: devolucaoPendente.id,
            itemIds: itemIdsDevolucao,
            user,
            observacao:
              normalizarTexto(observacoes) ||
              'ITENS DA DEVOLUÇÃO RECEBIDOS PELO SVDD.'
          })

        if (resultadoDevolucao?.finalizada) {
          setDevolucaoPendente(null)
        }
      }
    }

    const totalRecebido =
      itensIndividuais.length +
      itensTonfa.length

    const resultadoFinal = {
      total:
        totalRecebido,

      total_individuais:
        itensIndividuais.length,

      total_quantitativos:
        itensTonfa.length,

      resultados: [
        ...resultadosIndividuais,
        ...resultadosTonfas
      ],

      devolucao:
        resultadoDevolucao
    }

    setMensagem(
      resultadoDevolucao?.finalizada
        ? `Devolução concluída. ${totalRecebido} ${
            totalRecebido === 1
              ? 'registro recebido'
              : 'registros recebidos'
          } com sucesso.`
        : `${totalRecebido} ${
            totalRecebido === 1
              ? 'registro recebido'
              : 'registros recebidos'
          } com sucesso.`
    )

    const chavesItensRecebidos =
      new Set(
        itensSelecionados.map(
          criarChaveItem
        )
      )

    setPatrimonios(
      (listaAtual) =>
        listaAtual.filter(
          (item) =>
            !chavesItensRecebidos.has(
              criarChaveItem(item)
            )
        )
    )

    setItensSelecionados([])
    setBusca('')
    setDocumento('')
    setObservacoes('')
    setRegistrarNovidade(false)
    setTipoNovidade('')
    setDescricaoNovidade('')
    setProvidenciaNovidade('COFRE')
    limparFotosNovidade()
    

    onConcluido?.(
      resultadoFinal
    )
  } catch (error) {
   console.error('Erro ao receber materiais:', {
  code: error?.code,
  message: error?.message,
  details: error?.details,
  hint: error?.hint,
  error
})

    setErro(
      error?.message ||
      'Não foi possível concluir o recebimento.'
    )
 } finally {
  recebimentoEmAndamento.current = false
  setSalvando(false)
}
}

  return (
    <main className="pagar-material-page">
      <header className="pagar-material-header">
        <div>
          <span className="pagar-material-kicker">
            SIGMO • MOVIMENTAÇÃO
          </span>

          <h1>
            Receber Material
          </h1>

          <p>
            Identifique quem está devolvendo,
            selecione os patrimônios e confirme
            o retorno à reserva.
          </p>
        </div>

        <div className="pagar-material-operador">
          <span>
            Operador responsável
          </span>

          <strong>
            {obterNomeUsuario(user)}
          </strong>
        </div>
      </header>

      {typeof onVoltar ===
        'function' && (
        <div className="pagar-material-top-actions">
          <button
            type="button"
            className="pagar-material-refresh"
            onClick={onVoltar}
            disabled={salvando}
          >
            Voltar
          </button>
        </div>
      )}

      {erro && (
        <div className="pagar-material-feedback pagar-material-feedback-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="pagar-material-feedback pagar-material-feedback-success">
          {mensagem}
        </div>
      )}

      <section className="pagar-material-layout">
        <div className="pagar-material-main">
          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>
                  ETAPA 1
                </span>

                <h2>
                  Identificar quem está entregando
                </h2>
              </div>

              <span className="pagar-material-status">
                {policialEntregador
                  ? 'IDENTIFICADO'
                  : 'AGUARDANDO RE'}
              </span>
            </div>

            <RecebedorCard
              re={reEntregador}
              onChangeRE={
                alterarRe
              }
              onSelecionado={
                selecionarEntregador
              }
            />

            <div className="pagar-material-form-grid pagar-material-form-grid-spaced">
              <label>
                Local de retorno

                <input
                  type="text"
                  value={
                    localRetorno
                  }
                  onChange={(event) =>
                    setLocalRetorno(
                      normalizarTexto(
                        event.target.value
                      )
                    )
                  }
                  placeholder="RESERVA DE MATERIAL"
                />
              </label>

              <label>
                Documento

                <input
                  type="text"
                  value={documento}
                  onChange={(event) =>
                    setDocumento(
                      normalizarTexto(
                        event.target.value
                      )
                    )
                  }
                  placeholder="NÚMERO OU REFERÊNCIA"
                />
              </label>

              <label className="pagar-material-field-full">
                Observações

                <textarea
  value={observacoes}
  onChange={(event) =>
    setObservacoes(
      event.target.value.toUpperCase()
    )
  }
  placeholder="INFORMAÇÕES ADICIONAIS SOBRE O RECEBIMENTO"
/>
              </label>
            </div>
          </section>

          {devolucaoPendente?.id && (
            <div className="pagar-material-feedback pagar-material-feedback-success">
              DEVOLUÇÃO PENDENTE LOCALIZADA • somente os itens selecionados pelo usuário estão sendo exibidos.
            </div>
          )}

          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>
                  ETAPA 2
                </span>

                <h2>
                  Selecionar patrimônios
                </h2>
              </div>

              <div className="pagar-material-results-head">
                <strong className="pagar-material-count">
                  {
                    patrimoniosFiltrados.length
                  }{' '}
                  encontrados
                </strong>

                <button
                  type="button"
                  className="pagar-material-refresh"
                  disabled={
                    carregandoCarga ||
                    !policialEntregador
                  }
                  onClick={
                    carregarCargaPatrimonial
                  }
                >
                  {carregandoCarga
                    ? 'Atualizando...'
                    : 'Atualizar'}
                </button>
              </div>
            </div>

            <div className="pagar-material-search">
              <input
                type="text"
                value={busca}
                onChange={(event) =>
                  setBusca(
                    normalizarTexto(
                      event.target.value
                    )
                  )
                }
                placeholder="PESQUISAR PATRIMÔNIO, SÉRIE, DESCRIÇÃO OU CATEGORIA"
                disabled={
                  !policialEntregador
                }
              />

              <button
                type="button"
                onClick={alternarTodos}
                disabled={
                  patrimonios.length === 0
                }
              >
                {todosSelecionados
                  ? 'Desmarcar todos'
                  : 'Selecionar todos'}
              </button>
            </div>

            <div className="pagar-material-table-wrap">
              <table className="pagar-material-table">
                <thead>
                  <tr>
                    <th>
                      Patrimônio
                    </th>

                    <th>
                      Descrição
                    </th>

                    <th>
                      Categoria
                    </th>

                    <th>
                      Local atual
                    </th>

                    <th>
                      Status
                    </th>

                    <th aria-label="Ações" />
                  </tr>
                </thead>

                <tbody>
                  {carregandoCarga && (
                    <tr>
                      <td
                        colSpan={6}
                        className="pagar-material-table-empty"
                      >
                        Carregando carga patrimonial...
                      </td>
                    </tr>
                  )}

                  {!carregandoCarga &&
                    !policialEntregador && (
                    <tr>
                      <td
                        colSpan={6}
                        className="pagar-material-table-empty"
                      >
                        Informe o RE de quem está entregando.
                      </td>
                    </tr>
                  )}

                  {!carregandoCarga &&
                    policialEntregador &&
                    patrimoniosFiltrados.length ===
                      0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="pagar-material-table-empty"
                      >
                        Nenhum patrimônio localizado para este policial.
                      </td>
                    </tr>
                  )}

                  {!carregandoCarga &&
                    patrimoniosFiltrados.map(
                      (item) => {
                        const selecionado =
                          itemEstaSelecionado(
                            item
                          )

                        return (
                          <tr
                            key={
                              criarChaveItem(
                                item
                              )
                            }
                          >
                            <td>
                              <strong>
                                {
                                  item.patrimonio
                                }
                              </strong>
                            </td>

                            <td>
  {item.descricao}

  {item.tipo_registro ===
    'TONFA_QUANTIDADE' && (
    <small
      style={{
        display: 'block',
        marginTop: '4px'
      }}
    >
      Quantidade: {item.quantidade}
    </small>
  )}
</td>

                            <td>
                              {
                                item.categoria
                              }
                            </td>

                            <td>
                              {
                                item.local_atual
                              }
                            </td>

                            <td>
                              <span className="pagar-material-badge is-warning">
                                {item.status ||
                                  'CAUTELADO'}
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="pagar-material-add"
                                disabled={
                                  selecionado
                                }
                                onClick={() =>
                                  adicionarItem(
                                    item
                                  )
                                }
                              >
                                {selecionado
                                  ? 'Adicionado'
                                  : 'Adicionar'}
                              </button>
                            </td>
                          </tr>
                        )
                      }
                    )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="pagar-material-summary">
          <section className="pagar-material-card pagar-material-summary-card">
            <div className="pagar-material-card-header">
              <div>
                <span>
                  ETAPA 3
                </span>

                <h2>
                  Resumo do recebimento
                </h2>
              </div>
            </div>

            <div className="pagar-material-summary-data">
              <div>
                <span>
                  Entregador
                </span>

                <strong>
                  {nomeEntregador ||
                    'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>
                  RE
                </span>

                <strong>
                  {reEntregador ||
                    'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>
                  Retorno
                </span>

                <strong>
                  {localRetorno ||
                    'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>
                  Total de itens
                </span>

                <strong>
                  {
                    itensSelecionados.length
                  }
                </strong>
              </div>
            </div>

            <CarrinhoMateriais
  itens={
    itensSelecionados
  }
  onRemover={
    removerItem
  }
  onQuantidadeChange={
    alterarQuantidade
  }
/>

            <div className="pagar-material-novidade">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    registrarNovidade
                  }
                  onChange={(event) => {
                    const marcado =
                      event.target.checked

                    setRegistrarNovidade(
                      marcado
                    )

                    if (!marcado) {
                      setTipoNovidade('')
                      setDescricaoNovidade('')
                      setProvidenciaNovidade('COFRE')
                      limparFotosNovidade()
                    }
                  }}
                />

                Registrar novidade neste recebimento
              </label>

               

              {registrarNovidade && (
                <div
                  className="pagar-material-form-grid"
                  style={{
                    marginTop: '16px'
                  }}
                >
                  <label>
                    Tipo da novidade

                    <select
                      value={tipoNovidade}
                      onChange={(event) =>
                        setTipoNovidade(
                          event.target.value
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
                  </label>

                  <label>
                    Providência

                    <select
                      value={
                        providenciaNovidade
                      }
                      onChange={(event) =>
                        setProvidenciaNovidade(
                          event.target.value
                        )
                      }
                    >
                      <option value="COFRE">
                        RETORNAR AO COFRE
                      </option>
                      <option value="MANUTENCAO">
                        ENVIAR PARA MANUTENÇÃO
                      </option>
                      <option value="BAIXA">
                        SOLICITAR BAIXA PATRIMONIAL
                      </option>
                    </select>
                  </label>

                  <label className="pagar-material-field-full">
                    Descrição da novidade

                    <textarea
                      value={
                        descricaoNovidade
                      }
                      onChange={(event) =>
                        setDescricaoNovidade(
                          event.target.value.toUpperCase()
                        )
                      }
                      placeholder="DESCREVA A AVARIA, DEFEITO OU OUTRA SITUAÇÃO ENCONTRADA"
                    />
                  </label>

                  <label className="pagar-material-field-full">
                    Fotos da novidade

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={
                        selecionarFotoNovidade
                      }
                    />

                    <small>
                      Tire fotos ou selecione várias imagens. Cada arquivo pode ter no máximo 5 MB.
                    </small>

                    {previewsFotosNovidade.length > 0 && (
                      <div className="pagar-material-photo-preview">
                        {previewsFotosNovidade.map(
                          (preview, indice) => (
                            <div
                              className="pagar-material-photo-item"
                              key={preview.id}
                            >
                              <img
                                src={preview.url}
                                alt={`Pré-visualização ${indice + 1} da novidade`}
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  removerFotoNovidade(
                                    indice
                                  )
                                }
                              >
                                Remover foto
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </label>
                </div>
              )}
            </div>

            <div className="pagar-material-actions">
              <button
                type="button"
                className="pagar-material-cancel"
                disabled={salvando}
                onClick={limpar}
              >
                Limpar
              </button>

              <button
                type="button"
                className="pagar-material-confirm"
                disabled={
                  salvando ||
                  !policialEntregador ||
                  itensSelecionados.length === 0
                }
                onClick={
                  confirmarRecebimento
                }
              >
                {salvando
                  ? 'Recebendo...'
                  : 'Confirmar recebimento'}
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}