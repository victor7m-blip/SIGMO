import { supabase } from './supabaseClient'

import {
  listarResumoMunicoes
} from './municoesService'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

const TONFAS_TABLE =
  'sigmo_tonfas'

const MUNICOES_TABLE =
  'sigmo_municoes'

const MOVIMENTACOES_TABLE =
  'sigmo_movimentacoes'

const MOVIMENTACOES_ITENS_TABLE =
  'sigmo_movimentacao_itens'

const FONTES_REFERENCIA = {
  arma: {
    modulo: 'ARMA',
    tabela: 'sigmo_armas'
  },

  armas: {
    modulo: 'ARMA',
    tabela: 'sigmo_armas'
  },

  material: {
    modulo: 'MATERIAL',
    tabela: 'sigmo_materiais'
  },

  materiais: {
    modulo: 'MATERIAL',
    tabela: 'sigmo_materiais'
  },

  ht: {
    modulo: 'HT',
    tabela: 'sigmo_hts'
  },

  hts: {
    modulo: 'HT',
    tabela: 'sigmo_hts'
  },

  tpd: {
    modulo: 'TPD',
    tabela: 'sigmo_tpds'
  },

  tpds: {
    modulo: 'TPD',
    tabela: 'sigmo_tpds'
  },

  cop: {
    modulo: 'COP',
    tabela: 'sigmo_cops'
  },

  cops: {
    modulo: 'COP',
    tabela: 'sigmo_cops'
  },

  taser: {
    modulo: 'TASER',
    tabela: 'sigmo_tasers'
  },

  tasers: {
    modulo: 'TASER',
    tabela: 'sigmo_tasers'
  },

  municao: {
    modulo: 'MUNIÇÃO',
    tabela: null
  },

  municoes: {
    modulo: 'MUNIÇÃO',
    tabela: null
  }
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
}

function normalizarTipo(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(numero)
  )
}

function objeto(valor) {
  if (!valor) {
    return {}
  }

  if (typeof valor === 'object') {
    return valor
  }

  try {
    return JSON.parse(valor)
  } catch {
    return {}
  }
}

function obterConfiguracaoFonte(tipo) {
  const tipoNormalizado =
    normalizarTipo(tipo)

  return (
    FONTES_REFERENCIA[
      tipoNormalizado
    ] || {
      modulo:
        normalizarTexto(tipo) ||
        'PATRIMÔNIO',

      tabela: null
    }
  )
}

function obterPatrimonio(
  patrimonioCentral,
  referencia
) {
  const dados =
    objeto(patrimonioCentral?.dados)

  const tipo = normalizarTipo(
    patrimonioCentral?.tipo
  )

  const numeroCop =
    referencia?.numero ||
    dados.numero

  if (
    ['cop', 'cops'].includes(tipo) &&
    numeroCop
  ) {
    return `COP ${String(numeroCop)
      .trim()
      .padStart(2, '0')}`
  }

  return (
    referencia?.patrimonio ||
    referencia?.numero_patrimonio ||
    dados.patrimonio ||
    dados.numero_patrimonio ||
    patrimonioCentral?.numero_patrimonio ||
    patrimonioCentral?.identificador ||
    referencia?.codigo ||
    referencia?.qr_code ||
    dados.codigo ||
    dados.qr_code ||
    referencia?.numero_serie ||
    referencia?.serie ||
    patrimonioCentral?.id ||
    '-'
  )
}

function obterDescricao({
  patrimonioCentral,
  referencia,
  modulo
}) {
  const dados =
    objeto(patrimonioCentral?.dados)

  if (
    referencia?.descricao ||
    dados.descricao ||
    patrimonioCentral?.descricao
  ) {
    return (
      referencia?.descricao ||
      dados.descricao ||
      patrimonioCentral?.descricao
    )
  }

  const partes = [
    referencia?.especie,
    dados.especie,
    referencia?.tipo,
    dados.tipo,
    referencia?.marca,
    dados.marca,
    referencia?.modelo,
    dados.modelo,
    referencia?.calibre,
    dados.calibre
  ]
    .map((valor) =>
      String(valor ?? '').trim()
    )
    .filter(Boolean)

  if (partes.length > 0) {
    return [
      ...new Set(partes)
    ].join(' ')
  }

  return modulo
}

