import { supabase } from './supabase'

export async function registerAudit(action, description, user, module = 'Sistema', severity = 'Informativo') {
  try {
    await supabase.from('sigmo_audit').insert({
      action,
      description,
      actor_id: user?.id || null,
      actor_name: user?.nome || null,
      actor_profile: user?.perfil || null,
      module,
      severity
    })
  } catch (error) {
    console.warn('Falha ao registrar auditoria:', error)
  }
}