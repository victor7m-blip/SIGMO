import { supabase } from './supabaseClient'

function limparRe(valor) {
  return String(valor ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

export async function solicitarRecuperacaoPin({
  reSolicitante,
  reResponsavel
}) {
  const solicitante = limparRe(reSolicitante)
  const responsavel = limparRe(reResponsavel)

  if (!solicitante || solicitante.length !== 6) {
    throw new Error('Informe um RE válido para o solicitante.')
  }

  if (!responsavel || responsavel.length !== 6) {
    throw new Error('Informe um RE válido para o responsável.')
  }

  if (solicitante === responsavel) {
    throw new Error('O responsável deve ser outro policial.')
  }

  const { data, error } = await supabase.rpc(
    'sigmo_solicitar_recuperacao_pin',
    {
      p_re_solicitante: solicitante,
      p_re_responsavel: responsavel
    }
  )

  if (error) {
    throw new Error(
      error.message ||
      'Não foi possível registrar a solicitação.'
    )
  }

  return data
}
