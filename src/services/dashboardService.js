import { supabase } from './supabaseClient'

import {
  listarTimeline
} from './timelineService'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

const MOVIMENTACOES_TABLE =
  'sigmo_patrimonio_movimentacoes'

const TABELAS_REFERENCIA = {
  arma: 'sigmo_armas',
  armas: 'sigmo_armas',

  material: 'sigmo_materiais',
  materiais: 'sigmo_materiais',

  policial: 'policiais',
  policiais: 'policiais',

  municao: 'sigmo_municoes',
  municoes: 'sigmo_municoes'
}

function normalizarTipo(tipo) {
  return String(tipo ?? '')
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
    query = query.eq('status', status)
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

  inicio.setHours(0, 0, 0, 0)

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
    .eq('tipo', tipo)

  if (error) {
    throw error
  }

  return count ?? 0
}

async function listarTotaisPorModulo() {
  const {
    data,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('tipo')
    .neq('status', 'INATIVO')

  if (error) {
    throw error
  }

  const totais = {}

  for (const item of data ?? []) {
    const tipo = normalizarTipo(
      item.tipo || 'sem_tipo'
    )

    totais[tipo] =
      (totais[tipo] ?? 0) + 1
  }

  return Object
    .entries(totais)
    .map(([tipo, total]) => ({
      tipo,
      total
    }))
    .sort(
      (a, b) =>
        b.total - a.total
    )
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
    .in('id', ids)

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

  return {
    ...patrimonio,

    dados: {
      ...registroReferencia,
      ...dadosPatrimonio
    },

    registro_referencia:
      registroReferencia ?? null
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
    .neq('status', 'INATIVO')

  if (error) {
    throw error
  }

  const mapa = {}

  for (const item of data ?? []) {
    const tipo =
      normalizarTipo(
        item.tipo || 'outros'
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
        reserva: 0,
        divergencias: 0
      }
    }

    const categoria = mapa[tipo]

    const status = String(
      item.status ?? ''
    )
      .trim()
      .toUpperCase()

    const dados = objeto(item.dados)

    const possuiResponsavel = Boolean(
      dados.responsavel_re ||
      dados.re_responsavel ||
      dados.recebedor_re ||
      dados.policial_re ||
      dados.responsavel_nome ||
      dados.nome_responsavel ||
      dados.recebedor_nome ||
      dados.policial_nome
    )

    const possuiDivergencia = Boolean(
      dados.divergencia === true ||
      dados.possui_divergencia === true ||
      dados.conferencia_divergente === true ||
      status.includes('DIVERG')
    )

    categoria.total += 1

    if (status === 'ATIVO') {
      categoria.ativos += 1
    }

    if (status === 'DISPONIVEL') {
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

    if (possuiResponsavel) {
      categoria.comPolicial += 1
    } else if (
      status !== 'BAIXADO' &&
      status !== 'INATIVO'
    ) {
      categoria.reserva += 1
    }

    if (possuiDivergencia) {
      categoria.divergencias += 1
    }
  }

  return Object
    .values(mapa)
    .sort((a, b) =>
      String(a.tipo).localeCompare(
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
    .eq('tipo', tipoNormalizado)
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw error
  }

  const lista = patrimonios ?? []

  if (lista.length === 0) {
    return []
  }

  const tabelaReferencia =
    TABELAS_REFERENCIA[
      tipoNormalizado
    ]

  if (!tabelaReferencia) {
    return lista.map(
      (patrimonio) =>
        mesclarPatrimonio(
          patrimonio,
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
        patrimonio,
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
    timeline
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

    atualizadoEm:
      new Date().toISOString()
  }
}