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

import {
  listarCargasPermanentesPendentesPolicial,
  listarCautelasPendentesPolicial,
  receberCargaPermanenteMunicao,
  receberCautelaMunicaoPolicial
} from '../../services/municoesMovimentacoesService'

import {
  listarManutencoes
} from '../../services/manutencoesService'

import {
  carregarMapaEmElaboracao,
  listarCautelasMapaForca
} from '../../services/mapaForcaService'

import {
  ORIGENS_NOVIDADE_VTR,
  SEVERIDADES_NOVIDADE_VTR,
  enviarFotosOcorrenciaRiv,
  obterRivResumo,
  registrarOcorrenciaRiv
} from '../../services/viaturasRivService'

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

function obterPrazoTurno(item) {
  return (
    item?.fim_turno_servico ||
    item?.dados?.fim_turno_servico ||
    null
  )
}

function turnoVencido(item) {
  const prazo = obterPrazoTurno(item)

  if (!prazo) return false

  const data = new Date(prazo)

  if (Number.isNaN(data.getTime())) {
    return false
  }

  return data.getTime() < Date.now()
}

function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function itemEhViatura(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tipo_patrimonio,
    item?.tabela_origem
  ].map(normalizar)

  return (
    Boolean(item?.viatura_id) ||
    campos.includes('viatura') ||
    campos.includes('viaturas') ||
    campos.includes('sigmo_viaturas')
  )
}

function montarViaturaMapaForca(item, cautelaMapa) {
  const viaturaId =
    item?.viatura_id ||
    item?.referencia_id ||
    item?.id ||
    null

  if (!viaturaId) {
    return null
  }

  return {
    ...item,
    id: `VIATURA-MAPA-${viaturaId}`,
    patrimonio_id: null,
    referencia_id: viaturaId,
    viatura_id: viaturaId,
    tipo_registro: 'VIATURA_MAPA_FORCA',
    modulo: 'VIATURA',
    tipo: 'VIATURA',
    categoria: 'VIATURA',
    tabela_origem: 'sigmo_viaturas',
    descricao:
      item?.descricao ||
      `VIATURA ${item?.prefixo || ''}`.trim(),
    patrimonio:
      item?.prefixo ||
      item?.placa ||
      item?.modelo ||
      'VIATURA',
    identificador:
      item?.prefixo ||
      item?.placa ||
      'VIATURA',
    quantidade: 1,
    item_especial_mapa_forca: true,
    cautela_mapa_forca_id:
      cautelaMapa?.id || null,
    us_id:
      cautelaMapa?.us_id || null
  }
}

function policialCorrespondeCautelaMapa(user, cautela) {
  const idsUsuario = [
    user?.policial_id,
    user?.id_policial,
    user?.policial?.id,
    user?.id
  ]
    .filter(Boolean)
    .map(String)

  const reUsuario = String(
    user?.re ||
    user?.policial?.re ||
    ''
  )
    .replace(/[^0-9A-Z]/gi, '')
    .slice(0, 6)

  const idCautela =
    String(cautela?.policial_id || '')

  const reCautela =
    String(cautela?.policial_re || '')
      .replace(/[^0-9A-Z]/gi, '')
      .slice(0, 6)

  return (
    (idCautela && idsUsuario.includes(idCautela)) ||
    (reUsuario && reCautela && reUsuario === reCautela)
  )
}

async function listarCautelasMapaUsuario(user) {
  try {
    const mapaAtual =
      await carregarMapaEmElaboracao()

    if (!mapaAtual?.mapa?.id) {
      return []
    }

    const cautelas =
      await listarCautelasMapaForca({
        mapaId: mapaAtual.mapa.id
      })

    return (cautelas || []).filter(
      (cautela) =>
        cautela?.ativa !== false &&
        policialCorrespondeCautelaMapa(
          user,
          cautela
        )
    )
  } catch (error) {
    console.warn(
      'Não foi possível carregar as viaturas vinculadas pelo Mapa Força:',
      error
    )

    return []
  }
}