function obterCategoria({
  patrimonioCentral,
  referencia,
  modulo
}) {
  const dados =
    objeto(patrimonioCentral?.dados)

  return (
    referencia?.categoria ||
    dados.categoria ||
    referencia?.tipo ||
    dados.tipo ||
    referencia?.especie ||
    dados.especie ||
    patrimonioCentral?.tipo ||
    modulo
  )
}

function obterLocal({
  patrimonioCentral,
  referencia
}) {
  const dados =
    objeto(patrimonioCentral?.dados)

  return (
    patrimonioCentral?.local_atual ||
    referencia?.local_atual ||
    dados.local_atual ||
    referencia?.local ||
    dados.local ||
    referencia?.unidade ||
    dados.unidade ||
    referencia?.setor ||
    dados.setor ||
    'NÃO INFORMADO'
  )
}

function obterStatus({
  patrimonioCentral,
  referencia
}) {
  const dados =
    objeto(patrimonioCentral?.dados)

  return normalizarTexto(
    patrimonioCentral?.status ||
    referencia?.status_operacional ||
    referencia?.status ||
    dados.status_operacional ||
    dados.status ||
    referencia?.situacao ||
    dados.situacao ||
    'SEM STATUS'
  )
}

function registroDisponivel({
  status,
  localAtual,
  ativo = true,
  controlaQuantidade = false,
  quantidadeDisponivel = 0
}) {
  if (ativo === false) {
    return false
  }

  if (controlaQuantidade) {
    return numeroInteiro(
      quantidadeDisponivel
    ) > 0
  }

  const statusNormalizado =
    normalizarTexto(status)

  const localNormalizado =
    normalizarTexto(localAtual)

  const statusPermitido = [
    'DISPONÍVEL',
    'DISPONIVEL',
    'ATIVO',
    'RESERVA'
  ].includes(statusNormalizado)

  const statusBloqueado = [
    'CAUTELADO',
    'CARGA',
    'EM SERVIÇO',
    'EM_SERVICO',
    'MANUTENÇÃO',
    'MANUTENCAO',
    'RECOLHIDO',
    'BAIXADO',
    'BAIXADA',
    'APREENDIDO',
    'INATIVO'
  ].includes(statusNormalizado)

  if (statusBloqueado) {
    return false
  }

  if (statusPermitido) {
    return true
  }

  return statusPermitido
}

async function buscarReferencias({
  tabela,
  ids
}) {
  if (
    !tabela ||
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    return new Map()
  }

  const {
    data,
    error
  } = await supabase
    .from(tabela)
    .select('*')
    .in('id', ids)

  if (error) {
    console.warn(
      `Fonte patrimonial indisponível: ${tabela}`,
      error
    )

    return new Map()
  }

  return new Map(
    (data ?? []).map(
      (registro) => [
        String(registro.id),
        registro
      ]
    )
  )
}

function normalizarRegistro({
  patrimonioCentral,
  referencia
}) {
  const configuracao =
    obterConfiguracaoFonte(
      patrimonioCentral.tipo
    )

  const dados =
    objeto(patrimonioCentral.dados)

  const status =
    obterStatus({
      patrimonioCentral,
      referencia
    })

  let localAtual =
    normalizarTexto(
      obterLocal({
        patrimonioCentral,
        referencia
      })
    )

  const tipoPatrimonio =
    normalizarTipo(
      patrimonioCentral.tipo
    )

  if (
    ['cop', 'cops'].includes(
      tipoPatrimonio
    ) &&
    localAtual === 'SVDD'
  ) {
    localAtual =
      'COFRE DO SVDD'
  }

  return {
    ...referencia,
    ...dados,
    ...patrimonioCentral,

    id:
      patrimonioCentral.id,

    patrimonio_id:
      patrimonioCentral.id,

    referencia_id:
      patrimonioCentral.referencia_id ||
      referencia?.id ||
      null,

    patrimonio:
      normalizarTexto(
        obterPatrimonio(
          patrimonioCentral,
          referencia
        )
      ),

    descricao:
      normalizarTexto(
        obterDescricao({
          patrimonioCentral,
          referencia,
          modulo:
            configuracao.modulo
        })
      ),

    categoria:
      normalizarTexto(
        obterCategoria({
          patrimonioCentral,
          referencia,
          modulo:
            configuracao.modulo
        })
      ),

    local_atual:
      localAtual,

    status,

    numero_serie:
      normalizarTexto(
        referencia?.identificacao_equipamento ||
        referencia?.numero_serie ||
        referencia?.serie ||
        dados.identificacao_equipamento ||
        dados.numero_serie ||
        dados.serie
      ),

    qr_code:
      normalizarTexto(
        referencia?.qr_code ||
        referencia?.codigo_qr ||
        dados.qr_code ||
        dados.codigo_qr
      ),

    modulo:
      configuracao.modulo,

    tabela_origem:
      configuracao.tabela,

    controla_quantidade:
      false,

    quantidade_disponivel:
      1,

    quantidade_maxima:
      1,

    disponivel:
      registroDisponivel({
        status,
        localAtual,
        ativo:
          patrimonioCentral.ativo !== false,
        controlaQuantidade: false
      })
  }
}

