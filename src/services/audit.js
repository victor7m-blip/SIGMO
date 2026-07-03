import { supabase } from './supabase'

export async function registerAudit({
  acao,
  descricao,
  ator_id,
  ator_nome,
  perfil,
  modulo,
  severidade
}) {
  try {
    const { error } = await supabase
      .from('auditoria')
      .insert({
        acao,
        descricao,
        ator_id,
        ator_nome,
        perfil,
        modulo,
        severidade
      })

    if (error) {
      console.error(error)
      alert(error.message)
    }
  } catch (err) {
    console.error('Erro inesperado na auditoria:', err)
  }
}