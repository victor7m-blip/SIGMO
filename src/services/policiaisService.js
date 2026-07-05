import { supabase } from './supabaseClient'

const TABLE = 'policiais'

export async function listarPoliciais({
  busca = '',
  situacao = '',
  companhia = '',
  pelotao = '',
  perfil = '',
  sortBy = 'nome',
  sortDirection = 'asc',
  pagina = 1,
  limite = 10
} = {}) {
  const from = (pagina - 1) * limite
  const to = from + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })

  if (busca) {
    query = query.or(
      `nome.ilike.%${busca}%,nome_guerra.ilike.%${busca}%,re.ilike.%${busca}%,cpf.ilike.%${busca}%`
    )
  }

  if (situacao) query = query.eq('situacao', situacao)
  if (companhia) query = query.eq('companhia', companhia)
  if (pelotao) query = query.eq('pelotao', pelotao)
  if (perfil) query = query.eq('perfil', perfil)

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortDirection === 'asc' })
    .range(from, to)

  if (error) throw error

  return {
    data: data || [],
    count: count || 0
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
  return true
}