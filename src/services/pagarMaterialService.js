import { supabase } from './supabaseClient'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

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
    referencia?.status ||
    dados.status ||
    referencia?.situacao ||
    dados.situacao ||
    'SEM STATUS'
  )
}

function registroDisponivel(status) {
  return [
    'DISPONÍVEL',
    'DISPONIVEL',
    'ATIVO'
  ].includes(
    normalizarTexto(status)
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

  return {
    ...referencia,
    ...dados,
    ...patrimonioCentral,

    /*
     * ID canônico usado pelas RPCs
     * e pelo motor de movimentações.
     */
    id:
      patrimonioCentral.id,

    patrimonio_id:
      patrimonioCentral.id,

    /*
     * ID existente na tabela específica,
     * como sigmo_armas ou sigmo_materiais.
     */
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
      normalizarTexto(
        obterLocal({
          patrimonioCentral,
          referencia
        })
      ),

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

    disponivel:
      registroDisponivel(status)
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
  apenasDisponiveis = false
} = {}) {
  let itens =
    await carregarRegistrosNormalizados()

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
          item.referencia_id
        ].some((valor) =>
          normalizarTexto(
            valor
          ).includes(termo)
        )
    )
  }

  return itens.sort(
    (itemA, itemB) =>
      String(
        itemA.descricao ?? ''
      ).localeCompare(
        String(
          itemB.descricao ?? ''
        ),
        'pt-BR'
      )
  )
}

export async function buscarPatrimonioPorQrCode(
  valorQrCode
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
      busca: valor
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
        item.referencia_id
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