import { supabase } from './supabaseClient'

import {
  listarTimeline
} from './timelineService'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

const MOVIMENTACOES_TABLE =
  'sigmo_patrimonio_movimentacoes'

const NOVIDADES_TABLE =
  'sigmo_patrimonio_novidades'

const TABELAS_REFERENCIA = {
  arma: 'sigmo_armas',
  armas: 'sigmo_armas',

  material: 'sigmo_materiais',
  materiais: 'sigmo_materiais',

  policial: 'policiais',
  policiais: 'policiais',

  municao: null,
  municoes: null,

  ht: 'sigmo_hts',
  hts: 'sigmo_hts'
}

function normalizarTipo(tipo) {
  return String(tipo ?? '')
    .trim()
    .toLowerCase()
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
}

function normalizarMaiusculo(valor) {
  return normalizarTexto(valor)
    .toUpperCase()
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

function patrimonioPermiteResponsavelAtual(item) {
  const statusAtual =
    normalizarMaiusculo(
      item?.status ||
      item?.status_operacional ||
      ''
    )

  const localAtual =
    normalizarMaiusculo(
      item?.local_atual ||
      item?.local ||
      ''
    )

  // O estado operacional vigente da tabela central prevalece sobre
  // snapshots históricos existentes em `dados` ou na tabela de referência.
  if (
    statusAtual.includes('RESERVA') ||
    localAtual.includes('COFRE')
  ) {
    return false
  }

  return (
    statusAtual.includes('CARGA') ||
    statusAtual.includes('CAUTELA') ||
    statusAtual.includes('EM_SERVICO') ||
    statusAtual.includes('EM SERVIÇO') ||
    localAtual.includes('CAUTELA')
  )
}

function obterResponsavel(item) {
  if (!patrimonioPermiteResponsavelAtual(item)) {
    return {
      re: '',
      nome: ''
    }
  }

  const dados = objeto(item?.dados)

  return {
    re:
      item?.responsavel_atual_re ||
      item?.responsavel_re ||
      item?.re_responsavel ||
      dados.responsavel_atual_re ||
      dados.responsavel_re ||
      dados.re_responsavel ||
      dados.recebedor_re ||
      dados.policial_re ||
      dados.carga_policial_re ||
      '',

    nome:
      item?.responsavel_atual_nome ||
      item?.responsavel_nome ||
      item?.nome_responsavel ||
      dados.responsavel_atual_nome ||
      dados.responsavel_nome ||
      dados.nome_responsavel ||
      dados.recebedor_nome ||
      dados.policial_nome ||
      dados.carga_policial_nome ||
      ''
  }
}

function obterLocalAtual(item) {
  const dados = objeto(item?.dados)

  return normalizarTexto(
    item?.local_atual ||
    item?.local ||
    dados.local_atual ||
    dados.local ||
    dados.unidade ||
    dados.setor ||
    ''
  )
}

function localEhCofre(local) {
  return normalizarMaiusculo(local)
    .includes('COFRE')
}

function localEhValido(local) {
  const valor =
    normalizarMaiusculo(local)

  if (!valor) {
    return false
  }

  return ![
    '-',
    'SEM LOCAL',
    'SEM LOCALIZAÇÃO',
    'SEM LOCALIZACAO',
    'NÃO INFORMADO',
    'NAO INFORMADO',
    'INDEFINIDO'
  ].includes(valor)
}

function possuiDivergencia(item) {
  const dados = objeto(item?.dados)

  const status =
    normalizarMaiusculo(
      item?.status
    )

  return Boolean(
    dados.divergencia === true ||
    dados.possui_divergencia === true ||
    dados.conferencia_divergente === true ||
    status.includes('DIVERG')
  )
}

async function contarPatrimonios({
  status = null,
  tipo = null
} = {}) {
  let query = supabase
    .from(PATRIMONIOS_TABLE)
    .select('id', {
      count: 'exact',
      head: true
    })

  if (status) {
  query = query.eq(
    'status',
    status
  )
} else {
  query = query.neq(
    'status',
    'INATIVO'
  )
}

  if (tipo) {
    query = query.eq(
      'tipo',
      normalizarTipo(tipo)
    )
  }

  const {
    count,
    error
  } = await query

  if (error) {
    throw error
  }

  return count ?? 0
}

async function contarMovimentacoesDoDia() {
  const inicio = new Date()

  inicio.setHours(
    0,
    0,
    0,
    0
  )

  const {
    count,
    error
  } = await supabase
    .from(MOVIMENTACOES_TABLE)
    .select('id', {
      count: 'exact',
      head: true
    })
    .gte(
      'created_at',
      inicio.toISOString()
    )

  if (error) {
    throw error
  }

  return count ?? 0
}

async function contarMovimentacoesPorTipo(
  tipo
) {
  const {
    count,
    error
  } = await supabase
    .from(MOVIMENTACOES_TABLE)
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq(
      'tipo_movimentacao',
      tipo
    )

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function listarNovidadesPatrimoniais({
  limite = 8
} = {}) {
  const limiteSeguro = Math.max(
    1,
    Math.min(
      Number(limite) || 8,
      50
    )
  )

  let query = supabase
    .from(NOVIDADES_TABLE)
    .select('*')

  if (status) {
    query = query.ilike(
      'status',
      status
    )
  }

  const {
    data,
    error
  } = await query
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .limit(limiteSeguro)

  if (error) {
    throw error
  }

  const novidades =
    data ?? []

  if (novidades.length === 0) {
    return []
  }

  const novidadeIds =
    novidades
      .map((item) => item?.id)
      .filter(Boolean)

  const {
    data: fotos,
    error: fotosError
  } = await supabase
    .from(
      'sigmo_patrimonio_novidades_fotos'
    )
    .select('*')
    .in(
      'novidade_id',
      novidadeIds
    )
    .order(
      'principal',
      {
        ascending: false
      }
    )
    .order(
      'ordem',
      {
        ascending: true
      }
    )
    .order(
      'created_at',
      {
        ascending: true
      }
    )

  if (fotosError) {
    console.warn(
      'Não foi possível carregar as fotos das novidades patrimoniais:',
      fotosError
    )
  }

  const fotosPorNovidade =
    new Map()

  for (const foto of fotos ?? []) {
    const chave =
      String(
        foto?.novidade_id ||
        ''
      )

    if (!chave) {
      continue
    }

    if (!fotosPorNovidade.has(chave)) {
      fotosPorNovidade.set(
        chave,
        []
      )
    }

    fotosPorNovidade
      .get(chave)
      .push(foto)
  }

  // patrimonio_id da novidade aponta para sigmo_patrimonios.id.
  // Primeiro enriquecemos pela tabela central; depois, quando houver
  // referencia_id, buscamos o registro específico do módulo.
  const patrimonioIds = [
    ...new Set(
      novidades
        .map(
          (item) =>
            item?.patrimonio_id
        )
        .filter(Boolean)
        .map(String)
    )
  ]

  let patrimoniosPorId =
    new Map()

  if (patrimonioIds.length > 0) {
    const {
      data: patrimonios,
      error: patrimoniosError
    } = await supabase
      .from(PATRIMONIOS_TABLE)
      .select('*')
      .in(
        'id',
        patrimonioIds
      )

    if (patrimoniosError) {
      console.warn(
        'Não foi possível enriquecer as novidades com o patrimônio central:',
        patrimoniosError
      )
    } else {
      patrimoniosPorId =
        new Map(
          (patrimonios ?? []).map(
            (patrimonio) => [
              String(patrimonio.id),
              patrimonio
            ]
          )
        )
    }
  }

  const idsReferenciaPorTabela =
    new Map()

  for (const patrimonio of patrimoniosPorId.values()) {
    const tipo =
      normalizarTipo(
        patrimonio?.tipo
      )

    const tabela =
      TABELAS_REFERENCIA[tipo]

    const referenciaId =
      patrimonio?.referencia_id

    if (
      !tabela ||
      !referenciaId
    ) {
      continue
    }

    if (!idsReferenciaPorTabela.has(tabela)) {
      idsReferenciaPorTabela.set(
        tabela,
        new Set()
      )
    }

    idsReferenciaPorTabela
      .get(tabela)
      .add(
        String(referenciaId)
      )
  }

  const referenciasPorTabela =
    new Map()

  for (
    const [tabela, idsSet]
    of idsReferenciaPorTabela.entries()
  ) {
    const registros =
      await buscarRegistrosReferencia(
        tabela,
        [...idsSet]
      )

    referenciasPorTabela.set(
      tabela,
      new Map(
        registros.map(
          (registro) => [
            String(registro.id),
            registro
          ]
        )
      )
    )
  }

  return novidades.map(
    (item) => {
      const fotosItem =
        fotosPorNovidade.get(
          String(item?.id || '')
        ) || []

      const patrimonioCentral =
        patrimoniosPorId.get(
          String(
            item?.patrimonio_id ||
            ''
          )
        ) || null

      const tipo =
        normalizarTipo(
          patrimonioCentral?.tipo ||
          item?.tipo_patrimonio
        )

      const tabela =
        TABELAS_REFERENCIA[tipo]

      const registroReferencia =
        tabela &&
        patrimonioCentral?.referencia_id
          ? referenciasPorTabela
              .get(tabela)
              ?.get(
                String(
                  patrimonioCentral.referencia_id
                )
              ) || null
          : null

      const dadosCentral =
        objeto(
          patrimonioCentral?.dados
        )

      const identificacao =
        normalizarTexto(
          registroReferencia?.patrimonio ||
          registroReferencia?.numero_serie ||
          registroReferencia?.numero_patrimonio ||
          patrimonioCentral?.identificador ||
          patrimonioCentral?.numero_patrimonio ||
          patrimonioCentral?.patrimonio ||
          patrimonioCentral?.numero_serie ||
          dadosCentral?.numero_patrimonio ||
          dadosCentral?.patrimonio ||
          dadosCentral?.numero_serie ||
          ''
        )

      const numeroSerie =
        normalizarTexto(
          registroReferencia?.numero_serie ||
          patrimonioCentral?.numero_serie ||
          dadosCentral?.numero_serie ||
          identificacao
        )

      return {
        ...item,

        patrimonio:
          item?.patrimonio ||
          identificacao ||
          null,

        numero_serie:
          item?.numero_serie ||
          numeroSerie ||
          null,

        especie:
          item?.especie ||
          registroReferencia?.especie ||
          null,

        // Situação operacional vigente do material. Esses campos permitem
        // que a Central classifique a novidade pelo responsável atual,
        // e não pela origem histórica que gerou a ocorrência.
        local_atual:
          registroReferencia?.local_atual ||
          patrimonioCentral?.local_atual ||
          dadosCentral?.local_atual ||
          null,

        status_operacional:
          registroReferencia?.status_operacional ||
          patrimonioCentral?.status ||
          dadosCentral?.status_operacional ||
          null,

        referencia_id:
          item?.referencia_id ||
          patrimonioCentral?.referencia_id ||
          null,

        fotos:
          fotosItem,

        foto_url:
          fotosItem.find(
            (foto) =>
              foto?.principal === true
          )?.foto_url ||
          fotosItem[0]?.foto_url ||
          null
      }
    }
  )
}

async function listarTotaisPorModulo() {
  const {
    data,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('tipo')
    .neq(
      'status',
      'INATIVO'
    )

  if (error) {
    throw error
  }

  const totais = {}

  for (const item of data ?? []) {
    const tipo =
      normalizarTipo(
        item.tipo ||
        'sem_tipo'
      )

    totais[tipo] =
      (totais[tipo] ?? 0) + 1
  }

  return Object
    .entries(totais)
    .map(
      ([tipo, total]) => ({
        tipo,
        total
      })
    )
    .sort(
      (a, b) =>
        b.total - a.total
    )
}


async function buscarOrigensCautelaPorPatrimonio(patrimonioIds = []) {
  const ids = [
    ...new Set(
      (patrimonioIds || [])
        .filter(Boolean)
        .map(String)
    )
  ]

  if (ids.length === 0) {
    return new Map()
  }

  const { data: itens, error: itensError } = await supabase
    .from('sigmo_movimentacao_itens')
    .select('patrimonio_id, movimentacao_id')
    .in('patrimonio_id', ids)

  if (itensError) {
    throw itensError
  }

  const movimentacaoIds = [
    ...new Set(
      (itens || [])
        .map((item) => item?.movimentacao_id)
        .filter(Boolean)
        .map(String)
    )
  ]

  if (movimentacaoIds.length === 0) {
    return new Map()
  }

  const { data: movimentacoes, error: movimentacoesError } = await supabase
    .from('sigmo_movimentacoes')
    .select(
      'id, tipo_movimentacao, status, origem_local, destino_local, recebedor_id, recebedor_nome, created_at'
    )
    .in('id', movimentacaoIds)
    .eq('tipo_movimentacao', 'CAUTELA')
    .eq('status', 'finalizada')
    .order('created_at', { ascending: false })

  if (movimentacoesError) {
    throw movimentacoesError
  }

  const movimentacaoPorId = new Map(
    (movimentacoes || []).map((item) => [String(item.id), item])
  )

  const itensPorPatrimonio = new Map()

  for (const item of itens || []) {
    const patrimonioId = String(item?.patrimonio_id || '')
    const movimentacao = movimentacaoPorId.get(
      String(item?.movimentacao_id || '')
    )

    if (!patrimonioId || !movimentacao) {
      continue
    }

    const destino = normalizarMaiusculo(
      movimentacao?.destino_local
    )

    if (destino !== 'CAUTELA INDIVIDUAL') {
      continue
    }

    const atual = itensPorPatrimonio.get(patrimonioId)

    if (
      !atual ||
      new Date(movimentacao.created_at).getTime() >
        new Date(atual.created_at).getTime()
    ) {
      itensPorPatrimonio.set(
        patrimonioId,
        movimentacao
      )
    }
  }

  return itensPorPatrimonio
}

async function buscarRegistrosReferencia(
  tabela,
  ids
) {
  if (
    !tabela ||
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from(tabela)
    .select('*')
    .in(
      'id',
      ids
    )

  if (error) {
    console.warn(
      `Fonte patrimonial indisponível: ${tabela}`,
      error
    )

    return []
  }

  return data ?? []
}

function mesclarPatrimonio(
  patrimonio,
  registroReferencia
) {
  const dadosPatrimonio =
    objeto(patrimonio?.dados)

  const tipoPatrimonio =
    normalizarTipo(patrimonio?.tipo)

  const referenciaHT =
    ['ht', 'hts'].includes(tipoPatrimonio) &&
    registroReferencia

  const dadosMesclados = {
    ...registroReferencia,
    ...dadosPatrimonio
  }

  const patrimonioMesclado = {
    ...registroReferencia,
    ...dadosPatrimonio,
    ...patrimonio,

    // Para HT, sigmo_hts é a fonte operacional vigente. O registro central
    // continua fornecendo o vínculo patrimonial, mas não deve sobrescrever
    // status/local atuais do módulo.
    ...(referenciaHT
      ? {
          status_operacional:
            registroReferencia?.status_operacional ||
            patrimonio?.status_operacional ||
            patrimonio?.status ||
            '',
          local_atual:
            registroReferencia?.local_atual ||
            patrimonio?.local_atual ||
            '',
          status:
            patrimonio?.status ||
            registroReferencia?.status ||
            ''
        }
      : {}),

    dados:
      dadosMesclados,

    registro_referencia:
      registroReferencia ?? null
  }

  const responsavel =
    obterResponsavel(
      patrimonioMesclado
    )

  const localAtual =
    obterLocalAtual(
      patrimonioMesclado
    )

  const comPolicial =
    Boolean(
      responsavel.re ||
      responsavel.nome
    )

  const noCofre =
    !comPolicial &&
    localEhCofre(localAtual)

  const localizado =
    !comPolicial &&
    !noCofre &&
    localEhValido(localAtual)

  return {
    ...patrimonioMesclado,

    // A linha vigente de sigmo_patrimonios é a fonte operacional.
    // Campos vindos de `dados` ou da tabela de referência são apenas histórico/fallback.
    status_operacional:
      referenciaHT
        ? (
            registroReferencia?.status_operacional ||
            patrimonioMesclado?.status_operacional ||
            patrimonio?.status ||
            ''
          )
        : (
            patrimonio?.status ||
            patrimonioMesclado?.status_operacional ||
            patrimonioMesclado?.status ||
            ''
          ),

    responsavel_atual_id:
      patrimonio?.responsavel_atual_id ||
      patrimonioMesclado?.responsavel_atual_id ||
      null,

    responsavel_atual_nome:
      patrimonio?.responsavel_atual_nome ||
      patrimonioMesclado?.responsavel_atual_nome ||
      null,

    responsavel_re:
      responsavel.re,

    responsavel_nome:
      responsavel.nome,

    local_atual:
      referenciaHT
        ? (
            registroReferencia?.local_atual ||
            localAtual ||
            patrimonio?.local_atual ||
            'NÃO INFORMADO'
          )
        : (
            patrimonio?.local_atual ||
            localAtual ||
            'NÃO INFORMADO'
          ),

    com_policial:
      comPolicial,

    no_cofre:
      noCofre,

    localizado,

    sem_localizacao:
      !comPolicial &&
      !noCofre &&
      !localizado
  }
}

export async function listarCategoriasOperacionais() {
  const {
    data,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select(`
      id,
      tipo,
      status,
      local_atual,
      companhia_atual,
      dados
    `)
    .neq(
      'status',
      'INATIVO'
    )

  if (error) {
    throw error
  }

  const mapa = {}

  for (const item of data ?? []) {
    const tipo =
      normalizarTipo(
        item.tipo ||
        'outros'
      )

    if (!mapa[tipo]) {
      mapa[tipo] = {
        tipo,

        total: 0,

        ativos: 0,
        disponiveis: 0,
        cautelados: 0,
        baixados: 0,
        recolhidos: 0,

        comPolicial: 0,
        com_policial: 0,

        noCofre: 0,
        no_cofre: 0,

        localizados: 0,
        localizado: 0,

        semLocalizacao: 0,
        sem_localizacao: 0,

        reserva: 0,

        divergencias: 0
      }
    }

    const categoria =
      mapa[tipo]

    const status =
      normalizarMaiusculo(
        item.status
      )

    const itemClassificado =
      mesclarPatrimonio(
        item,
        null
      )

    const comPolicial =
      itemClassificado.com_policial

    const noCofre =
      itemClassificado.no_cofre

    const localizado =
      itemClassificado.localizado

    const semLocalizacao =
      itemClassificado.sem_localizacao

    categoria.total += 1

    if (status === 'ATIVO') {
      categoria.ativos += 1
    }

    if (
      status === 'DISPONIVEL' ||
      status === 'DISPONÍVEL'
    ) {
      categoria.disponiveis += 1
    }

    if (status === 'CAUTELADO') {
      categoria.cautelados += 1
    }

    if (status === 'BAIXADO') {
      categoria.baixados += 1
    }

    if (status === 'RECOLHIDO') {
      categoria.recolhidos += 1
    }

    if (comPolicial) {
      categoria.comPolicial += 1
      categoria.com_policial += 1
    }

    if (noCofre) {
      categoria.noCofre += 1
      categoria.no_cofre += 1
      categoria.reserva += 1
    }

    if (localizado) {
      categoria.localizados += 1
      categoria.localizado += 1
    }

    if (semLocalizacao) {
      categoria.semLocalizacao += 1
      categoria.sem_localizacao += 1
    }

    if (
      possuiDivergencia(item)
    ) {
      categoria.divergencias += 1
    }
  }

  return Object
    .values(mapa)
    .sort(
      (a, b) =>
        String(a.tipo)
          .localeCompare(
            String(b.tipo),
            'pt-BR'
          )
    )
}

export async function listarPatrimoniosCategoria(
  tipo
) {
  const tipoNormalizado =
    normalizarTipo(tipo)

  const {
    data: patrimonios,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')
    .eq(
      'tipo',
      tipoNormalizado
    )
    .neq(
      'status',
      'INATIVO'
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    throw error
  }

  const lista =
    patrimonios ?? []

  if (lista.length === 0) {
    return []
  }

  const origensCautelaPorPatrimonio =
    await buscarOrigensCautelaPorPatrimonio(
      lista.map((item) => item?.id)
    )

  const enriquecerOrigemOperacional = (patrimonio) => {
    const cautelaAtual =
      origensCautelaPorPatrimonio.get(
        String(patrimonio?.id || '')
      )

    if (!cautelaAtual) {
      return patrimonio
    }

    return {
      ...patrimonio,
      origem_local:
        patrimonio?.origem_local ||
        cautelaAtual?.origem_local ||
        null,
      local_origem:
        patrimonio?.local_origem ||
        cautelaAtual?.origem_local ||
        null,
      cautela_movimentacao_id:
        cautelaAtual?.id ||
        null,
      cautela_recebedor_id:
        cautelaAtual?.recebedor_id ||
        null,
      cautela_recebedor_nome:
        cautelaAtual?.recebedor_nome ||
        null
    }
  }

  const tabelaReferencia =
    TABELAS_REFERENCIA[
      tipoNormalizado
    ]

  if (!tabelaReferencia) {
    return lista.map(
      (patrimonio) =>
        mesclarPatrimonio(
          enriquecerOrigemOperacional(
            patrimonio
          ),
          null
        )
    )
  }

  const ids = [
    ...new Set(
      lista
        .map(
          (item) =>
            item.referencia_id
        )
        .filter(Boolean)
    )
  ]

  const registrosReferencia =
    await buscarRegistrosReferencia(
      tabelaReferencia,
      ids
    )

  const referenciasPorId =
    new Map(
      registrosReferencia.map(
        (registro) => [
          String(registro.id),
          registro
        ]
      )
    )

  return lista.map(
    (patrimonio) => {
      const registro =
        referenciasPorId.get(
          String(
            patrimonio.referencia_id
          )
        )

      return mesclarPatrimonio(
        enriquecerOrigemOperacional(
          patrimonio
        ),
        registro
      )
    }
  )
}

export async function carregarDashboardPatrimonial() {
  const [
    total,
    ativos,
    disponiveis,
    cautelados,
    recolhidos,
    baixados,
    movimentacoesHoje,
    recebimentos,
    transferencias,
    baixas,
    totaisPorModulo,
    timeline,
    novidades
  ] = await Promise.all([
    contarPatrimonios(),

    contarPatrimonios({
      status: 'ATIVO'
    }),

    contarPatrimonios({
      status: 'DISPONIVEL'
    }),

    contarPatrimonios({
      status: 'CAUTELADO'
    }),

    contarPatrimonios({
      status: 'RECOLHIDO'
    }),

    contarPatrimonios({
      status: 'BAIXADO'
    }),

    contarMovimentacoesDoDia(),

    contarMovimentacoesPorTipo(
      'RECEBIMENTO'
    ),

    contarMovimentacoesPorTipo(
      'TRANSFERENCIA'
    ),

    contarMovimentacoesPorTipo(
      'BAIXA'
    ),

    listarTotaisPorModulo(),

    listarTimeline({
      limite: 12
    }),

    listarNovidadesPatrimoniais({
      limite: 8
    })
  ])

  const operacionais =
    ativos +
    disponiveis +
    cautelados +
    recolhidos

  const percentualOperacional =
    total > 0
      ? Math.round(
          (
            operacionais /
            total
          ) * 100
        )
      : 0

  return {
    cards: {
      total,
      ativos,
      disponiveis,
      cautelados,
      recolhidos,
      baixados,
      movimentacoesHoje
    },

    movimentacoes: {
      recebimentos,
      transferencias,
      baixas
    },

    indicadores: {
      operacionais,
      percentualOperacional
    },

    totaisPorModulo,
    timeline,
    novidades,

    atualizadoEm:
      new Date().toISOString()
  }
}