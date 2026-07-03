import { supabase } from './supabaseClient'

const TABLE = 'sigmo_armas'

export async function listarArmas({
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

  if (filtros.patrimonio?.trim()) {
    query = query.ilike('patrimonio', `%${filtros.patrimonio.trim()}%`)
  }

  if (filtros.numero_serie?.trim()) {
    query = query.ilike('numero_serie', `%${filtros.numero_serie.trim()}%`)
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

export function listarEspecies() {
  return buscarValoresUnicos('especie')
}

export function listarCalibres() {
  return buscarValoresUnicos('calibre')
}

export function listarUnidades() {
  return buscarValoresUnicos('unidade')
}

export async function cadastrarArma(payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarArma(id, payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function excluirArma(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}