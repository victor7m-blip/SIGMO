import { supabase } from './supabaseClient'

export async function criarUsuarioSigmo(usuario) {
  const { data, error } = await supabase
    .from('sigmo_users')
    .insert(usuario)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function listarUsuariosSigmo() {
  const { data, error } = await supabase
    .from('sigmo_users')
    .select(`
      *,
      policiais (
        id,
        re,
        nome,
        nome_guerra,
        posto_graduacao,
        companhia,
        pelotao,
        situacao
      )
    `)
    .order('criado_em', { ascending: false })

  if (error) throw error

  return data
}

export async function buscarUsuarioPorPolicial(policialId) {
  const { data, error } = await supabase
    .from('sigmo_users')
    .select('*')
    .eq('policial_id', policialId)
    .maybeSingle()

  if (error) throw error

  return data
}