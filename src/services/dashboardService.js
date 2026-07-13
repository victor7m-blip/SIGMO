import { supabase } from './supabaseClient'

import {
  listarTimeline
} from './timelineService'

const PATRIMONIOS_TABLE = 'sigmo_patrimonios'
const MOVIMENTACOES_TABLE = 'sigmo_patrimonio_movimentacoes'

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
      String(tipo).trim().toLowerCase()
    )
  }

  const { count, error } = await query

  if (error) throw error

  return count ?? 0
}

async function contarMovimentacoesDoDia() {
  const inicio = new Date()

  inicio.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from(MOVIMENTACOES_TABLE)
    .select('id', {
      count: 'exact',
      head: true
    })
    .gte('created_at', inicio.toISOString())

  if (error) throw error

  return count ?? 0
}

async function contarMovimentacoesPorTipo(tipo) {
  const { count, error } = await supabase
    .from(MOVIMENTACOES_TABLE)
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('tipo', tipo)

  if (error) throw error

  return count ?? 0
}

async function listarTotaisPorModulo() {
  const { data, error } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('tipo')
    .neq('status', 'INATIVO')

  if (error) throw error

  const totais = {}

  for (const item of data ?? []) {
    const tipo = String(item.tipo || 'sem_tipo').toLowerCase()

    totais[tipo] = (totais[tipo] ?? 0) + 1
  }

  return Object.entries(totais)
    .map(([tipo, total]) => ({
      tipo,
      total
    }))
    .sort((a, b) => b.total - a.total)
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

    contarMovimentacoesPorTipo('RECEBIMENTO'),

    contarMovimentacoesPorTipo('TRANSFERENCIA'),

    contarMovimentacoesPorTipo('BAIXA'),

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
      ? Math.round((operacionais / total) * 100)
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

    atualizadoEm: new Date().toISOString()
  }
}