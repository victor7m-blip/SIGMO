import { supabase } from './supabase'

export async function cadastrarArma(dados) {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .insert(dados)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function atualizarArma(id, dados) {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function listarArmas() {
  const { data, error } = await supabase
    .from('sigmo_armas')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}