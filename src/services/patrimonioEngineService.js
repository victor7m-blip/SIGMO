import { supabase } from './supabaseClient'

export async function listarPatrimoniosEngine(config) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function buscarPatrimonioEnginePorId(config, id) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function cadastrarPatrimonioEngine(config, payload) {
  const { data, error } = await supabase
    .from(config.tabela)
    .insert([payload])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function atualizarPatrimonioEngine(config, id, payload) {
  const { data, error } = await supabase
    .from(config.tabela)
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function excluirPatrimonioEngine(config, id) {
  const { error } = await supabase
    .from(config.tabela)
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}