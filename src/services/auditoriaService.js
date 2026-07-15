import { supabase } from './supabaseClient'

const TABLE = 'auditoria'

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

function normalizarTexto(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null
  }

  if (
    typeof valor === 'object'
  ) {
    try {
      return JSON.stringify(valor)
    } catch {
      return String(valor)
    }
  }

  return String(valor)
}

export async function registerAudit(
  action,
  description,
  user,
  module = 'Sistema',
  severity = 'Informativo'
) {
  const registro = {
    acao:
      String(
        action || 'EVENTO'
      ).toUpperCase(),

    descricao:
      normalizarTexto(description) ||
      'Evento registrado no sistema.',

    ator_id:
      user?.id || null,

    ator_nome:
      obterNomeUsuario(user),

    perfil:
      user?.perfil || null,

    modulo:
      module,

    severidade:
      severity
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
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

export async function listarUltimasAuditorias({
  modulo = null,
  limite = 10
} = {}) {
  const limiteSeguro =
    Math.max(
      1,
      Math.min(
        Number(limite) || 10,
        50
      )
    )

  let query = supabase
    .from(TABLE)
    .select(`
      id,
      acao,
      descricao,
      ator_id,
      ator_nome,
      perfil,
      modulo,
      severidade,
      data_hora
    `)
    .order(
      'data_hora',
      {
        ascending: false
      }
    )
    .limit(
      limiteSeguro
    )

  if (
    modulo &&
    String(modulo).trim()
  ) {
    query = query.ilike(
      'modulo',
      `%${String(modulo).trim()}%`
    )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return data || []
}

export async function listarUltimasAlteracoesPoliciais(
  limite = 10
) {
  const limiteSeguro =
    Math.max(
      1,
      Math.min(
        Number(limite) || 10,
        20
      )
    )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select(`
      id,
      acao,
      descricao,
      ator_id,
      ator_nome,
      perfil,
      modulo,
      severidade,
      data_hora
    `)
    .or(
      'modulo.ilike.%Policiais%,descricao.ilike.%policial%'
    )
    .order(
      'data_hora',
      {
        ascending: false
      }
    )
    .limit(
      limiteSeguro
    )

  if (error) {
    throw error
  }

  return data || []
}