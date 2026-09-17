import { supabase } from './supabaseClient'
import { loadSessionToken } from './authService'

function normalizarQuantidade(valor) {
  const quantidade = Number(valor)

  if (
    !Number.isInteger(quantidade) ||
    quantidade <= 0
  ) {
    throw new Error(
      'Informe uma quantidade inteira maior que zero.'
    )
  }

  return quantidade
}

function obterTokenSessao() {
  const token = loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  return token
}

export async function listarTorniquetes() {
  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_torniquetes_listar',
    {
      p_token: obterTokenSessao()
    }
  )

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data
    : []
}


export async function transferirTorniqueteParaSvdd({
  quantidade
}) {
  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_torniquetes_transferir_p4_svdd',
    {
      p_token: obterTokenSessao(),
      p_quantidade:
        normalizarQuantidade(
          quantidade
        )
    }
  )

  if (error) {
    throw error
  }

  return data
}

export {
  normalizarQuantidade
}
