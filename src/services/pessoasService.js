import { supabase } from './supabaseClient'

const TABLE = 'sigmo_pessoas'

export async function listarPessoas({
  search = '',
  status = '',
  participaTeste = '',
  pagina = 1,
  limite = 10,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio = (pagina - 1) * limite
  const fim = inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })

  if (search) {
    query = query.or(
      `nome_completo.ilike.%${search}%,nome_guerra.ilike.%${search}%,matricula.ilike.%${search}%,cpf.ilike.%${search}%`
    )
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (participaTeste !== '') {
    query = query.eq('participa_teste', participaTeste === 'Sim')
  }

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(inicio, fim)

  if (error) throw error

  return {
    data: data || [],
    total: count || 0
  }
}

export async function cadastrarPessoa(pessoa, user) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...pessoa,
      created_by: user?.id || null,
      created_by_nome: user?.nome || null
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function atualizarPessoa(id, pessoa) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...pessoa,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function excluirPessoa(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}