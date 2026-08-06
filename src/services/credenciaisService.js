import { supabase } from './supabaseClient'

const TABELA_USUARIOS = 'sigmo_users'
const TABELA_CREDENCIAIS = 'sigmo_credenciais_temporarias'

function gerarPIN() {
  if (globalThis.crypto?.getRandomValues) {
    const valor = new Uint32Array(1)
    globalThis.crypto.getRandomValues(valor)
    return String(100000 + (valor[0] % 900000))
  }

  return String(
    Math.floor(100000 + Math.random() * 900000)
  )
}

export async function gerarPinTemporario({
  policialId,
  policialRe,
  solicitacaoId,
  criadoPor
}) {
  const pin = gerarPIN()

  const { error } = await supabase
    .from(TABELA_CREDENCIAIS)
    .insert({
      policial_re: policialRe,
      tipo: 'PIN_TEMPORARIO',
      segredo_hash: pin,
      exige_troca: true,
      utilizada: false,
      solicitacao_id: solicitacaoId,
      criada_por_re: criadoPor?.re,
      criada_por_nome: criadoPor?.nome,
      expira_em: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString()
    })

  if (error) {
    throw error
  }

  const { error: usuarioError } =
    await supabase
      .from(TABELA_USUARIOS)
      .update({
        pin,
        exige_troca: true,
        atualizado_em: new Date().toISOString()
      })
      .eq('policial_id', policialId)

  if (usuarioError) {
    throw usuarioError
  }

  return pin
}

export async function alterarPin(
  userId,
  novoPin
) {
  const { error } =
    await supabase
      .from(TABELA_USUARIOS)
      .update({
        pin: String(novoPin),
        exige_troca: false,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', userId)

  if (error) {
    throw error
  }

  return true
}

export async function concluirTrocaObrigatoriaPin({
  usuarioId,
  novoPin
}) {
  if (!usuarioId) {
    throw new Error(
      'Usuário não identificado para a troca de PIN.'
    )
  }

  const pinLimpo = String(novoPin ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)

  if (pinLimpo.length !== 6) {
    throw new Error(
      'O novo PIN deve ter exatamente 6 números.'
    )
  }

  const { data, error } = await supabase.rpc(
    'sigmo_concluir_troca_pin',
    {
      p_usuario_id: usuarioId,
      p_novo_pin: pinLimpo
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível concluir a troca do PIN.'
    )
  }

  return data
}
