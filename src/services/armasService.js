import { supabase } from './supabase'

export async function listarArmas() {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .select('*')
    .eq('ativo', true)
    .order('patrimonio', { ascending: true })

  if (error) throw error

  return data
}

export async function buscarArma(id) {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

export async function cadastrarArma(arma) {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .insert([arma])
    .select()
    .single()

  if (error) throw error

  return data
}

export async function editarArma(id, dados) {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .update({
      ...dados,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function desativarArma(id) {
  const { error } = await supabase
    .from('sigmo_armas')
    .update({
      ativo: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw error
}