import { supabase } from './supabaseClient'

const TABLE = 'sigmo_patrimonios'

function texto(valor) {
  return String(valor || '')
    .trim()
}

function montarDescricao({
  tipo,
  dados
}) {
  const partes = [
    dados.especie,
    dados.marca,
    dados.modelo,
    dados.calibre
  ]
    .map(texto)
    .filter(Boolean)

  const identificador =
    texto(dados.patrimonio) ||
    texto(dados.numero_serie) ||
    texto(dados.qr_code)

  const descricaoBase =
    partes.join(' ')

  if (
    descricaoBase &&
    identificador
  ) {
    return `${descricaoBase} - ${identificador}`
  }

  if (descricaoBase) {
    return descricaoBase
  }

  if (identificador) {
    return `${String(tipo || 'PATRIMÔNIO')
      .trim()
      .toUpperCase()} - ${identificador}`
  }

  return String(tipo || 'PATRIMÔNIO')
    .trim()
    .toUpperCase()
}

function normalizarStatus(dados) {
  return String(
    dados.status_operacional ||
    dados.status ||
    'ATIVO'
  )
    .trim()
    .toUpperCase()
}

function montarResponsavel(dados) {
  const responsavelId =
    dados.carga_policial_id ||
    dados.responsavel_atual_id ||
    dados.proprietario_policial_id ||
    null

  const responsavelNome =
    dados.carga_policial_nome ||
    dados.responsavel_atual_nome ||
    dados.proprietario_nome ||
    null

  return {
    responsavelId,
    responsavelNome
  }
}

export async function criarOuAtualizarPatrimonio({
  tipo,
  referencia_id,
  dados,
  user = null,
  local_atual = '',
  companhia_atual = ''
}) {
  const {
    responsavelId,
    responsavelNome
  } = montarResponsavel(dados)

  const payload = {
    tipo,

    referencia_id,

    descricao:
      montarDescricao({
        tipo,
        dados
      }),

    numero_patrimonio:
      texto(dados.patrimonio) ||
      null,

    numero_serie:
      texto(dados.numero_serie) ||
      null,

    status:
      normalizarStatus(dados),

    local_atual:
      texto(local_atual) ||
      texto(dados.local_atual) ||
      null,

    responsavel_atual_id:
      responsavelId,

    responsavel_atual_nome:
      responsavelNome,

    companhia_atual:
      texto(companhia_atual) ||
      texto(dados.unidade) ||
      null,

    ativo: true,

    dados,

    atualizado_por:
      user?.nome ||
      user?.nome_guerra ||
      user?.email ||
      null
  }

  const {
    data: existente,
    error: erroBusca
  } = await supabase
    .from(TABLE)
    .select('id')
    .eq('tipo', tipo)
    .eq('referencia_id', referencia_id)
    .maybeSingle()

  if (erroBusca) throw erroBusca

  if (existente?.id) {
    const {
      data,
      error
    } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', existente.id)
      .select()
      .single()

    if (error) throw error

    return data
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert({
      ...payload,

      created_by:
        user?.id ||
        null,

      created_by_nome:
        user?.nome ||
        user?.nome_guerra ||
        user?.email ||
        null
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function desativarPatrimonioPorReferencia({
  tipo,
  referencia_id,
  user = null,
  motivo = ''
}) {
  const {
    error
  } = await supabase
    .from(TABLE)
    .update({
      status: 'INATIVO',

      ativo: false,

      motivo_inativacao:
        motivo || null,

      atualizado_por:
        user?.nome ||
        user?.nome_guerra ||
        user?.email ||
        null
    })
    .eq('tipo', tipo)
    .eq('referencia_id', referencia_id)

  if (error) throw error
}