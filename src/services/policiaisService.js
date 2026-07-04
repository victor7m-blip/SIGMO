import { supabase } from './supabaseClient'

const TABLE = 'sigmo_pessoas'

export async function listarPoliciais({
  filters = {},
  pagina = 1,
  limite = 10,
  sortBy = 'nome_completo',
  sortDirection = 'asc'
}) {
  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })

  if (filters.busca) {
    const busca = `%${filters.busca}%`

    query = query.or(
      `nome_completo.ilike.${busca},nome_guerra.ilike.${busca},matricula.ilike.${busca},cpf.ilike.${busca},rg.ilike.${busca},posto_graduacao.ilike.${busca},unidade.ilike.${busca}`
    )
  }

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.unidade) query = query.ilike('unidade', `%${filters.unidade}%`)
  if (filters.posto_graduacao) query = query.ilike('posto_graduacao', `%${filters.posto_graduacao}%`)
  if (filters.perfil_operacional) query = query.eq('perfil_operacional', filters.perfil_operacional)

  const from = (pagina - 1) * limite
  const to = from + limite - 1

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(from, to)

  if (error) throw error

  return {
    data: data || [],
    total: count || 0
  }
}

export async function cadastrarPolicial(payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarPolicial(id, payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
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