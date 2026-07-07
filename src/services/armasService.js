import { supabase } from './supabaseClient'
import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_armas'

function normalizarStatus(status) {
  if (!status) return 'RESERVA'

  const valor = String(status).trim().toUpperCase()

  if (valor === 'DISPONÍVEL' || valor === 'DISPONIVEL') {
    return 'RESERVA'
  }

  return valor
}

function normalizarArma(arma) {
  return {
    ...arma,
    status_operacional: normalizarStatus(
      arma.status_operacional || arma.status
    )
  }
}

export async function listarArmas({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio = (pagina - 1) * limite
  const fim = inicio + limite - 1

  const campoOrdenacao =
    sortBy === 'status_operacional' ? 'status' : sortBy

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order(campoOrdenacao, {
      ascending: sortDirection === 'asc',
      nullsFirst: false
    })
    .range(inicio, fim)

  if (filtros.patrimonio?.trim()) {
    query = query.ilike('patrimonio', `%${filtros.patrimonio.trim()}%`)
  }

  if (filtros.numero_serie?.trim()) {
    query = query.ilike('numero_serie', `%${filtros.numero_serie.trim()}%`)
  }

  if (filtros.qr_code?.trim()) {
    query = query.ilike('qr_code', `%${filtros.qr_code.trim()}%`)
  }

  if (filtros.especie?.trim()) {
    query = query.ilike('especie', `%${filtros.especie.trim()}%`)
  }

  if (filtros.calibre?.trim()) {
    query = query.ilike('calibre', `%${filtros.calibre.trim()}%`)
  }

  if (filtros.status?.trim()) {
    query = query.eq('status', filtros.status)
  }

  if (filtros.unidade?.trim()) {
    query = query.ilike('unidade', `%${filtros.unidade.trim()}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []).map(normalizarArma),
    total: count ?? 0
  }
}

async function buscarValoresUnicos(campo) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(campo)

  if (error) throw error

  return [...new Set(
    (data || [])
      .map((item) => item[campo])
      .filter(Boolean)
  )].sort()
}

export function listarEspecies() {
  return buscarValoresUnicos('especie')
}

export function listarCalibres() {
  return buscarValoresUnicos('calibre')
}

export function listarUnidades() {
  return buscarValoresUnicos('unidade')
}

export async function cadastrarArma(payload, user = null) {
  const statusNormalizado = normalizarStatus(
    payload.status_operacional || payload.status
  )

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...payload,
      status: statusNormalizado,
      qr_code: payload.qr_code || null
    })
    .select()
    .single()

  if (error) throw error

  const armaNormalizada = normalizarArma(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'arma',
    referencia_id: armaNormalizada.id,
    dados: armaNormalizada,
    user,
    local_atual: armaNormalizada.local_atual || 'Guarda do Quartel',
    companhia_atual: armaNormalizada.unidade || ''
  })

  return armaNormalizada
}

export async function atualizarArma(id, payload, user = null) {
  const statusNormalizado = normalizarStatus(
    payload.status_operacional || payload.status
  )

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...payload,
      status: statusNormalizado,
      qr_code: payload.qr_code || null
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const armaNormalizada = normalizarArma(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'arma',
    referencia_id: armaNormalizada.id,
    dados: armaNormalizada,
    user,
    local_atual: armaNormalizada.local_atual || 'Guarda do Quartel',
    companhia_atual: armaNormalizada.unidade || ''
  })

  return armaNormalizada
}

export async function excluirArma(id, user = null) {
  await desativarPatrimonioPorReferencia({
    tipo: 'arma',
    referencia_id: id,
    user,
    motivo: 'Arma excluída ou baixada no cadastro específico.'
  })

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function sincronizarArmasComPatrimonios(user = null) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const armasNormalizadas = (data || []).map(normalizarArma)

  for (const arma of armasNormalizadas) {
    await criarOuAtualizarPatrimonio({
      tipo: 'arma',
      referencia_id: arma.id,
      dados: arma,
      user,
      local_atual: arma.local_atual || 'Guarda do Quartel',
      companhia_atual: arma.unidade || ''
    })
  }

  return armasNormalizadas.length
}