function normalizarTonfaParaEntrega(
  registro,
  origemLocal = 'COFRE DO SVDD'
) {
  const tipo =
    normalizarTexto(
      registro.tipo
    ) || 'TONFA'

  const origemNormalizada = normalizarTexto(origemLocal)

  const quantidadeDisponivel = numeroInteiro(
    origemNormalizada.includes('P4')
      ? registro.quantidade_p4
      : registro.quantidade_svdd
  )

  const localEstoque = origemNormalizada.includes('P4')
    ? 'DEPÓSITO DO P4'
    : 'COFRE DO SVDD'

  const descricao =
    tipo === 'CASSETETE'
      ? 'CASSETETE'
      : 'TONFA'

  return {
    ...registro,

    id:
      `tonfa-estoque-${registro.id}`,

    patrimonio_id:
      null,

    referencia_id:
      registro.id,

    tonfa_id:
      registro.id,

    item_engine_id:
      registro.item_engine_id ||
      registro.patrimonio_item_id ||
      null,

    lote_id:
      registro.lote_id ||
      registro.patrimonio_lote_id ||
      null,

    patrimonio:
      registro.qr_code ||
      `ESTOQUE-${tipo}`,

    descricao,

    categoria:
      tipo,

    modulo:
      'TONFAS',

    tabela_origem:
      TONFAS_TABLE,

    local_atual:
      localEstoque,

    status:
      quantidadeDisponivel > 0
        ? `DISPONÍVEL - ${localEstoque}`
        : `SEM SALDO - ${localEstoque}`,

    numero_serie:
      '',

    qr_code:
      normalizarTexto(
        registro.qr_code
      ),

    controla_quantidade:
      true,

    quantidade_disponivel:
      quantidadeDisponivel,

    quantidade_maxima:
      quantidadeDisponivel,

    quantidade:
      1,

    disponivel:
      registroDisponivel({
        status:
          registro.status_operacional,
        localAtual:
          localEstoque,
        ativo:
          registro.ativo !== false,
        controlaQuantidade: true,
        quantidadeDisponivel:
          quantidadeDisponivel
      })
  }
}


function normalizarMunicaoParaEntrega({
  municao,
  quantidadeDisponivel,
  origemLocal = 'COFRE DO SVDD'
}) {
  const calibre =
    normalizarTexto(
      municao?.calibre
    ) || 'SEM CALIBRE'

  const origemNormalizada =
    normalizarTexto(
      origemLocal
    )

  const localEstoque =
    origemNormalizada.includes('P4')
      ? 'COFRE DO P4'
      : 'COFRE DO SVDD'

  const quantidade =
    numeroInteiro(
      quantidadeDisponivel
    )

  return {
    ...municao,

    id:
      `municao-estoque-${municao.id}`,

    patrimonio_id:
      null,

    referencia_id:
      municao.id,

    municao_id:
      municao.id,

    patrimonio:
      `ESTOQUE-${calibre}`,

    descricao:
      `MUNIÇÃO ${calibre}`,

    categoria:
      'MUNIÇÃO',

    calibre,

    modulo:
      'MUNIÇÃO',

    tabela_origem:
      MUNICOES_TABLE,

    local_atual:
      localEstoque,

    status:
      quantidade > 0
        ? `DISPONÍVEL - ${localEstoque}`
        : `SEM SALDO - ${localEstoque}`,

    numero_serie:
      '',

    qr_code:
      '',

    controla_quantidade:
      true,

    quantidade_disponivel:
      quantidade,

    quantidade_maxima:
      quantidade,

    quantidade:
      1,

    disponivel:
      registroDisponivel({
        status:
          'DISPONÍVEL',

        localAtual:
          localEstoque,

        ativo:
          municao?.ativo !== false,

        controlaQuantidade:
          true,

        quantidadeDisponivel:
          quantidade
      })
  }
}