function obterDescricao(item) {
  const descricaoOriginal = String(
    item?.descricao ||
    item?.nome ||
    item?.tipo ||
    item?.categoria ||
    item?.patrimonio_descricao ||
    'Material operacional'
  ).trim()

  return descricaoOriginal
    .split(/\s+/)
    .filter((parte, indice, partes) => {
      const atual = normalizar(parte)

      if (atual === 'n/a' || atual === 'na') {
        return false
      }

      if (
        atual === 'nao' &&
        normalizar(partes[indice + 1]) === 'informado'
      ) {
        return false
      }

      if (
        atual === 'informado' &&
        normalizar(partes[indice - 1]) === 'nao'
      ) {
        return false
      }

      return true
    })
    .join(' ')
    .replace(/\s+-\s+/g, ' - ')
    .trim()
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

function itemEhTorniquete(item) {
  const observacao = lerObservacao(item)

  return (
    normalizar(item?.tipo_patrimonio) ===
      'torniquete' ||
    normalizar(item?.tipo) ===
      'torniquete' ||
    normalizar(item?.categoria) ===
      'torniquete' ||
    normalizar(item?.modulo) ===
      'torniquete_quantidade' ||
    normalizar(item?.tipo_registro) ===
      'torniquete_quantidade' ||
    normalizar(observacao?.tipo_registro) ===
      'torniquete_quantidade' ||
    Boolean(
      item?.torniquete_id ||
      observacao?.torniquete_id
    )
  )
}

function itemEhQuantitativo(item) {
  const observacao = lerObservacao(item)

  return (
    itemEhTorniquete(item) ||
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

  if (itemEhViatura(item)) {
    return String(
      item?.viatura_id ||
      item?.referencia_id ||
      item?.id ||
      ''
    )
  }

  if (itemEhTorniquete(item)) {
    return String(
      item?.movimentacao_cautela_id ||
      observacao?.movimentacao_cautela_id ||
      item?.id ||
      item?.patrimonio_id ||
      ''
    )
  }

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


function obterTimestampMovimentacao(movimentacao) {
  const valor =
    movimentacao?.created_at ||
    movimentacao?.solicitado_em ||
    movimentacao?.criado_em ||
    null

  if (!valor) {
    return null
  }

  const data = new Date(valor)

  return Number.isNaN(data.getTime())
    ? null
    : data.getTime()
}

function obterTimestampTransferenciaMunicao(transferencia) {
  const valor =
    transferencia?.criado_em ||
    transferencia?.created_at ||
    null

  if (!valor) {
    return null
  }

  const data = new Date(valor)

  return Number.isNaN(data.getTime())
    ? null
    : data.getTime()
}

function associarMunicoesAosCarrinhos(
  carrinhos = [],
  transferencias = []
) {
  const porCarrinho = new Map()
  const associadas = new Set()

  for (const carrinho of carrinhos || []) {
    porCarrinho.set(
      String(carrinho?.id || ''),
      []
    )
  }

  for (const transferencia of transferencias || []) {
    const transferenciaId =
      String(
        transferencia?.transferencia_id ||
        transferencia?.id ||
        ''
      )

    if (!transferenciaId) {
      continue
    }

    const movimentacaoPrincipalId =
      String(
        transferencia?.movimentacao_principal_id ||
        ''
      )

    if (
      movimentacaoPrincipalId &&
      porCarrinho.has(
        movimentacaoPrincipalId
      )
    ) {
      porCarrinho
        .get(movimentacaoPrincipalId)
        .push(transferencia)

      associadas.add(
        transferenciaId
      )

      continue
    }

    const timestampMunicao =
      obterTimestampTransferenciaMunicao(
        transferencia
      )

    if (timestampMunicao === null) {
      continue
    }

    let melhorCarrinho = null
    let menorDiferenca = Infinity

    for (const carrinho of carrinhos || []) {
      const timestampCarrinho =
        obterTimestampMovimentacao(
          carrinho
        )

      if (timestampCarrinho === null) {
        continue
      }

      const diferenca =
        Math.abs(
          timestampMunicao -
          timestampCarrinho
        )

      /*
       * Arma e munição do mesmo pagamento são criadas praticamente
       * juntas. A janela de 3 minutos serve apenas como fallback
       * enquanto movimentacao_principal_id ainda vier vazio.
       */
      if (
        diferenca <= 3 * 60 * 1000 &&
        diferenca < menorDiferenca
      ) {
        melhorCarrinho = carrinho
        menorDiferenca = diferenca
      }
    }

    if (melhorCarrinho?.id) {
      const chave =
        String(
          melhorCarrinho.id
        )

      porCarrinho
        .get(chave)
        .push(transferencia)

      associadas.add(
        transferenciaId
      )
    }
  }

  return {
    porCarrinho,
    associadas
  }
}



function valorDepoisDosDoisPontos(valor) {
  const texto = String(valor || '')
  const indice = texto.indexOf(':')

  if (indice < 0) return ''

  return texto
    .slice(indice + 1)
    .trim()
}

function obterDadosRetornoManutencao(
  manutencao
) {
  if (!manutencao) {
    return {
      servicoExecutado: '',
      observacoesRetorno: ''
    }
  }

  let servicoExecutado =
    String(
      manutencao.servico_executado ||
      ''
    ).trim()

  let observacoesRetorno =
    String(
      manutencao.observacoes_retorno ||
      ''
    ).trim()

  if (
    servicoExecutado &&
    observacoesRetorno
  ) {
    return {
      servicoExecutado,
      observacoesRetorno
    }
  }

  const partes = String(
    manutencao.observacoes ||
    ''
  )
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)

  for (const parte of partes) {
    const comparacao =
      normalizar(parte)

    if (
      !servicoExecutado &&
      comparacao.startsWith(
        'servico executado:'
      )
    ) {
      servicoExecutado =
        valorDepoisDosDoisPontos(
          parte
        )
      continue
    }

    if (
      !observacoesRetorno &&
      comparacao.startsWith(
        'observacoes do retorno:'
      )
    ) {
      observacoesRetorno =
        valorDepoisDosDoisPontos(
          parte
        )
    }
  }

  return {
    servicoExecutado,
    observacoesRetorno
  }
}

async function carregarUltimasManutencoesCOP() {
  try {
    const resposta =
      await listarManutencoes({
        modulo: 'COP',
        status: 'CONCLUIDA',
        pagina: 1,
        limite: 200
      })

    const porPatrimonio = {}

    for (
      const manutencao of
      resposta?.data || []
    ) {
      const patrimonioId =
        String(
          manutencao?.patrimonio_id ||
          ''
        )

      if (
        !patrimonioId ||
        porPatrimonio[patrimonioId]
      ) {
        continue
      }

      porPatrimonio[
        patrimonioId
      ] = manutencao
    }

    return porPatrimonio
  } catch (error) {
    console.warn(
      'Não foi possível carregar a última manutenção das COPs:',
      error
    )

    return {}
  }
}

export default function CautelasUsuario({
  user,
  modo = 'receber',
  onConcluido
}) {
  const [cautelas, setCautelas] = useState([])
  const [
    cargasPermanentesPendentes,
    setCargasPermanentesPendentes
  ] = useState([])

  const [
    cautelasMunicaoPendentes,
    setCautelasMunicaoPendentes
  ] = useState([])

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

  const [
    ultimasManutencoesCOP,
    setUltimasManutencoesCOP
  ] = useState({})

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const [
        pendentes,
        ativos,
        devolucoesPendentes,
        cargasPermanentes,
        cautelasMunicao,
        manutencoesCOP,
        cautelasMapaUsuario
      ] =
        await Promise.all([
          listarCautelasAguardandoUsuario(user),
          listarMateriaisEmServicoUsuario(user),
          listarDevolucoesPendentesUsuario(user),
          listarCargasPermanentesPendentesPolicial(),
          listarCautelasPendentesPolicial(),
          carregarUltimasManutencoesCOP(),
          listarCautelasMapaUsuario(user)
        ])

      /*
       * A viatura não é patrimônio comum e, por isso, não aparece dentro
       * de movimentacao.itens. O vínculo dela é preservado em
       * sigmo_mapa_forca_cautelas.resumo_itens.
       *
       * Aqui unimos somente a representação visual da VTR ao carrinho
       * patrimonial correspondente. A confirmação patrimonial continua
       * recebendo apenas os itens que pertencem ao motor de cautelas.
       */
      const listaPendentes =
        (pendentes || []).map((movimentacao) => {
          const vinculoMapa =
            (cautelasMapaUsuario || []).find(
              (cautela) =>
                String(
                  cautela?.movimentacao_principal_id ||
                  ''
                ) ===
                String(
                  movimentacao?.id ||
                  ''
                )
            )

          const viaturas =
            (vinculoMapa?.resumo_itens || [])
              .filter(itemEhViatura)
              .map((item) =>
                montarViaturaMapaForca(
                  item,
                  vinculoMapa
                )
              )
              .filter(Boolean)

          if (viaturas.length === 0) {
            return movimentacao
          }

          const itensAtuais =
            Array.isArray(movimentacao?.itens)
              ? movimentacao.itens
              : []

          const idsAtuais =
            new Set(
              itensAtuais
                .filter(itemEhViatura)
                .map(chaveItemEstavel)
            )

          return {
            ...movimentacao,
            itens: [
              ...itensAtuais,
              ...viaturas.filter(
                (item) =>
                  !idsAtuais.has(
                    chaveItemEstavel(item)
                  )
              )
            ]
          }
        })

      setCautelas(listaPendentes)
      setCargasPermanentesPendentes(
        Array.isArray(cargasPermanentes)
          ? cargasPermanentes
          : []
      )

      setCautelasMunicaoPendentes(
        Array.isArray(cautelasMunicao)
          ? cautelasMunicao
          : []
      )

      setUltimasManutencoesCOP(
        manutencoesCOP &&
        typeof manutencoesCOP === 'object'
          ? manutencoesCOP
          : {}
      )

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

  const associacaoMunicoesCarrinhos =
    useMemo(
      () =>
        associarMunicoesAosCarrinhos(
          cautelas,
          cautelasMunicaoPendentes
        ),
      [
        cautelas,
        cautelasMunicaoPendentes
      ]
    )

  const cautelasMunicaoSemCarrinho =
    useMemo(
      () =>
        cautelasMunicaoPendentes.filter(
          (transferencia) => {
            const id =
              String(
                transferencia?.transferencia_id ||
                transferencia?.id ||
                ''
              )

            return (
              !id ||
              !associacaoMunicoesCarrinhos
                .associadas
                .has(id)
            )
          }
        ),
      [
        cautelasMunicaoPendentes,
        associacaoMunicoesCarrinhos
      ]
    )

  const totalAguardandoRecebimento =
    cautelas.length +
    cargasPermanentesPendentes.length +
    cautelasMunicaoSemCarrinho.length

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

  function novidadeViaturaVazia() {
    return {
      aberta: true,
      tipo: 'AVARIA',
      titulo: '',
      descricao: '',
      origemConstatacao: 'ASSUNCAO_VTR',
      localAvaria: '',
      componenteAvariado: '',
      severidade: 'BAIXA',
      disponibilidadeVtr: 'NAO_AVALIADA',
      responsabilidadeStatus: 'NAO_DEFINIDA',
      quantidade_afetada: 1,
      fotos: [],
      previews: []
    }
  }

  function alternarNovidadeViatura(chave) {
    setNovidadesRecebimento((estadoAtual) => {
      const atual = estadoAtual[chave]

      if (!atual) {
        return {
          ...estadoAtual,
          [chave]: novidadeViaturaVazia()
        }
      }

      return {
        ...estadoAtual,
        [chave]: {
          ...atual,
          aberta: !atual.aberta
        }
      }
    })

    setErro('')
    setMensagem('')
  }

  function alterarNovidadeViatura(chave, campo, valor) {
    setNovidadesRecebimento((estadoAtual) => {
      const atual =
        estadoAtual[chave] ||
        novidadeViaturaVazia()

      let novoValor = valor

      if (
        [
          'titulo',
          'descricao',
          'localAvaria',
          'componenteAvariado'
        ].includes(campo)
      ) {
        novoValor =
          String(valor ?? '').toUpperCase()
      }

      return {
        ...estadoAtual,
        [chave]: {
          ...atual,
          [campo]: novoValor
        }
      }
    })
  }

  async function registrarNovidadeViaturaNoRiv({
    item,
    novidade
  }) {
    const viaturaId =
      item?.viatura_id ||
      item?.referencia_id ||
      null

    if (!viaturaId) {
      throw new Error(
        'A viatura vinculada à US não possui identificação válida para registrar a novidade.'
      )
    }

    const titulo =
      String(
        novidade?.titulo || ''
      ).trim()

    if (!titulo) {
      throw new Error(
        'Informe o título da novidade registrada na viatura.'
      )
    }

    const resumo =
      await obterRivResumo(
        viaturaId
      )

    const registro =
      await registrarOcorrenciaRiv({
        viatura: {
          id: viaturaId,
          quilometragem_atual:
            Number(
              resumo?.quilometragemAtual ||
              0
            )
        },
        tipo: 'AVARIA',
        titulo,
        descricao:
          novidade?.descricao || '',
        origemConstatacao:
          novidade?.origemConstatacao ||
          'ASSUNCAO_VTR',
        localAvaria:
          novidade?.localAvaria || '',
        componenteAvariado:
          novidade?.componenteAvariado ||
          '',
        severidade:
          novidade?.severidade ||
          'BAIXA',
        disponibilidadeVtr:
          novidade?.disponibilidadeVtr ||
          'NAO_AVALIADA',
        responsabilidadeStatus:
          novidade?.responsabilidadeStatus ||
          'NAO_DEFINIDA',
        agravamento: false,
        ocorrenciaPaiId: null,
        agravamentoDescricao: '',
        user
      })

    if (
      registro?.id &&
      (novidade?.fotos || []).length > 0
    ) {
      await enviarFotosOcorrenciaRiv({
        viaturaId,
        ocorrenciaId:
          registro.id,
        tipo: 'AVARIA',
        fase: 'ANTES',
        arquivos:
          novidade.fotos,
        user
      })
    }

    return registro
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
              providencia: 'MANUTENCAO',
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
            providencia: 'MANUTENCAO',
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
            providencia: 'MANUTENCAO',
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
      providencia: 'MANUTENCAO',
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
    return (movimentacao?.itens || [])
      .filter(
        (item) =>
          !itemEhViatura(item)
      )
      .map(
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

    const viaturasDoCarrinho =
      (movimentacao?.itens || [])
        .filter(itemEhViatura)

    const municoesDoCarrinho =
      associacaoMunicoesCarrinhos
        .porCarrinho
        .get(
          String(
            movimentacao?.id ||
            ''
          )
        ) || []

    if (
      itensRecebimento.length === 0 &&
      viaturasDoCarrinho.length > 0
    ) {
      setErro(
        'A viatura está vinculada à US, mas o vínculo operacional próprio da VTR ainda precisa ser concluído antes de um carrinho exclusivamente de viatura ser confirmado.'
      )
      return
    }

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

    for (const viatura of viaturasDoCarrinho) {
      const chaveViatura =
        chaveQuantidadeRecebimento(
          movimentacao.id,
          viatura
        )

      const novidadeViatura =
        obterNovidadeRecebimento(
          chaveViatura
        )

      if (!novidadeViatura) {
        continue
      }

      if (!String(
        novidadeViatura.titulo ||
        ''
      ).trim()) {
        setErro(
          'Informe o título da novidade registrada na viatura.'
        )
        return
      }
    }

    for (const transferencia of municoesDoCarrinho) {
      const chaveMunicao =
        `municao-${transferencia.transferencia_id}`

      const novidadeMunicao =
        obterNovidadeRecebimento(
          chaveMunicao
        )

      if (!novidadeMunicao) {
        continue
      }

      if (!novidadeMunicao.tipo) {
        setErro(
          'Selecione o tipo da novidade registrada na munição.'
        )
        return
      }

      if (!String(
        novidadeMunicao.descricao ||
        ''
      ).trim()) {
        setErro(
          'Descreva a novidade registrada na munição.'
        )
        return
      }

      const quantidadeTotalMunicao =
        Math.max(
          0,
          Number(
            transferencia
              ?.quantidade_total ||
            0
          ) || 0
        )

      const quantidadeAfetada =
        Math.max(
          1,
          Number(
            novidadeMunicao
              ?.quantidade_afetada ||
            1
          ) || 1
        )

      if (
        quantidadeAfetada >
        quantidadeTotalMunicao
      ) {
        setErro(
          'A quantidade de munição com novidade não pode ser maior que a quantidade recebida.'
        )
        return
      }
    }

    const quantitativosParciais =
      itensRecebimento.filter(
        (item) =>
          item.quantitativo &&
          item.quantidadeReceber <
            item.quantidadeEnviada
      )

    const possuiMunicaoVinculada =
      municoesDoCarrinho.length > 0

    let mensagemConfirmacao =
      quantitativosParciais.length > 0
        ? 'Confirma o recebimento das quantidades selecionadas? As unidades não recebidas permanecerão no Cofre do SVDD.'
        : 'Confirma o recebimento de todos os materiais deste carrinho?'

    if (possuiMunicaoVinculada) {
      mensagemConfirmacao =
        quantitativosParciais.length > 0
          ? 'Confirma o recebimento dos materiais e das munições deste carrinho? As quantidades patrimoniais não recebidas permanecerão no Cofre do SVDD.'
          : 'Confirma o recebimento de todos os materiais e munições deste carrinho?'
    }

    if (viaturasDoCarrinho.length > 0) {
      const possuiNovidadeViatura =
        viaturasDoCarrinho.some(
          (viatura) =>
            Boolean(
              obterNovidadeRecebimento(
                chaveQuantidadeRecebimento(
                  movimentacao.id,
                  viatura
                )
              )
            )
        )

      mensagemConfirmacao =
        possuiNovidadeViatura
          ? 'Confirma o recebimento da cautela e o registro da novidade da viatura no RIV? A VTR não será encaminhada automaticamente para manutenção.'
          : possuiMunicaoVinculada
            ? 'Confirma o recebimento dos materiais, munições e da viatura vinculada a esta US?'
            : 'Confirma o recebimento dos materiais e da viatura vinculada a esta US?'
    }

    if (
      !window.confirm(
        mensagemConfirmacao
      )
    ) {
      return
    }

    try {
      setProcessando(
        movimentacao.id
      )
      setErro('')
      setMensagem('')

      const resultado =
        await confirmarRecebimentoCautela({
          movimentacaoId:
            movimentacao.id,
          itens:
            itensRecebimento,
          user
        })

      const resultadosViaturas = []
      const falhasViaturas = []

      for (
        const viatura of
        viaturasDoCarrinho
      ) {
        const chaveViatura =
          chaveQuantidadeRecebimento(
            movimentacao.id,
            viatura
          )

        const novidadeViatura =
          obterNovidadeRecebimento(
            chaveViatura
          )

        if (!novidadeViatura) {
          continue
        }

        try {
          const registroRiv =
            await registrarNovidadeViaturaNoRiv({
              item: viatura,
              novidade:
                novidadeViatura
            })

          resultadosViaturas.push({
            viatura,
            registro:
              registroRiv
          })
        } catch (error) {
          console.error(
            'Erro ao registrar novidade da viatura no RIV:',
            error
          )

          falhasViaturas.push({
            viatura,
            erro:
              error?.message ||
              'Não foi possível registrar a novidade da viatura no RIV.'
          })
        }
      }

      const resultadosMunicoes = []

      for (
        const transferencia of
        municoesDoCarrinho
      ) {
        const transferenciaId =
          transferencia?.transferencia_id

        if (!transferenciaId) {
          throw new Error(
            'Uma cautela de munição vinculada ao carrinho não possui identificação válida.'
          )
        }

        const chaveMunicao =
          `municao-${transferenciaId}`

        const novidadeMunicao =
          obterNovidadeRecebimento(
            chaveMunicao
          )

        const resultadoMunicao =
          await receberCautelaMunicaoPolicial(
            transferenciaId,
            novidadeMunicao
              ? {
                  tipo:
                    novidadeMunicao.tipo,
                  descricao:
                    novidadeMunicao.descricao,
                  quantidade_afetada:
                    novidadeMunicao.quantidade_afetada
                }
              : null
          )

        resultadosMunicoes.push({
          transferencia,
          resultado:
            resultadoMunicao
        })
      }

      const totalMunicoes =
        municoesDoCarrinho.reduce(
          (total, transferencia) =>
            total +
            Math.max(
              0,
              Number(
                transferencia
                  ?.quantidade_total ||
                0
              ) || 0
            ),
          0
        )

      setMensagem(
        viaturasDoCarrinho.length > 0
          ? (
              falhasViaturas.length > 0
                ? `Cautela recebida com sucesso, mas ${falhasViaturas.length} novidade(s) de viatura não puderam ser registrada(s) no RIV: ${falhasViaturas.map((item) => item.erro).join(' | ')}`
                : resultadosViaturas.length > 0
                  ? 'Cautela recebida com sucesso. A novidade da viatura foi registrada no RIV e ficará aguardando avaliação do SVDD.'
                  : 'Cautela recebida com sucesso. A viatura vinculada à US está sob sua responsabilidade.'
            )
          : possuiMunicaoVinculada
          ? (
              totalMunicoes > 0
                ? `Cautela recebida com sucesso. Materiais e ${totalMunicoes} unidade(s) de munição já estão sob sua responsabilidade.`
                : 'Cautela recebida com sucesso. Materiais e munições já estão sob sua responsabilidade.'
            )
          : (
              resultado?.mensagem ||
              (
                quantitativosParciais.length > 0
                  ? 'Recebimento parcial concluído. As quantidades não recebidas permaneceram no Cofre do SVDD.'
                  : 'Cautela recebida com sucesso. Os materiais já estão sob sua responsabilidade.'
              )
            )
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

      onConcluido?.({
        ...(
          resultado &&
          typeof resultado === 'object'
            ? resultado
            : {}
        ),
        municoes:
          resultadosMunicoes,
        viaturas:
          resultadosViaturas
      })
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível confirmar o recebimento.'
      )
    } finally {
      setProcessando('')
    }
  }

  async function receberCautelaMunicao(
    transferencia
  ) {
    const transferenciaId =
      transferencia?.transferencia_id

    if (!transferenciaId) {
      setErro(
        'Cautela de munição inválida.'
      )
      return
    }

    const calibre =
      String(
        transferencia?.calibre ||
        'MUNIÇÃO'
      ).trim()

    const quantidade =
      Math.max(
        0,
        Number(
          transferencia?.quantidade_total ||
          0
        ) || 0
      )

    const chaveMunicao =
      `municao-${transferenciaId}`

    const novidadeMunicao =
      obterNovidadeRecebimento(
        chaveMunicao
      )

    if (novidadeMunicao) {
      if (!novidadeMunicao.tipo) {
        setErro(
          'Selecione o tipo da novidade registrada na munição.'
        )
        return
      }

      if (!String(
        novidadeMunicao.descricao ||
        ''
      ).trim()) {
        setErro(
          'Descreva a novidade registrada na munição.'
        )
        return
      }

      const quantidadeAfetada =
        Math.max(
          1,
          Number(
            novidadeMunicao
              ?.quantidade_afetada ||
            1
          ) || 1
        )

      if (
        quantidadeAfetada >
        quantidade
      ) {
        setErro(
          'A quantidade de munição com novidade não pode ser maior que a quantidade recebida.'
        )
        return
      }
    }

    if (
      !window.confirm(
        novidadeMunicao
          ? `Confirma o recebimento de ${quantidade} unidade(s) de ${calibre}, encaminhando ${Math.max(
              1,
              Number(
                novidadeMunicao
                  ?.quantidade_afetada ||
                1
              ) || 1
            )} unidade(s) para manutenção?`
          : `Confirma o recebimento de ${quantidade} unidade(s) de ${calibre} em cautela individual?`
      )
    ) {
      return
    }

    try {
      setProcessando(
        `MUNICAO_CAUTELA:${transferenciaId}`
      )
      setErro('')
      setMensagem('')

      const resultado =
        await receberCautelaMunicaoPolicial(
          transferenciaId,
          novidadeMunicao
            ? {
                tipo:
                  novidadeMunicao.tipo,
                descricao:
                  novidadeMunicao.descricao,
                quantidade_afetada:
                  novidadeMunicao.quantidade_afetada
              }
            : null
        )

      setMensagem(
        novidadeMunicao
          ? `Cautela de munição recebida. ${Math.max(
              1,
              Number(
                novidadeMunicao
                  ?.quantidade_afetada ||
                1
              ) || 1
            )} unidade(s) de ${calibre} encaminhada(s) para manutenção.`
          : `Cautela de munição recebida com sucesso: ${quantidade} unidade(s) de ${calibre}.`
      )

      setNovidadesRecebimento(
        (estadoAtual) => {
          const proximo = {
            ...estadoAtual
          }

          delete proximo[
            chaveMunicao
          ]

          return proximo
        }
      )

      await carregar()

      onConcluido?.({
        tipo:
          'MUNICAO_CAUTELA',
        resultado
      })
    } catch (error) {
      console.error(
        'Erro ao receber cautela de munição:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível confirmar o recebimento da cautela de munição.'
      )
    } finally {
      setProcessando('')
    }
  }

  async function receberCargaPermanente(
    transferencia
  ) {
    const transferenciaId =
      transferencia?.transferencia_id

    if (!transferenciaId) {
      setErro(
        'Transferência de munição inválida.'
      )
      return
    }

    const calibre =
      String(
        transferencia?.calibre ||
        'MUNIÇÃO'
      ).trim()

    const quantidade =
      Math.max(
        0,
        Number(
          transferencia?.quantidade_total ||
          0
        ) || 0
      )

    if (
      !window.confirm(
        `Confirma o recebimento de ${quantidade} unidade(s) de ${calibre} como carga permanente?`
      )
    ) {
      return
    }

    try {
      setProcessando(
        `MUNICAO:${transferenciaId}`
      )
      setErro('')
      setMensagem('')

      const resultado =
        await receberCargaPermanenteMunicao(
          transferenciaId
        )

      setMensagem(
        `Carga permanente recebida com sucesso: ${quantidade} unidade(s) de ${calibre}.`
      )

      await carregar()

      onConcluido?.({
        tipo:
          'MUNICAO_CARGA_PERMANENTE',
        resultado
      })
    } catch (error) {
      console.error(
        'Erro ao receber carga permanente de munição:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível confirmar o recebimento da munição.'
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
        const quantitativo =
          itemEhQuantitativo(item)

        const chave =
          chaveQuantidadeDevolucao(item)

        const quantidadeFinal =
          quantitativo
            ? Math.max(
                1,
                Math.min(
                  Number(
                    quantidadesDevolver[chave] ??
                    quantidadeEnviada(item)
                  ) || 1,
                  quantidadeEnviada(item)
                )
              )
            : Math.max(
                1,
                Number(
                  item?.quantidade ||
                  1
                ) || 1
              )

        return {
          ...item,

          quantidade:
            quantidadeFinal,

          /*
           * A novidade informada na tela de DEVOLUÇÃO precisa viajar
           * junto com o item até o service. Antes ela ficava apenas no
           * estado visual e era perdida ao clicar em "Enviar devolução".
           */
          novidade:
            novidadeParaEnvio(
              chave,
              quantidadeFinal
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

    setNovidadesRecebimento(
      (estadoAtual) => {
        const proximo = {
          ...estadoAtual
        }

        for (
          const item of
          itensSelecionados
        ) {
          const chave =
            chaveQuantidadeDevolucao(item)

          ;(
            proximo[chave]
              ?.previews || []
          ).forEach(
            (preview) => {
              if (preview?.url) {
                URL.revokeObjectURL(
                  preview.url
                )
              }
            }
          )

          delete proximo[chave]
        }

        return proximo
      }
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
          <strong>
            {totalAguardandoRecebimento}
          </strong>
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

            {obterPrazoTurno(item) && (
              <small
                style={{
                  display: 'block',
                  marginTop: '5px',
                  fontWeight: 700,
                  color: turnoVencido(item)
                    ? '#b42318'
                    : '#475467'
                }}
              >
                {turnoVencido(item)
                  ? `CAUTELA VENCIDA • ${formatarData(obterPrazoTurno(item))}`
                  : `TÉRMINO DO TURNO • ${formatarData(obterPrazoTurno(item))}`}
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

            {obterPrazoTurno(item) && (
              <small
                style={{
                  display: 'block',
                  marginTop: '6px',
                  fontWeight: 700,
                  color: turnoVencido(item)
                    ? '#b42318'
                    : '#475467'
                }}
              >
                {turnoVencido(item)
                  ? `CAUTELA VENCIDA • ${formatarData(obterPrazoTurno(item))}`
                  : `TÉRMINO DO TURNO • ${formatarData(obterPrazoTurno(item))}`}
              </small>
            )}

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

            {itemEhTorniquete(item) && (
              <div
                className="cautela-usuario-novidade-acoes"
                style={{
                  marginTop: 10
                }}
              >
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
            )}

            {itemEhTorniquete(item) &&
              obterNovidadeRecebimento(chave)?.aberta && (
                <div className="cautela-usuario-novidade-card">
                  <div className="cautela-usuario-novidade-titulo">
                    <span>REGISTRO DE NOVIDADE NA DEVOLUÇÃO</span>
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
                            quantidadeDevolver
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
                        <option value="IMPROPRIO_PARA_USO">
                          IMPRÓPRIO PARA USO
                        </option>
                        <option value="OUTRO">
                          OUTRO
                        </option>
                      </select>
                    </label>

                    <label>
                      Quantidade com novidade

                      <input
                        type="number"
                        min="1"
                        max={quantidadeDevolver}
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
                            quantidadeDevolver
                          )
                        }
                      />
                    </label>

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
                            quantidadeDevolver
                          )
                        }
                        placeholder="DESCREVA A NOVIDADE IDENTIFICADA NO TORNIQUETE"
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
          {cautelas.length === 0 &&
          cargasPermanentesPendentes.length === 0 &&
          cautelasMunicaoSemCarrinho.length === 0 ? (
            <div className="cautela-usuario-estado">
              <strong>
                Nenhum material aguardando seu aceite.
              </strong>
              <p>
                Quando houver material ou munição destinado a você, a pendência aparecerá aqui.
              </p>
            </div>
          ) : (
            <>
              {cautelasMunicaoSemCarrinho.map(
                (transferencia) => {
                  const chaveProcessamento =
                    `MUNICAO_CAUTELA:${transferencia.transferencia_id}`

                  const recebendo =
                    processando ===
                    chaveProcessamento

                  const chaveMunicao =
                    `municao-${transferencia.transferencia_id}`

                  const quantidadeMunicao =
                    Math.max(
                      1,
                      Number(
                        transferencia
                          ?.quantidade_total ||
                        1
                      ) || 1
                    )

                  const novidadeMunicao =
                    obterNovidadeRecebimento(
                      chaveMunicao
                    )

                  return (
                    <article
                      key={
                        transferencia.transferencia_id
                      }
                      className="cautela-usuario-card"
                    >
                      <div className="cautela-usuario-card-topo">
                        <div>
                          <span>
                            CAUTELA DE MUNIÇÃO
                          </span>

                          <h2>
                            {transferencia.calibre ||
                              'Munição'}
                          </h2>
                        </div>

                        <small>
                          {formatarData(
                            transferencia.criado_em
                          )}
                        </small>
                      </div>

                      <div className="cautela-usuario-carrinho">
                        <article className="cautela-usuario-carrinho-item">
                          <div className="cautela-usuario-carrinho-info">
                            <strong>
                              MUNIÇÃO{' '}
                              {transferencia.calibre ||
                                ''}
                            </strong>

                            <span>
                              Cautela individual
                            </span>

                            <div
                              className="cautela-usuario-novidade-acoes"
                              style={{
                                marginTop: 10
                              }}
                            >
                              <button
                                type="button"
                                className="cautela-usuario-novidade-botao"
                                onClick={() =>
                                  alternarNovidadeRecebimento(
                                    chaveMunicao
                                  )
                                }
                              >
                                {novidadeMunicao
                                  ? (
                                      novidadeMunicao.aberta
                                        ? 'Fechar novidade'
                                        : 'Alterar novidade'
                                    )
                                  : 'Registrar novidade'}
                              </button>

                              {novidadeMunicao && (
                                <>
                                  <span className="cautela-usuario-novidade-ok">
                                    ✓ Novidade registrada
                                  </span>

                                  <button
                                    type="button"
                                    className="cautela-usuario-novidade-remover"
                                    onClick={() =>
                                      removerNovidadeRecebimento(
                                        chaveMunicao
                                      )
                                    }
                                  >
                                    Remover
                                  </button>
                                </>
                              )}
                            </div>

                            {novidadeMunicao?.aberta && (
                              <div className="cautela-usuario-novidade-card">
                                <div className="cautela-usuario-novidade-titulo">
                                  <span>
                                    REGISTRO DE NOVIDADE
                                  </span>

                                  <strong>
                                    MUNIÇÃO{' '}
                                    {transferencia.calibre ||
                                      ''}
                                  </strong>
                                </div>

                                <div className="cautela-usuario-novidade-grid">
                                  <label>
                                    Tipo

                                    <select
                                      value={
                                        novidadeMunicao.tipo ||
                                        ''
                                      }
                                      onChange={(event) =>
                                        alterarNovidadeRecebimento(
                                          chaveMunicao,
                                          'tipo',
                                          event.target.value,
                                          quantidadeMunicao
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

                                      <option value="DANIFICADA">
                                        MUNIÇÃO DANIFICADA
                                      </option>

                                      <option value="OXIDACAO">
                                        OXIDAÇÃO
                                      </option>

                                      <option value="OUTRO">
                                        OUTRO
                                      </option>
                                    </select>
                                  </label>

                                  <label>
                                    Quantidade com novidade

                                    <input
                                      type="number"
                                      min="1"
                                      max={quantidadeMunicao}
                                      value={
                                        novidadeMunicao
                                          .quantidade_afetada ||
                                        1
                                      }
                                      onChange={(event) =>
                                        alterarNovidadeRecebimento(
                                          chaveMunicao,
                                          'quantidade_afetada',
                                          event.target.value,
                                          quantidadeMunicao
                                        )
                                      }
                                    />
                                  </label>

                                  <label className="cautela-usuario-novidade-full">
                                    Descrição

                                    <textarea
                                      value={
                                        novidadeMunicao
                                          .descricao ||
                                        ''
                                      }
                                      onChange={(event) =>
                                        alterarNovidadeRecebimento(
                                          chaveMunicao,
                                          'descricao',
                                          event.target.value,
                                          quantidadeMunicao
                                        )
                                      }
                                      placeholder="DESCREVA O QUE FOI CONSTATADO NA CONFERÊNCIA"
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>

                          <b>
                            Qtd.{' '}
                            {quantidadeMunicao}
                          </b>
                        </article>
                      </div>

                      <button
                        type="button"
                        className="cautela-usuario-primary"
                        onClick={() =>
                          receberCautelaMunicao(
                            transferencia
                          )
                        }
                        disabled={
                          Boolean(
                            processando
                          )
                        }
                      >
                        {recebendo
                          ? 'Confirmando...'
                          : 'Confirmar recebimento'}
                      </button>
                    </article>
                  )
                }
              )}


              {cargasPermanentesPendentes.map(
                (transferencia) => {
                  const chaveProcessamento =
                    `MUNICAO:${transferencia.transferencia_id}`

                  const recebendo =
                    processando ===
                    chaveProcessamento

                  return (
                    <article
                      key={
                        transferencia.transferencia_id
                      }
                      className="cautela-usuario-card"
                    >
                      <div className="cautela-usuario-card-topo">
                        <div>
                          <span>
                            MUNIÇÃO • CARGA PERMANENTE
                          </span>

                          <h2>
                            {transferencia.calibre ||
                              'Munição'}
                          </h2>
                        </div>

                        <small>
                          Aprovada em{' '}
                          {formatarData(
                            transferencia.aprovado_em
                          )}
                        </small>
                      </div>

                      <div className="cautela-usuario-carrinho">
                        <h3>
                          Munição para recebimento
                        </h3>

                        <article className="cautela-usuario-carrinho-item">
                          <div className="cautela-usuario-carrinho-info">
                            <strong>
                              {transferencia.calibre ||
                                'MUNIÇÃO'}
                            </strong>

                            <span>
                              Quantidade:{' '}
                              {Number(
                                transferencia.quantidade_total ||
                                0
                              ).toLocaleString(
                                'pt-BR'
                              )}
                            </span>

                            <small
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '6px'
                              }}
                            >
                              Origem:{' '}
                              {transferencia.origem_nome ||
                                'COFRE DO P4'}
                            </small>

                            <small
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '4px'
                              }}
                            >
                              Documento:{' '}
                              {transferencia.documento ||
                                'NÃO INFORMADO'}
                            </small>

                            <small
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '4px'
                              }}
                            >
                              Observações:{' '}
                              {transferencia.observacoes ||
                                'SEM OBSERVAÇÕES'}
                            </small>

                            <small
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '4px'
                              }}
                            >
                              Aprovado por:{' '}
                              {transferencia.aprovado_por_nome ||
                                'COMANDANTE DE CIA'}
                            </small>
                          </div>

                          <b>
                            Qtd.{' '}
                            {Number(
                              transferencia.quantidade_total ||
                              0
                            )}
                          </b>
                        </article>
                      </div>

                      <button
                        type="button"
                        className="cautela-usuario-primary"
                        onClick={() =>
                          receberCargaPermanente(
                            transferencia
                          )
                        }
                        disabled={
                          Boolean(
                            processando
                          )
                        }
                      >
                        {recebendo
                          ? 'Confirmando...'
                          : 'Confirmar recebimento'}
                      </button>
                    </article>
                  )
                }
              )}

              {cautelas.map((movimentacao) => (
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

                        const ultimaManutencaoCOP =
                          ultimasManutencoesCOP[
                            String(
                              item?.patrimonio_id ||
                              ''
                            )
                          ] || null

                        const dadosRetornoCOP =
                          obterDadosRetornoManutencao(
                            ultimaManutencaoCOP
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

                              {ultimaManutencaoCOP && (
                                <div
                                  style={{
                                    marginTop: '10px',
                                    padding: '10px 12px',
                                    border:
                                      '1px solid #bbf7d0',
                                    borderRadius:
                                      '10px',
                                    background:
                                      '#f0fdf4'
                                  }}
                                >
                                  <small
                                    style={{
                                      display: 'block',
                                      marginBottom:
                                        '5px',
                                      color:
                                        '#166534',
                                      fontWeight:
                                        800,
                                      letterSpacing:
                                        '.02em'
                                    }}
                                  >
                                    ÚLTIMA MANUTENÇÃO CONCLUÍDA
                                  </small>

                                  <strong
                                    style={{
                                      display: 'block',
                                      color:
                                        '#14532d'
                                    }}
                                  >
                                    {ultimaManutencaoCOP.descricao ||
                                      ultimaManutencaoCOP.tipo_novidade ||
                                      'MANUTENÇÃO'}
                                  </strong>

                                  {(dadosRetornoCOP.servicoExecutado ||
                                    dadosRetornoCOP.observacoesRetorno) && (
                                    <span
                                      style={{
                                        display:
                                          'block',
                                        marginTop:
                                          '5px',
                                        color:
                                          '#344054',
                                        lineHeight:
                                          1.4
                                      }}
                                    >
                                      <strong>
                                        Solução / retorno:
                                      </strong>{' '}
                                      {dadosRetornoCOP.servicoExecutado ||
                                        dadosRetornoCOP.observacoesRetorno}
                                    </span>
                                  )}

                                  <small
                                    style={{
                                      display: 'block',
                                      marginTop:
                                        '6px',
                                      color:
                                        '#667085'
                                    }}
                                  >
                                    Concluída em{' '}
                                    {formatarData(
                                      ultimaManutencaoCOP.concluida_em
                                    )}
                                    {ultimaManutencaoCOP.concluida_por_nome
                                      ? ` · ${ultimaManutencaoCOP.concluida_por_nome}`
                                      : ''}
                                  </small>
                                </div>
                              )}

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
                                    itemEhViatura(item)
                                      ? alternarNovidadeViatura(
                                          chave
                                        )
                                      : alternarNovidadeRecebimento(
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

                              {itemEhViatura(item) &&
                                obterNovidadeRecebimento(chave)?.aberta && (
                                  <div className="cautela-usuario-novidade-card">
                                    <div className="cautela-usuario-novidade-titulo">
                                      <span>NOVIDADE DA VIATURA • RIV</span>
                                      <strong>
                                        {obterDescricao(item)}
                                      </strong>
                                    </div>

                                    <div className="cautela-usuario-novidade-grid">
                                      <label className="cautela-usuario-novidade-full">
                                        Título *
                                        <input
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.titulo ||
                                            ''
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeViatura(
                                              chave,
                                              'titulo',
                                              event.target.value
                                            )
                                          }
                                          placeholder="EX.: RISCO NA PORTA DIANTEIRA DIREITA"
                                        />
                                      </label>

                                      <label>
                                        Constatada em
                                        <select
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.origemConstatacao ||
                                            'ASSUNCAO_VTR'
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeViatura(
                                              chave,
                                              'origemConstatacao',
                                              event.target.value
                                            )
                                          }
                                        >
                                          {ORIGENS_NOVIDADE_VTR.map(
                                            (opcao) => (
                                              <option
                                                key={opcao.value}
                                                value={opcao.value}
                                              >
                                                {opcao.label}
                                              </option>
                                            )
                                          )}
                                        </select>
                                      </label>

                                      <label>
                                        Gravidade
                                        <select
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.severidade ||
                                            'BAIXA'
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeViatura(
                                              chave,
                                              'severidade',
                                              event.target.value
                                            )
                                          }
                                        >
                                          {SEVERIDADES_NOVIDADE_VTR.map(
                                            (opcao) => (
                                              <option
                                                key={opcao.value}
                                                value={opcao.value}
                                              >
                                                {opcao.label}
                                              </option>
                                            )
                                          )}
                                        </select>
                                      </label>

                                      <label>
                                        Local da avaria
                                        <input
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.localAvaria ||
                                            ''
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeViatura(
                                              chave,
                                              'localAvaria',
                                              event.target.value
                                            )
                                          }
                                          placeholder="EX.: PORTA DIANTEIRA DIREITA"
                                        />
                                      </label>

                                      <label>
                                        Componente
                                        <input
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.componenteAvariado ||
                                            ''
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeViatura(
                                              chave,
                                              'componenteAvariado',
                                              event.target.value
                                            )
                                          }
                                          placeholder="EX.: LATARIA / RETROVISOR"
                                        />
                                      </label>

                                      <label className="cautela-usuario-novidade-full">
                                        Descrição
                                        <textarea
                                          value={
                                            obterNovidadeRecebimento(chave)
                                              ?.descricao ||
                                            ''
                                          }
                                          onChange={(event) =>
                                            alterarNovidadeViatura(
                                              chave,
                                              'descricao',
                                              event.target.value
                                            )
                                          }
                                          placeholder="DESCREVA O QUE FOI CONSTATADO NA ASSUNÇÃO DA VIATURA"
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
                                                  alt={`Foto ${indice + 1} da novidade da viatura`}
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

                                    <div
                                      className="cautela-usuario-alerta info"
                                      style={{
                                        marginTop: 10,
                                        marginBottom: 0
                                      }}
                                    >
                                      A novidade será registrada no RIV. O recebimento da VTR não a encaminha automaticamente para manutenção; essa decisão ficará para o SVDD.
                                    </div>
                                  </div>
                                )}

                              {!itemEhViatura(item) &&
                                obterNovidadeRecebimento(chave)?.aberta && (
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
                                          Novidade selecionada. A ocorrência será encaminhada para tratamento pelo setor responsável.
                                        </small>
                                      )}
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

                  {(associacaoMunicoesCarrinhos
                    .porCarrinho
                    .get(
                      String(
                        movimentacao?.id ||
                        ''
                      )
                    ) || []
                  ).map(
                    (transferencia) => {
                      const chaveMunicao =
                        `municao-${transferencia.transferencia_id}`

                      const quantidadeMunicao =
                        Math.max(
                          1,
                          Number(
                            transferencia
                              ?.quantidade_total ||
                            1
                          ) || 1
                        )

                      const novidadeMunicao =
                        obterNovidadeRecebimento(
                          chaveMunicao
                        )

                      return (
                        <article
                          key={chaveMunicao}
                          className="cautela-usuario-carrinho-item"
                        >
                          <div className="cautela-usuario-carrinho-info">
                            <strong>
                              MUNIÇÃO{' '}
                              {transferencia.calibre ||
                                ''}
                            </strong>

                            <span>
                              Cautela individual
                            </span>

                            <div
                              className="cautela-usuario-novidade-acoes"
                              style={{
                                marginTop: 10
                              }}
                            >
                              <button
                                type="button"
                                className="cautela-usuario-novidade-botao"
                                onClick={() =>
                                  alternarNovidadeRecebimento(
                                    chaveMunicao
                                  )
                                }
                              >
                                {novidadeMunicao
                                  ? (
                                      novidadeMunicao.aberta
                                        ? 'Fechar novidade'
                                        : 'Alterar novidade'
                                    )
                                  : 'Registrar novidade'}
                              </button>

                              {novidadeMunicao && (
                                <>
                                  <span className="cautela-usuario-novidade-ok">
                                    ✓ Novidade registrada
                                  </span>

                                  <button
                                    type="button"
                                    className="cautela-usuario-novidade-remover"
                                    onClick={() =>
                                      removerNovidadeRecebimento(
                                        chaveMunicao
                                      )
                                    }
                                  >
                                    Remover
                                  </button>
                                </>
                              )}
                            </div>

                            {novidadeMunicao?.aberta && (
                              <div className="cautela-usuario-novidade-card">
                                <div className="cautela-usuario-novidade-titulo">
                                  <span>
                                    REGISTRO DE NOVIDADE
                                  </span>

                                  <strong>
                                    MUNIÇÃO{' '}
                                    {transferencia.calibre ||
                                      ''}
                                  </strong>
                                </div>

                                <div className="cautela-usuario-novidade-grid">
                                  <label>
                                    Tipo

                                    <select
                                      value={
                                        novidadeMunicao.tipo ||
                                        ''
                                      }
                                      onChange={(event) =>
                                        alterarNovidadeRecebimento(
                                          chaveMunicao,
                                          'tipo',
                                          event.target.value,
                                          quantidadeMunicao
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

                                      <option value="DANIFICADA">
                                        MUNIÇÃO DANIFICADA
                                      </option>

                                      <option value="OXIDACAO">
                                        OXIDAÇÃO
                                      </option>

                                      <option value="OUTRO">
                                        OUTRO
                                      </option>
                                    </select>

                                    {novidadeMunicao.tipo && (
                                      <small
                                        style={{
                                          display: 'block',
                                          marginTop: 6,
                                          lineHeight: 1.35
                                        }}
                                      >
                                        A quantidade indicada será encaminhada para manutenção.
                                      </small>
                                    )}
                                  </label>

                                  <label>
                                    Quantidade com novidade

                                    <input
                                      type="number"
                                      min="1"
                                      max={quantidadeMunicao}
                                      value={
                                        novidadeMunicao
                                          .quantidade_afetada ||
                                        1
                                      }
                                      onChange={(event) =>
                                        alterarNovidadeRecebimento(
                                          chaveMunicao,
                                          'quantidade_afetada',
                                          event.target.value,
                                          quantidadeMunicao
                                        )
                                      }
                                    />
                                  </label>

                                  <label className="cautela-usuario-novidade-full">
                                    Descrição

                                    <textarea
                                      value={
                                        novidadeMunicao
                                          .descricao ||
                                        ''
                                      }
                                      onChange={(event) =>
                                        alterarNovidadeRecebimento(
                                          chaveMunicao,
                                          'descricao',
                                          event.target.value,
                                          quantidadeMunicao
                                        )
                                      }
                                      placeholder="DESCREVA O QUE FOI CONSTATADO NA CONFERÊNCIA"
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>

                          <b>
                            Qtd.{' '}
                            {quantidadeMunicao}
                          </b>
                        </article>
                      )
                    }
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
            ))}
            </>
          )}
        </section>
      )}
    </main>
  )
}
