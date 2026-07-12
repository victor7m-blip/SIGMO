import { supabase } from './supabaseClient'

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.name ||
    user?.email ||
    null
  )
}

export async function registerAudit(
  action,
  description,
  user,
  module = 'Sistema',
  severity = 'Informativo'
) {
  const registro = {
    acao: String(action || 'EVENTO').toUpperCase(),
    descricao:
      description || 'Evento registrado no sistema.',
    ator_id: user?.id || null,
    ator_nome: obterNomeUsuario(user),
    perfil: user?.perfil || null,
    modulo: module,
    severidade: severity
  }

  const { data, error } = await supabase
    .from('auditoria')
    .insert([registro])
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function registerPatrimonialAudit({
  tipo,
  descricao,
  usuario = null,
  modulo = 'Patrimônio',
  severidade = 'Informativo'
}) {
  return registerAudit(
    tipo,
    descricao,
    usuario,
    modulo,
    severidade
  )
}