async function carregarMunicoesPorOrigem(
  origemLocal = 'COFRE DO SVDD'
) {
  try {
    const resumo =
      await listarResumoMunicoes({
        somenteAtivas:
          true
      })

    const origemNormalizada =
      normalizarTexto(
        origemLocal
      )

    const campoSaldo =
      origemNormalizada.includes('P4')
        ? 'quantidade_p4'
        : 'quantidade_svdd'

    return (resumo ?? [])
      .map(
        (municao) =>
          normalizarMunicaoParaEntrega({
            municao,

            quantidadeDisponivel:
              numeroInteiro(
                municao?.[
                  campoSaldo
                ]
              ),

            origemLocal
          })
      )
      .filter(
        (item) =>
          item.quantidade_disponivel >
          0
      )
  } catch (error) {
    console.warn(
      'Não foi possível carregar munições para entrega.',
      error
    )

    return []
  }
}


async function carregarPatrimoniosCentrais() {
  const {
    data,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')
    .neq('status', 'INATIVO')
    .order('created_at', {
      ascending: false
    })
    .limit(500)

  if (error) {
    throw error
  }

  return data ?? []
}

async function carregarTonfasPorOrigem(origemLocal = 'COFRE DO SVDD') {
  const {
    data,
    error
  } = await supabase
    .from(TONFAS_TABLE)
    .select('*')
    .eq('ativo', true)
    .gt(
      normalizarTexto(origemLocal).includes('P4')
        ? 'quantidade_p4'
        : 'quantidade_svdd',
      0
    )
    .order('tipo', {
      ascending: true
    })

  if (error) {
    console.warn(
      'Não foi possível carregar Tonfas/Cassetetes do SVDD.',
      error
    )

    return []
  }

  return (data ?? []).map(
    (registro) => normalizarTonfaParaEntrega(registro, origemLocal)
  )
}

async function carregarRegistrosNormalizados() {
  const patrimonios =
    await carregarPatrimoniosCentrais()

  if (patrimonios.length === 0) {
    return []
  }

  const grupos = new Map()

  for (const patrimonio of patrimonios) {
    const configuracao =
      obterConfiguracaoFonte(
        patrimonio.tipo
      )

    if (
      !configuracao.tabela ||
      !patrimonio.referencia_id
    ) {
      continue
    }

    if (
      !grupos.has(
        configuracao.tabela
      )
    ) {
      grupos.set(
        configuracao.tabela,
        []
      )
    }

    grupos
      .get(configuracao.tabela)
      .push(
        patrimonio.referencia_id
      )
  }

  const referenciasPorTabela =
    new Map()

  await Promise.all(
    [...grupos.entries()].map(
      async ([
        tabela,
        ids
      ]) => {
        const mapa =
          await buscarReferencias({
            tabela,

            ids: [
              ...new Set(ids)
            ]
          })

        referenciasPorTabela.set(
          tabela,
          mapa
        )
      }
    )
  )

  return patrimonios.map(
    (patrimonioCentral) => {
      const configuracao =
        obterConfiguracaoFonte(
          patrimonioCentral.tipo
        )

      const mapaReferencias =
        referenciasPorTabela.get(
          configuracao.tabela
        )

      const referencia =
        mapaReferencias?.get(
          String(
            patrimonioCentral
              .referencia_id
          )
        ) || null

      return normalizarRegistro({
        patrimonioCentral,
        referencia
      })
    }
  )
}


async function buscarPatrimoniosComprometidos() {
  // Segunda trava de disponibilidade:
  // além do estado atual em sigmo_patrimonios, considera itens que já
  // pertencem a uma movimentação/carrinho ainda em andamento.
  const { data: movimentacoes, error: erroMovimentacoes } = await supabase
    .from(MOVIMENTACOES_TABLE)
    .select('id,status,tipo_movimentacao')
    .in('status', [
      'aguardando_aprovacao',
      'aguardando_recebimento',
      'pendente',
      'em_andamento'
    ])

  if (erroMovimentacoes) {
    console.warn(
      'Não foi possível verificar movimentações pendentes para bloquear materiais.',
      erroMovimentacoes
    )
    return new Set()
  }

  const idsMovimentacoes = (movimentacoes ?? [])
    .filter((movimentacao) => {
      const tipo = normalizarTexto(movimentacao.tipo_movimentacao)
      return tipo === 'CAUTELA' || tipo === 'TRANSFERENCIA' || tipo === 'TRANSFERÊNCIA'
    })
    .map((movimentacao) => movimentacao.id)
    .filter(Boolean)

  if (idsMovimentacoes.length === 0) {
    return new Set()
  }

  const { data: itens, error: erroItens } = await supabase
    .from(MOVIMENTACOES_ITENS_TABLE)
    .select('patrimonio_id,movimentacao_id')
    .in('movimentacao_id', idsMovimentacoes)

  if (erroItens) {
    console.warn(
      'Não foi possível verificar itens de movimentações pendentes.',
      erroItens
    )
    return new Set()
  }

  return new Set(
    (itens ?? [])
      .map((item) => item.patrimonio_id)
      .filter(Boolean)
      .map(String)
  )
}

export async function listarPatrimoniosParaEntrega({
  busca = '',
  apenasDisponiveis = false,
  origemLocal = 'COFRE DO SVDD'
} = {}) {
  const [
    patrimoniosIndividuais,
    estoquesQuantidade,
    municoesQuantidade,
    patrimoniosComprometidos
  ] = await Promise.all([
    carregarRegistrosNormalizados(),
    carregarTonfasPorOrigem(origemLocal),
    carregarMunicoesPorOrigem(
      origemLocal
    ),
    buscarPatrimoniosComprometidos()
  ])

  let itens = [
    ...estoquesQuantidade,
    ...municoesQuantidade,
    ...patrimoniosIndividuais
  ]

const origem = normalizarTexto(origemLocal)

itens = itens.filter((item) => {
  if (item.controla_quantidade) {
    return true
  }

  if (
    item.patrimonio_id &&
    patrimoniosComprometidos.has(String(item.patrimonio_id))
  ) {
    return false
  }

  const local = normalizarTexto(item.local_atual)
  const status = normalizarTexto(item.status)

  // Nunca entregar itens que já estão cautelados,
  // em carga ou indisponíveis.
  if (
    [
      'CAUTELADO',
      'CARGA',
      'EM SERVIÇO',
      'EM_SERVICO',
      'MANUTENÇÃO',
      'MANUTENCAO',
      'BAIXADO',
      'BAIXADA',
      'APREENDIDO'
    ].includes(status)
  ) {
    return false
  }

  // Visão do SVDD
  if (origem.includes('SVDD')) {
    return (
      local.includes('COFRE DO SVDD') ||
      local === 'SVDD'
    )
  }

  // Visão do P4
  if (origem.includes('P4')) {
    return (
      local.includes('DEPÓSITO DO P4') ||
      local.includes('DEPOSITO DO P4') ||
      local.includes('COFRE DO P4') ||
      local.includes('GUARDA DO P4') ||
      local === 'P4'
    )
  }

  return true
})

  if (apenasDisponiveis) {
    itens = itens.filter(
      (item) =>
        item.disponivel
    )
  }

  const termo =
    normalizarTexto(busca)

  if (termo) {
    itens = itens.filter(
      (item) =>
        [
          item.patrimonio,
          item.descricao,
          item.categoria,
          item.local_atual,
          item.status,
          item.modulo,
          item.numero,
          item.identificacao_equipamento,
          item.numero_serie,
          item.serie,
          item.qr_code,
          item.codigo,
          item.id,
          item.referencia_id,
          item.tonfa_id,
          item.municao_id
        ].some((valor) =>
          normalizarTexto(
            valor
          ).includes(termo)
        )
    )
  }

  return itens.sort(
    (itemA, itemB) => {
      if (
        itemA.controla_quantidade &&
        !itemB.controla_quantidade
      ) {
        return -1
      }

      if (
        !itemA.controla_quantidade &&
        itemB.controla_quantidade
      ) {
        return 1
      }

      return String(
        itemA.descricao ?? ''
      ).localeCompare(
        String(
          itemB.descricao ?? ''
        ),
        'pt-BR'
      )
    }
  )
}


function normalizarComparacao(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function calibreCanonico(valor) {
  const texto =
    normalizarComparacao(valor)
      .replace(/^CALIBRE\s+/, '')

  if (!texto) return ''

  if (
    /(^|\D)5[.,]?56(\D|$)/.test(texto) ||
    texto.includes('556X45')
  ) {
    return '556'
  }

  if (/(^|\D)7[.,]?62(\D|$)/.test(texto)) {
    return '762'
  }

  if (texto.includes('380')) {
    return '380'
  }

  if (
    texto.includes('40 S&W') ||
    texto.includes('40SW') ||
    /(^|\D)\.?40(\D|$)/.test(texto)
  ) {
    return '40'
  }

  if (
    texto.includes('45 ACP') ||
    /(^|\D)\.?45(\D|$)/.test(texto)
  ) {
    return '45'
  }

  if (
    texto.includes('38 SPL') ||
    texto.includes('38 SPECIAL') ||
    /(^|\D)\.?38(\D|$)/.test(texto)
  ) {
    return '38'
  }

  if (
    texto.includes('9X19') ||
    /(^|\D)9\s*MM(\D|$)/.test(texto) ||
    /(^|\D)9(\D|$)/.test(texto)
  ) {
    return '9'
  }

  if (
    texto.includes('CAL 12') ||
    texto.includes('GAUGE 12') ||
    /(^|\D)12(\D|$)/.test(texto)
  ) {
    return '12'
  }

  return texto.replace(/[^A-Z0-9]/g, '')
}

function tipoHistorico(item) {
  const texto =
    normalizarComparacao(
      [
        item?.tipo,
        item?.categoria,
        item?.modulo,
        item?.descricao
      ]
        .filter(Boolean)
        .join(' ')
    )

  if (
    item?.municao_id ||
    texto.includes('MUNICAO')
  ) {
    return 'MUNICAO'
  }

  if (
    item?.tonfa_id ||
    texto.includes('TONFA')
  ) {
    return 'TONFA'
  }

  if (texto.includes('CASSETETE')) {
    return 'CASSETETE'
  }

  if (
    texto.includes('ARMA') ||
    texto.includes('PISTOLA') ||
    texto.includes('REVOLVER') ||
    texto.includes('FUZIL') ||
    texto.includes('CARABINA') ||
    texto.includes('ESPINGARDA')
  ) {
    return 'ARMA'
  }

  if (texto.includes('COP')) {
    return 'COP'
  }

  if (texto.includes('TASER')) {
    return 'TASER'
  }

  if (texto.includes('TPD')) {
    return 'TPD'
  }

  if (
    texto.includes('HT') ||
    texto.includes('RADIO')
  ) {
    return 'HT'
  }

  return (
    normalizarComparacao(item?.tipo) ||
    'MATERIAL'
  )
}

function descricaoKit(item) {
  return (
    item?.descricao ||
    item?.patrimonio ||
    item?.numero_serie ||
    item?.categoria ||
    item?.tipo ||
    'MATERIAL'
  )
}

function quantidadeKit(item) {
  return Math.max(
    1,
    numeroInteiro(
      item?.quantidade ||
      1
    ) || 1
  )
}

function quantidadeDisponivelAtual(item) {
  if (!item) {
    return 0
  }

  if (item?.disponivel === false) {
    return 0
  }

  if (item?.controla_quantidade) {
    return numeroInteiro(
      item?.quantidade_disponivel ??
      item?.quantidade_maxima ??
      0
    )
  }

  return 1
}

function itemMesmoTipoAtual(material, historico) {
  const tipoAtual =
    tipoHistorico(material)

  const tipoAnterior =
    tipoHistorico(historico)

  return tipoAtual === tipoAnterior
}

function encontrarMaterialExato({
  historico,
  materiais
}) {
  const tipo =
    tipoHistorico(historico)

  if (tipo === 'MUNICAO') {
    const calibreHistorico =
      calibreCanonico(
        historico?.calibre ||
        historico?.descricao
      )

    return (
      materiais.find((material) => {
        if (
          tipoHistorico(material) !==
          'MUNICAO'
        ) {
          return false
        }

        const calibreAtual =
          calibreCanonico(
            material?.calibre ||
            material?.descricao
          )

        return Boolean(
          calibreHistorico &&
          calibreAtual &&
          calibreHistorico ===
            calibreAtual
        )
      }) ||
      null
    )
  }

  if (
    tipo === 'TONFA' ||
    tipo === 'CASSETETE'
  ) {
    const referencia =
      String(
        historico?.tonfa_id ||
        historico?.referencia_id ||
        ''
      )

    const exato =
      referencia
        ? materiais.find(
            (material) =>
              String(
                material?.tonfa_id ||
                material?.referencia_id ||
                ''
              ) === referencia
          )
        : null

    if (exato) {
      return exato
    }

    return (
      materiais.find(
        (material) =>
          tipoHistorico(material) === tipo
      ) ||
      null
    )
  }

  const patrimonioId =
    String(
      historico?.patrimonio_id ||
      ''
    )

  if (patrimonioId) {
    const exato =
      materiais.find(
        (material) =>
          String(
            material?.patrimonio_id ||
            material?.id ||
            ''
          ) === patrimonioId
      )

    if (exato) {
      return exato
    }
  }

  return null
}

function alternativasMesmoTipo({
  historico,
  materiais,
  limite = 5
}) {
  const tipo =
    tipoHistorico(historico)

  if (
    tipo === 'MUNICAO' ||
    tipo === 'TONFA' ||
    tipo === 'CASSETETE'
  ) {
    return []
  }

  return materiais
    .filter(
      (material) =>
        itemMesmoTipoAtual(
          material,
          historico
        ) &&
        quantidadeDisponivelAtual(
          material
        ) > 0
    )
    .slice(
      0,
      Math.max(
        0,
        Number(limite || 0)
      )
    )
    .map(
      (material) => ({
        id:
          material?.id ||
          null,

        patrimonio_id:
          material?.patrimonio_id ||
          null,

        referencia_id:
          material?.referencia_id ||
          null,

        patrimonio:
          material?.patrimonio ||
          null,

        descricao:
          material?.descricao ||
          null,

        categoria:
          material?.categoria ||
          null,

        modulo:
          material?.modulo ||
          null
      })
    )
}

/*
 * Compara o último kit recebido com a disponibilidade atual.
 *
 * IMPORTANTE:
 * - Patrimônio individual: só seleciona automaticamente o MESMO item.
 * - Se o patrimônio anterior não estiver disponível, apenas informa
 *   alternativas; nunca troca silenciosamente.
 * - Munição: replica calibre + quantidade, nunca lote.
 * - Tonfa/Cassetete: replica tipo/quantidade do estoque quantitativo.
 *
 * `materiaisDisponiveis` deve ser a lista já atualizada pelo chamador.
 * No Mapa Força ela recebe, inclusive, a disponibilidade segura de munição
 * (físico - reservas pendentes).
 */
export function montarKitUltimoRecebido({
  itensHistorico = [],
  materiaisDisponiveis = []
} = {}) {
  const historico =
    Array.isArray(itensHistorico)
      ? itensHistorico
      : []

  const atuais =
    Array.isArray(materiaisDisponiveis)
      ? materiaisDisponiveis
      : []

  const selecionados = []
  const indisponiveis = []

  for (const itemHistorico of historico) {
    const tipo =
      tipoHistorico(
        itemHistorico
      )

    const quantidadeDesejada =
      quantidadeKit(
        itemHistorico
      )

    const material =
      encontrarMaterialExato({
        historico:
          itemHistorico,

        materiais:
          atuais
      })

    if (!material) {
      indisponiveis.push({
        motivo:
          tipo === 'MUNICAO'
            ? 'CALIBRE NÃO DISPONÍVEL'
            : (
                tipo === 'TONFA' ||
                tipo === 'CASSETETE'
              )
              ? 'ESTOQUE QUANTITATIVO INDISPONÍVEL'
              : 'PATRIMÔNIO ANTERIOR INDISPONÍVEL',

        tipo,

        descricao:
          descricaoKit(
            itemHistorico
          ),

        patrimonio_id:
          itemHistorico
            ?.patrimonio_id ||
          null,

        referencia_id:
          itemHistorico
            ?.referencia_id ||
          null,

        municao_id:
          itemHistorico
            ?.municao_id ||
          null,

        tonfa_id:
          itemHistorico
            ?.tonfa_id ||
          null,

        calibre:
          itemHistorico
            ?.calibre ||
          null,

        quantidade:
          quantidadeDesejada,

        alternativas:
          alternativasMesmoTipo({
            historico:
              itemHistorico,

            materiais:
              atuais
          })
      })

      continue
    }

    const disponivel =
      quantidadeDisponivelAtual(
        material
      )

    if (
      material?.controla_quantidade &&
      disponivel <
        quantidadeDesejada
    ) {
      indisponiveis.push({
        motivo:
          'QUANTIDADE INSUFICIENTE',

        tipo,

        descricao:
          descricaoKit(
            itemHistorico
          ),

        patrimonio_id:
          itemHistorico
            ?.patrimonio_id ||
          null,

        referencia_id:
          itemHistorico
            ?.referencia_id ||
          null,

        municao_id:
          itemHistorico
            ?.municao_id ||
          null,

        tonfa_id:
          itemHistorico
            ?.tonfa_id ||
          null,

        calibre:
          itemHistorico
            ?.calibre ||
          material?.calibre ||
          null,

        quantidade:
          quantidadeDesejada,

        quantidade_disponivel:
          disponivel,

        alternativas: []
      })

      continue
    }

    selecionados.push({
      ...material,

      quantidade:
        material?.controla_quantidade
          ? quantidadeDesejada
          : 1,

      origem_ultimo_recebido:
        true,

      item_historico: {
        tipo,

        descricao:
          descricaoKit(
            itemHistorico
          ),

        patrimonio_id:
          itemHistorico
            ?.patrimonio_id ||
          null,

        referencia_id:
          itemHistorico
            ?.referencia_id ||
          null,

        municao_id:
          itemHistorico
            ?.municao_id ||
          null,

        tonfa_id:
          itemHistorico
            ?.tonfa_id ||
          null,

        calibre:
          itemHistorico
            ?.calibre ||
          null,

        quantidade:
          quantidadeDesejada
      }
    })
  }

  return {
    completo:
      historico.length > 0 &&
      indisponiveis.length === 0,

    vazio:
      historico.length === 0,

    total_historico:
      historico.length,

    total_selecionado:
      selecionados.length,

    total_indisponivel:
      indisponiveis.length,

    selecionados,

    indisponiveis
  }
}

export async function buscarPatrimonioPorQrCode(
  valorQrCode,
  { origemLocal = 'COFRE DO SVDD' } = {}
) {
  const valor =
    normalizarTexto(
      valorQrCode
    )

  if (!valor) {
    return null
  }

  const itens =
    await listarPatrimoniosParaEntrega({
      busca: valor,
      origemLocal
    })

  return (
    itens.find((item) =>
      [
        item.qr_code,
        item.patrimonio,
        item.numero_patrimonio,
        item.numero,
        item.identificacao_equipamento,
        item.numero_serie,
        item.serie,
        item.codigo,
        item.id,
        item.referencia_id,
        item.tonfa_id,
        item.municao_id
      ].some(
        (campo) =>
          normalizarTexto(
            campo
          ) === valor
      )
    ) ||
    itens[0] ||
    null
  )
}
