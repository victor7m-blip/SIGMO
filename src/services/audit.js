import { supabase } from './supabase'

export async function registerAudit(
  acao,
  descricao,
  user,
  modulo = 'Sistema',
  severidade = 'Informativo'
) {
  try {
    await supabase
      .from('auditoria')
      .insert({
        acao,
        descricao,
        ator_id: user?.id || null,
        ator_nome: user?.nome || null,
        perfil: user?.perfil || null,
        modulo,
        severidade
      })
  } catch (err) {
    console.error(err)
  }
}