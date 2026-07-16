import { supabase } from './supabaseClient'

const TABELA_USUARIOS = 'sigmo_users'
const TABELA_CREDENCIAIS = 'sigmo_credenciais_temporarias'

function gerarPIN() {
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
      tipo: 'PIN',
      segredo_hash: pin,
      exige_troca: true,
      utilizada: false,
      solicitacao_id: solicitacaoId,
      criada_por_re: criadoPor?.re,
      criada_por_nome: criadoPor?.nome,
      expira_em: new Date(
        Date.now() +
        24 * 60 * 60 * 1000
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
        exige_troca: true
      })
      .eq(
        'policial_id',
        policialId
      )

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
        pin: Number(novoPin),
        exige_troca: false
      })
      .eq(
        'id',
        userId
      )

  if (error) {
    throw error
  }

  return true
}