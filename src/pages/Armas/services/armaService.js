import { supabase } from './supabase'

const TABELA = 'sigmo_armas'

export async function cadastrarArma(dados) {
  const { data, error } = await supabase
    .from(TABELA)
    .insert(dados)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function atualizarArma(id, dados) {
  const { data, error } = await supabase
    .from(TABELA)
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function listarArmas() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}