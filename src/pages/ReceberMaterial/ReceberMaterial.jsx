import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { supabase } from '../../services/supabaseClient'

import {
  listarTonfasEmServico
} from '../../services/tonfasMovimentacoesService'

import {
  receberCautelaTonfa
} from '../../services/tonfasService'

import {
  listarEntregasHTAtivas,
  receberDevolucaoHT
} from '../../services/htsOperacoesService'

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

function ehUuidValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(valor ?? '').trim())
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


async function buscarNovidadesPendentesPatrimonios(itens = []) {
  const patrimonioIds = [
    ...new Set(
      (itens || [])
        .map((item) => item?.patrimonio_id || item?.id)
        .filter(ehUuidValido)
        .map(String)
    )
  ]

  if (patrimonioIds.length === 0) {
    return new Map()
  }

  const { data: novidades, error } = await supabase
    .from('sigmo_patrimonio_novidades')
    .select('*')
    .in('patrimonio_id', patrimonioIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Não foi possível carregar as novidades patrimoniais pendentes:', error)
    return new Map()
  }

  const ids = (novidades || [])
    .map((item) => item?.id)
    .filter(Boolean)

  let fotos = []

  if (ids.length > 0) {
    const { data: fotosData, error: fotosError } = await supabase
      .from('sigmo_patrimonio_novidades_fotos')
      .select('*')
      .in('novidade_id', ids)
      .order('principal', { ascending: false })
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true })

    if (fotosError) {
      console.warn('Não foi possível carregar as fotos das novidades patrimoniais:', fotosError)
    } else {
      fotos = fotosData || []
    }
  }

  const fotosPorNovidade = new Map()

  for (const foto of fotos) {
    const chave = String(foto?.novidade_id || '')
    if (!chave) continue
    if (!fotosPorNovidade.has(chave)) fotosPorNovidade.set(chave, [])
    fotosPorNovidade.get(chave).push(foto)
  }

  const porPatrimonio = new Map()
  const prioridades = [
    'REGISTRADA',
    'PENDENTE',
    'EM ANALISE',
    'EM_ANÁLISE',
    'EM_ANALISE'
  ]

  for (const novidade of novidades || []) {
    const chave = String(novidade?.patrimonio_id || '')
    if (!chave) continue

    const atual = porPatrimonio.get(chave)
    const statusAtual =
      normalizarTexto(atual?.status || '')
    const statusNovo =
      normalizarTexto(novidade?.status || '')

    const novaEhPrioritaria =
      prioridades.includes(statusNovo)
    const atualEhPrioritaria =
      prioridades.includes(statusAtual)

    if (
      atual &&
      (
        atualEhPrioritaria ||
        !novaEhPrioritaria
      )
    ) {
      continue
    }

    porPatrimonio.set(chave, {
      ...novidade,
      fotos: fotosPorNovidade.get(String(novidade?.id || '')) || []
    })
  }

  return porPatrimonio
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
                  local_origem:
                    devolucao?.destino_local ||
                    null,
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

            const novidadesPorPatrimonio =
              await buscarNovidadesPendentesPatrimonios(lista)

            const listaComNovidades =
              lista.map((item) => ({
                ...item,
                novidade_pendente:
                  novidadesPorPatrimonio.get(
                    String(item?.patrimonio_id || item?.id || '')
                  ) || null
              }))

            setDevolucaoPendente(devolucao)
            setPatrimonios(listaComNovidades)
            setItensSelecionados([])

            if (listaComNovidades.length === 0) {
              setMensagem(
                'Existe uma devolução pendente, mas os itens não puderam ser conciliados com a carga atual. Atualize a tela e confira a movimentação.'
              )
            } else {
              setMensagem(
                `Devolução pendente localizada: ${listaComNovidades.length} item(ns) apresentado(s) pelo usuário.`
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

  const possuiNovidadeSelecionada =
    itensSelecionados.some(
      (item) =>
        Boolean(
          String(
            item?.novidade?.tipo ||
            ''
          ).trim()
        )
    )

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

  function chaveItemPorId(item) {
    return String(
      item?.id ||
      item?.patrimonio_id ||
      item?.referencia_id ||
      ''
    )
  }

  function atualizarItemSelecionado(
    itemId,
    atualizador
  ) {
    setItensSelecionados(
      (listaAtual) =>
        listaAtual.map((item) => {
          if (
            chaveItemPorId(item) !==
            String(itemId)
          ) {
            return item
          }

          return atualizador(item)
        })
    )
  }

  function alternarNovidadeItem(itemId) {
    atualizarItemSelecionado(
      itemId,
      (item) => ({
        ...item,

        novidade_aberta:
          !item.novidade_aberta,

        novidade:
          item.novidade || {
            tipo: '',
            descricao: '',
            providencia: '',
            quantidade_afetada: 1,
            fotos: [],
            previews: []
          }
      })
    )

    setErro('')
    setMensagem('')
  }

  function alterarNovidadeItem(
    itemId,
    campo,
    valor
  ) {
    atualizarItemSelecionado(
      itemId,
      (item) => {
        const novidadeAtual =
          item.novidade || {
            tipo: '',
            descricao: '',
            providencia: '',
            quantidade_afetada: 1,
            fotos: [],
            previews: []
          }

        let novoValor = valor

        if (
          campo === 'tipo' ||
          campo === 'providencia'
        ) {
          novoValor =
            normalizarTexto(valor)
        }

        if (campo === 'descricao') {
          novoValor =
            String(valor ?? '')
              .toUpperCase()
        }

        if (
          campo === 'quantidade_afetada'
        ) {
          const maximo =
            Math.max(
              1,
              Number(
                item.quantidade_receber ??
                item.quantidade ??
                1
              )
            )

          novoValor =
            Math.max(
              1,
              Math.min(
                Number(valor) || 1,
                maximo
              )
            )
        }

        return {
          ...item,

          novidade: {
            ...novidadeAtual,
            [campo]: novoValor
          }
        }
      }
    )

    setErro('')
    setMensagem('')
  }

  function selecionarFotosNovidadeItem(
    itemId,
    event
  ) {
    const arquivos =
      Array.from(
        event.target.files ||
        []
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
          arquivo.size >
          limiteBytes
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
          nome: arquivo.name,
          url:
            URL.createObjectURL(
              arquivo
            )
        })
      )

    atualizarItemSelecionado(
      itemId,
      (item) => ({
        ...item,

        novidade: {
          ...(item.novidade || {
            tipo: '',
            descricao: '',
            providencia: 'COFRE',
            quantidade_afetada: 1
          }),

          fotos: [
            ...(
              item.novidade?.fotos ||
              []
            ),
            ...arquivos
          ],

          previews: [
            ...(
              item.novidade?.previews ||
              []
            ),
            ...novosPreviews
          ]
        }
      })
    )

    setErro('')
    setMensagem('')
  }

  function removerFotoNovidadeItem(
    itemId,
    indice
  ) {
    atualizarItemSelecionado(
      itemId,
      (item) => {
        const previews = [
          ...(
            item.novidade?.previews ||
            []
          )
        ]

        const preview =
          previews[indice]

        if (preview?.url) {
          URL.revokeObjectURL(
            preview.url
          )
        }

        previews.splice(
          indice,
          1
        )

        const fotos = [
          ...(
            item.novidade?.fotos ||
            []
          )
        ]

        fotos.splice(
          indice,
          1
        )

        return {
          ...item,

          novidade: {
            ...(item.novidade || {}),
            fotos,
            previews
          }
        }
      }
    )
  }

  function removerNovidadeItem(
    itemId
  ) {
    atualizarItemSelecionado(
      itemId,
      (item) => {
        ;(
          item.novidade?.previews ||
          []
        ).forEach((preview) => {
          if (preview?.url) {
            URL.revokeObjectURL(
              preview.url
            )
          }
        })

        const {
          novidade,
          novidade_aberta,
          ...restante
        } = item

        return restante
      }
    )

    setErro('')
    setMensagem('')
  }

  function prepararNovidadeItem(
    item
  ) {
    const novidade =
      item?.novidade

    if (!novidade) {
      return null
    }

    const possuiConteudo =
      Boolean(
        novidade.tipo ||
        novidade.descricao ||
        (
          novidade.fotos ||
          []
        ).length
      )

    if (!possuiConteudo) {
      return null
    }

    return {
      novidade_id:
        novidade.novidade_id ||
        novidade.id ||
        null,

      existente:
        Boolean(
          novidade.existente ||
          novidade.novidade_id
        ),

      tipo:
        normalizarTexto(
          novidade.tipo
        ),

      descricao:
        normalizarTexto(
          novidade.descricao
        ),

      providencia:
        normalizarTexto(
          novidade.providencia ||
          'COFRE'
        ),

      quantidade_afetada:
        item?.tipo_registro ===
          'TONFA_QUANTIDADE'
          ? Math.max(
              1,
              Math.min(
                Number(
                  novidade.quantidade_afetada ||
                  1
                ),
                Number(
                  item.quantidade_receber ||
                  item.quantidade ||
                  1
                )
              )
            )
          : 1,

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
        novidade.fotos || [],

      foto:
        novidade.fotos?.[0] ||
        null
    }
  }

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

  const novidadePendente =
    item?.novidade_pendente || null

  setItensSelecionados((listaAtual) => [
    ...listaAtual,
    {
      ...item,
      quantidade_receber: Number(item.quantidade || 1),
      novidade_aberta:
        Boolean(novidadePendente),
      novidade:
        novidadePendente?.id
          ? {
              id: novidadePendente.id,
              novidade_id: novidadePendente.id,
              existente: true,
              tipo: normalizarTexto(
                novidadePendente.titulo || ''
              ),
              descricao: normalizarTexto(
                novidadePendente.descricao || ''
              ),
              providencia: '',
              quantidade_afetada: 1,
              fotos: [],
              previews: []
            }
          : item?.novidade
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
    itensSelecionados.forEach(
      (item) => {
        ;(
          item.novidade?.previews ||
          []
        ).forEach((preview) => {
          if (preview?.url) {
            URL.revokeObjectURL(
              preview.url
            )
          }
        })
      }
    )

    setReEntregador('')
    setPolicialEntregador(null)
    setPatrimonios([])
    setItensSelecionados([])
    setDevolucaoPendente(null)
    setBusca('')
    setDocumento('')
    setObservacoes('')
    setLocalRetorno(
      LOCAL_RETORNO_PADRAO
    )
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

  for (const item of itensSelecionados) {
    if (
      item?.novidade_pendente &&
      !normalizarTexto(item?.novidade?.providencia)
    ) {
      setErro(
        `O patrimônio ${obterIdentificador(item)} possui novidade registrada pelo usuário. Analise a ocorrência e selecione a providência antes de confirmar o recebimento.`
      )
      return
    }

    const novidade =
      prepararNovidadeItem(item)

    if (!novidade) {
      continue
    }

    if (!novidade.tipo) {
      setErro(
        `Selecione o tipo da novidade de ${obterIdentificador(item)}.`
      )
      return
    }

    if (!novidade.descricao) {
      setErro(
        `Descreva a novidade de ${obterIdentificador(item)}.`
      )
      return
    }
  }

  recebimentoEmAndamento.current = true

  try {
    setSalvando(true)
    setErro('')
    setMensagem('')

    const itensTonfa =
      itensSelecionados.filter(
        (item) =>
          item?.tipo_registro ===
          'TONFA_QUANTIDADE'
      )

    const entregasHTAtivas =
      await listarEntregasHTAtivas()

    function localizarMovimentacaoHT(item) {
      const referenciaItem =
        String(
          item?.referencia_id ||
          ''
        )

      const patrimonioItem =
        String(
          item?.patrimonio_id ||
          item?.id ||
          ''
        )

      return (
        (entregasHTAtivas || []).find(
          (mov) => {
            const dados =
              mov?.dados ||
              mov?.metadata?.dados_engine ||
              {}

            const referenciaMov =
              String(
                dados?.ht_id ||
                dados?.referencia_id ||
                mov?.metadata?.patrimonio?.referencia_id ||
                ''
              )

            const patrimonioMov =
              String(
                mov?.patrimonio_id ||
                mov?.patrimonioId ||
                ''
              )

            return (
              (
                referenciaItem &&
                referenciaMov ===
                  referenciaItem
              ) ||
              (
                patrimonioItem &&
                patrimonioMov ===
                  patrimonioItem
              )
            )
          }
        ) || null
      )
    }

    const itensHT =
      itensSelecionados.filter(
        (item) =>
          item?.tipo_registro !==
            'TONFA_QUANTIDADE' &&
          Boolean(
            localizarMovimentacaoHT(item)
          )
      )

    const chavesHT =
      new Set(
        itensHT.map(
          criarChaveItem
        )
      )

    const itensIndividuais =
      itensSelecionados.filter(
        (item) =>
          item?.tipo_registro !==
            'TONFA_QUANTIDADE' &&
          !chavesHT.has(
            criarChaveItem(item)
          )
      )

    const resultadosIndividuais = []
    const resultadosHT = []

    if (
      itensHT.length > 0
    ) {
      const movimentacoesHT = []

      for (const item of itensHT) {
        const movimentacao =
          localizarMovimentacaoHT(item)

        if (!movimentacao?.id) {
          throw new Error(
            `A cautela ativa do HT ${obterIdentificador(item)} não foi localizada. Atualize a tela e tente novamente.`
          )
        }

        movimentacoesHT.push(
          movimentacao
        )
      }

      const recebidosHT =
        await receberDevolucaoHT({
          movimentacoes:
            movimentacoesHT,

          destinoCodigo:
            'SVDD',

          observacoes:
            normalizarTexto(
              [
                observacoes,
                ...itensHT
                  .map((item) => {
                    const novidade =
                      prepararNovidadeItem(
                        item
                      )

                    return novidade
                      ? `NOVIDADE ${obterIdentificador(item)}: ${novidade.tipo} - ${novidade.descricao} | PROVIDÊNCIA: ${novidade.providencia}`
                      : ''
                  })
                  .filter(Boolean)
              ]
                .filter(Boolean)
                .join(' | ')
            ) ||
            'DEVOLUÇÃO DE HT RECEBIDA PELO SVDD.',

          user
        })

      resultadosHT.push(
        ...(
          recebidosHT || []
        )
      )
    }

    if (
      itensIndividuais.length > 0
    ) {
      for (
        const item of
        itensIndividuais
      ) {
        const novidadeItem =
          prepararNovidadeItem(
            item
          )

        const resultado =
          await receberMateriais({
            itens: [item],

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
              novidadeItem,

            user
          })

        resultadosIndividuais.push(
          ...(
            resultado?.resultados ||
            []
          )
        )
      }
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
      prepararNovidadeItem(item)
        ?.providencia ||
      'COFRE',

    observacoes:
      normalizarTexto(
        [
          observacoes,
          prepararNovidadeItem(item)
            ? `NOVIDADE: ${prepararNovidadeItem(item).tipo} - ${prepararNovidadeItem(item).descricao} | PROVIDÊNCIA: ${prepararNovidadeItem(item).providencia} | QUANTIDADE AFETADA: ${prepararNovidadeItem(item).quantidade_afetada}`
            : ''
        ]
          .filter(Boolean)
          .join(' | ')
      ),

    novidade:
      prepararNovidadeItem(item)
        ? {
            ...prepararNovidadeItem(item),

            origem:
              'CAUTELA INDIVIDUAL',

            destino:
              prepararNovidadeItem(item)
                .providencia,

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
      itensHT.length +
      itensTonfa.length

    const resultadoFinal = {
      total:
        totalRecebido,

      total_individuais:
        itensIndividuais.length,

      total_ht:
        itensHT.length,

      total_quantitativos:
        itensTonfa.length,

      resultados: [
        ...resultadosIndividuais,
        ...resultadosHT,
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

    itensSelecionados.forEach(
      (item) => {
        ;(
          item.novidade?.previews ||
          []
        ).forEach((preview) => {
          if (preview?.url) {
            URL.revokeObjectURL(
              preview.url
            )
          }
        })
      }
    )

    setItensSelecionados([])
    setBusca('')
    setDocumento('')
    setObservacoes('')
    

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
                  readOnly
                  aria-readonly="true"
                  title="O local de retorno é definido automaticamente pelo SIGMO."
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

  {item?.novidade_pendente && (
    <div
      style={{
        marginTop: '8px',
        padding: '8px 10px',
        border: '1px solid #f0b429',
        borderRadius: '8px',
        background: '#fff8e6'
      }}
    >
      <strong style={{ display: 'block' }}>
        NOVIDADE REGISTRADA PELO USUÁRIO
      </strong>

      <small style={{ display: 'block', marginTop: '3px' }}>
        {normalizarTexto(item.novidade_pendente.titulo || 'NOVIDADE')}
        {item.novidade_pendente.descricao
          ? ` • ${normalizarTexto(item.novidade_pendente.descricao)}`
          : ''}
      </small>

      {(item.novidade_pendente.fotos || []).length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginTop: '7px'
          }}
        >
          {item.novidade_pendente.fotos.map((foto) => (
            <a
              key={foto.id}
              href={foto.foto_url}
              target="_blank"
              rel="noreferrer"
              title="Ampliar foto da novidade"
            >
              <img
                src={foto.foto_url}
                alt="Foto da novidade"
                style={{
                  width: '58px',
                  height: '58px',
                  objectFit: 'cover',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1'
                }}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )}

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

            {possuiNovidadeSelecionada && (
              <div
                className="pagar-material-feedback pagar-material-feedback-success"
                style={{
                  marginBottom: '12px'
                }}
              >
                Novidade selecionada. Se necessário, escolha também a providência correspondente antes de confirmar o recebimento.
              </div>
            )}

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
              onAlternarNovidade={
                alternarNovidadeItem
              }
              onNovidadeChange={
                alterarNovidadeItem
              }
              onSelecionarFotosNovidade={
                selecionarFotosNovidadeItem
              }
              onRemoverFotoNovidade={
                removerFotoNovidadeItem
              }
              onRemoverNovidade={
                removerNovidadeItem
              }
            />

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