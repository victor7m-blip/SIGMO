import { supabase } from './supabaseClient'

export async function registerAudit(
  action,
  description,
  user,
  module = 'Sistema',
  severity = 'Informativo'
) {
  const { data, error } = await supabase
    .from('auditoria')
    .insert({
      acao: action,
      descricao: description,
      ator_id: user?.id || null,
      ator_nome: user?.nome || user?.nome_guerra || null,
      perfil: user?.perfil || null,
      modulo: module,
      severidade: severity
    })
    .select()
    .single()

  if (error) throw error

  return data
}