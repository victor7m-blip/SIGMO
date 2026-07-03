import { supabase } from './supabase'

export async function registerAudit(
  action,
  description,
  user,
  module = 'Sistema',
  severity = 'Informativo'
) {
  try {
    const { error } = await supabase
      .from('auditoria')
      .insert({
        acao: action,
        descricao: description,
        ator_id: user?.id || null,
        ator_nome: user?.nome || null,
        modulo: module,
        severidade: severity
      })

    if (error) {
      console.error('Erro na auditoria:', error)
      alert(JSON.stringify(error, null, 2))
    }
  } catch (err) {
    console.error('Erro inesperado na auditoria:', err)
  }
}