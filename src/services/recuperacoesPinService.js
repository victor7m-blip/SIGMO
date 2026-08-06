import { supabase } from './supabaseClient'

function mensagemErro(error, fallback) {
  return (
    error?.message ||
    error?.details ||
    fallback
  )
}

function primeiroResultado(data) {
  if (Array.isArray(data)) {
    return data[0] ?? null
  }

  return data ?? null
}

export async function listarRecuperacoesPin({
  usuarioId,
  status = 'PENDENTE',
  limite = 50
} = {}) {
  if (!usuarioId) {
    throw new Error(
      'Usuário responsável não identificado.'
    )
  }

  const { data, error } = await supabase.rpc(
    'sigmo_listar_recuperacoes_pin',
    {
      p_usuario_id: usuarioId,
      p_status: status || null,
      p_limite: limite
    }
  )

  if (error) {
    throw new Error(
      mensagemErro(
        error,
        'Não foi possível carregar as recuperações de PIN.'
      )
    )
  }

  return Array.isArray(data) ? data : []
}

export async function aprovarRecuperacaoPin({
  usuarioId,
  recuperacaoId
}) {
  if (!usuarioId) {
    throw new Error(
      'Usuário responsável não identificado.'
    )
  }

  if (!recuperacaoId) {
    throw new Error(
      'Solicitação de recuperação não informada.'
    )
  }

  const { data, error } = await supabase.rpc(
    'sigmo_aprovar_recuperacao_pin',
    {
      p_usuario_id: usuarioId,
      p_recuperacao_id: recuperacaoId
    }
  )

  if (error) {
    throw new Error(
      mensagemErro(
        error,
        'Não foi possível gerar o novo PIN.'
      )
    )
  }

  const resultado = primeiroResultado(data)

  if (!resultado?.pin_temporario) {
    throw new Error(
      'O banco não retornou o PIN temporário.'
    )
  }

  return resultado
}

export async function reprovarRecuperacaoPin({
  usuarioId,
  recuperacaoId,
  motivo
}) {
  if (!usuarioId) {
    throw new Error(
      'Usuário responsável não identificado.'
    )
  }

  if (!recuperacaoId) {
    throw new Error(
      'Solicitação de recuperação não informada.'
    )
  }

  const motivoLimpo = String(motivo ?? '').trim()

  if (motivoLimpo.length < 5) {
    throw new Error(
      'Informe uma justificativa com pelo menos 5 caracteres.'
    )
  }

  const { data, error } = await supabase.rpc(
    'sigmo_reprovar_recuperacao_pin',
    {
      p_usuario_id: usuarioId,
      p_recuperacao_id: recuperacaoId,
      p_motivo: motivoLimpo
    }
  )

  if (error) {
    throw new Error(
      mensagemErro(
        error,
        'Não foi possível reprovar a solicitação.'
      )
    )
  }

  return primeiroResultado(data)
}
