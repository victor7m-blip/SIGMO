import { supabase } from './supabaseClient'

import {
  criarMovimentacaoCompleta
} from './movimentacaoEngine'

function limpar(valor) {
  return String(valor ?? '').trim()
}

function obterPolicialId(user) {
  return (
    user?.policial_id ||
    user?.id_policial ||
    user?.policial?.id ||
    null
  )
}

function obterRe(user) {
  return limpar(
    user?.re ||
    user?.policial?.re ||
    ''
  )
    .replace(/[^0-9A-Z]/gi, '')
    .slice(0, 6)
}

export async function listarArmasCargaPessoal(user) {
  const policialId = obterPolicialId(user)
  const re = obterRe(user)

  let query = supabase
    .from('sigmo_armas')
    .select(
      'id, patrimonio, numero_serie, especie, marca, modelo, calibre, acabamento, status, local_atual, foto_url, carga_policial_id, carga_policial_re, carga_policial_nome, updated_at'
    )
    .eq('ativo', true)
    .eq('status', 'CARGA')
    .eq('local_atual', 'CARGA PERMANENTE')
    .order('especie', { ascending: true })
    .order('numero_serie', { ascending: true })

  if (policialId) {
    query = query.eq(
      'carga_policial_id',
      policialId
    )
  } else if (re) {
    query = query.eq(
      'carga_policial_re',
      re
    )
  } else {
    return []
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}


export async function solicitarDevolucaoCargaAoP4({
  arma,
  user,
  observacoes = ''
}) {
  if (!arma?.id) {
    throw new Error('Arma não identificada.')
  }

  if (!user) {
    throw new Error('Usuário não identificado.')
  }

  const status = limpar(arma.status).toUpperCase()
  const local = limpar(arma.local_atual).toUpperCase()

  if (
    status !== 'CARGA' ||
    local !== 'CARGA PERMANENTE'
  ) {
    throw new Error(
      'Esta arma não está em carga permanente.'
    )
  }

  let patrimonioId = arma.patrimonio_id || null

  if (!patrimonioId) {
    const { data, error } = await supabase
      .from('sigmo_patrimonios')
      .select('id')
      .eq('tipo', 'arma')
      .eq('referencia_id', arma.id)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      throw error
    }

    patrimonioId = data?.id || null
  }

  if (!patrimonioId) {
    throw new Error(
      'O patrimônio vinculado a esta arma não foi encontrado.'
    )
  }

  const movimentacao =
    await criarMovimentacaoCompleta({
      tipo: 'TRANSFERÊNCIA PARA O P4',
      origemLocal: 'CARGA PERMANENTE',
      destinoLocal: 'DEPÓSITO DO P4',
      solicitante: user,
      recebedor: null,
      observacoes:
        observacoes ||
        'DEVOLUÇÃO DE CARGA PESSOAL AO P4',
      itens: [
        {
          patrimonio_id: patrimonioId,
          quantidade: 1,
          observacao:
            'DEVOLUÇÃO DE CARGA PESSOAL AO P4'
        }
      ],
      aprovarAutomaticamente: true
    })

  return movimentacao
}
