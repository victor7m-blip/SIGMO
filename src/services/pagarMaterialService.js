import { supabase } from './supabaseClient'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

const TONFAS_TABLE =
  'sigmo_tonfas'

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

  return (
    referencia?.patrimonio ||
    referencia?.numero_patrimonio ||
    dados.patrimonio ||
    dados.numero_patrimonio ||
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
    'APREENDIDO',
    'INATIVO'
  ].includes(statusNormalizado)

  if (statusBloqueado) {
    return false
  }

  if (statusPermitido) {
    return true
  }

  return [
    'COFRE DO SVDD',
    'SVDD',
    'SERVIÇO DE DIA',
    'SERVICO DE DIA'
  ].some((local) =>
    localNormalizado.includes(local)
  )
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

  const localAtual =
    normalizarTexto(
      obterLocal({
        patrimonioCentral,
        referencia
      })
    )

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
        referencia?.numero_serie ||
        referencia?.serie ||
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

export async function listarPatrimoniosParaEntrega({
  busca = '',
  apenasDisponiveis = false,
  origemLocal = 'COFRE DO SVDD'
} = {}) {
  const [
    patrimoniosIndividuais,
    estoquesQuantidade
  ] = await Promise.all([
    carregarRegistrosNormalizados(),
    carregarTonfasPorOrigem(origemLocal)
  ])

  let itens = [
    ...estoquesQuantidade,
    ...patrimoniosIndividuais
  ]

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
          item.numero_serie,
          item.serie,
          item.qr_code,
          item.codigo,
          item.id,
          item.referencia_id,
          item.tonfa_id
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
        item.numero_serie,
        item.serie,
        item.codigo,
        item.id,
        item.referencia_id,
        item.tonfa_id
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
