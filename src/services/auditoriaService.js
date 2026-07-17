import { supabase } from './supabaseClient'

const TABLE = 'auditoria'
const POLICIAIS_TABLE = 'policiais'

function obterNomeUsuario(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
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

  const texto = String(valor).trim()

  return texto || null
}

function normalizarAcao(action) {
  return (
    normalizarTexto(action) ||
    'EVENTO'
  ).toUpperCase()
}

function normalizarModulo(module) {
  return (
    normalizarTexto(module) ||
    'Sistema'
  )
}

function normalizarSeveridade(severity) {
  return (
    normalizarTexto(severity) ||
    'Informativo'
  )
}

async function obterDadosCompletosAtor(user) {
  if (!user) {
    return {
      id: null,
      nome: null,
      re: null,
      perfil: null
    }
  }

  const dadosIniciais = {
    id:
      user?.id ||
      null,

    nome:
      obterNomeUsuario(user),

    re:
      normalizarTexto(
        user?.re ||
        user?.registro_estatistico
      ),

    perfil:
      normalizarTexto(
        user?.perfil ||
        user?.role
      )
  }

  if (
    !dadosIniciais.id ||
    (
      dadosIniciais.nome &&
      dadosIniciais.re &&
      dadosIniciais.perfil
    )
  ) {
    return dadosIniciais
  }

  const {
    data,
    error
  } = await supabase
    .from(POLICIAIS_TABLE)
    .select(`
      id,
      nome,
      nome_guerra,
      re,
      perfil
    `)
    .eq(
      'id',
      dadosIniciais.id
    )
    .maybeSingle()

  if (error) {
    console.warn(
      'Não foi possível completar os dados do ator:',
      error
    )

    return dadosIniciais
  }

  if (!data) {
    return dadosIniciais
  }

  return {
    id:
      dadosIniciais.id,

    nome:
      dadosIniciais.nome ||
      data.nome_guerra ||
      data.nome ||
      null,

    re:
      dadosIniciais.re ||
      normalizarTexto(data.re),

    perfil:
      dadosIniciais.perfil ||
      normalizarTexto(data.perfil)
  }
}

export async function registerAudit(
  action,
  description,
  user,
  module = 'Sistema',
  severity = 'Informativo'
) {
  const ator =
    await obterDadosCompletosAtor(user)

  const registro = {
    acao:
      normalizarAcao(action),

    descricao:
      normalizarTexto(description) ||
      'Evento registrado no sistema.',

    ator_id:
      ator.id,

    ator_nome:
      ator.nome,

    ator_re:
      ator.re,

    ator_perfil:
      ator.perfil,

    // Mantido temporariamente para
    // compatibilidade com registros antigos.
    perfil:
      ator.perfil,

    modulo:
      normalizarModulo(module),

    severidade:
      normalizarSeveridade(severity)
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
    console.error(
      'Erro ao registrar auditoria:',
      error
    )

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
        500
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
      ator_re,
      ator_perfil,
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

  return (
    data || []
  ).map((registro) => ({
    ...registro,

    ator_perfil:
      registro.ator_perfil ||
      registro.perfil ||
      null
  }))
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
      ator_re,
      ator_perfil,
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

  return (
    data || []
  ).map((registro) => ({
    ...registro,

    ator_perfil:
      registro.ator_perfil ||
      registro.perfil ||
      null
  }))
}