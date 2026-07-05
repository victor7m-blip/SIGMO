import { supabase } from './supabaseClient'

const TABLE = 'policiais'

export async function listarPoliciais({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio = (pagina - 1) * limite
  const fim = inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order(sortBy, {
      ascending: sortDirection === 'asc',
      nullsFirst: false
    })
    .range(inicio, fim)

  if (filtros.nome?.trim()) {
    query = query.ilike('nome', `%${filtros.nome.trim()}%`)
  }

  if (filtros.nome_guerra?.trim()) {
    query = query.ilike('nome_guerra', `%${filtros.nome_guerra.trim()}%`)
  }

  if (filtros.re?.trim()) {
    query = query.ilike('re', `%${filtros.re.trim()}%`)
  }

  if (filtros.qr_code?.trim()) {
    query = query.ilike('qr_code', `%${filtros.qr_code.trim()}%`)
  }

  if (filtros.posto_graduacao?.trim()) {
    query = query.eq('posto_graduacao', filtros.posto_graduacao)
  }

  if (filtros.companhia?.trim()) {
    query = query.ilike('companhia', `%${filtros.companhia.trim()}%`)
  }

  if (filtros.pelotao?.trim()) {
    query = query.ilike('pelotao', `%${filtros.pelotao.trim()}%`)
  }

  if (filtros.situacao?.trim()) {
    query = query.eq('situacao', filtros.situacao)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: data ?? [],
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

export function listarPostosGraduacoes() {
  return buscarValoresUnicos('posto_graduacao')
}

export function listarCompanhias() {
  return buscarValoresUnicos('companhia')
}

export function listarPelotoes() {
  return buscarValoresUnicos('pelotao')
}

export function listarSituacoesPoliciais() {
  return buscarValoresUnicos('situacao')
}

export async function cadastrarPolicial(payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...payload,
      qr_code: payload.qr_code || null
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function atualizarPolicial(id, payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...payload,
      qr_code: payload.qr_code || null
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function excluirPolicial(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}