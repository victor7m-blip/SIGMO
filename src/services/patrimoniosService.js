import { supabase } from './supabaseClient'

const TABLE = 'sigmo_patrimonios'

export async function criarOuAtualizarPatrimonio({
  tipo,
  referencia_id,
  dados,
  user = null,
  local_atual = '',
  companhia_atual = ''
}) {
  const payload = {
    tipo,
    referencia_id,
    dados,
    local_atual,
    companhia_atual,
    status: 'ATIVO',
    atualizado_por: user?.nome || user?.email || null
  }

  const { data: existente, error: erroBusca } = await supabase
    .from(TABLE)
    .select('id')
    .eq('tipo', tipo)
    .eq('referencia_id', referencia_id)
    .maybeSingle()

  if (erroBusca) throw erroBusca

  if (existente?.id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', existente.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function desativarPatrimonioPorReferencia({
  tipo,
  referencia_id,
  user = null,
  motivo = ''
}) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'INATIVO',
      motivo_inativacao: motivo,
      atualizado_por: user?.nome || user?.email || null
    })
    .eq('tipo', tipo)
    .eq('referencia_id', referencia_id)

  if (error) throw error
}