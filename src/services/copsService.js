import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_cops'

const STATUS_VALIDOS = new Set([
  'RESERVA',
  'EM_SERVICO',
  'MANUTENCAO',
  'BAIXADA'
])

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) {
    return ''
  }

  return String(valor).trim()
}

function normalizarMaiusculo(valor) {
  return normalizarTexto(valor).toUpperCase()
}

function normalizarNumero(numero) {
  const valor = normalizarTexto(numero)

  if (!valor) return ''

  if (!/^\d{1,2}$/.test(valor)) {
    return valor
  }

  return valor.padStart(2, '0')
}

function normalizarStatus(status) {
  const valor = normalizarMaiusculo(status)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')

  if (!valor || valor === 'DISPONIVEL') {
    return 'RESERVA'
  }

  if (valor === 'EM_MANUTENCAO') {
    return 'MANUTENCAO'
  }

  if (valor === 'BAIXADO') {
    return 'BAIXADA'
  }

  return valor
}

function normalizarCOP(cop) {
  if (!cop) return null

  return {
    ...cop,
    numero: normalizarNumero(cop.numero),
    identificacao_equipamento:
      normalizarMaiusculo(
        cop.identificacao_equipamento
      ) || null,
    marca:
      normalizarMaiusculo(cop.marca) ||
      'MOTOROLA',
    status_operacional:
      normalizarStatus(
        cop.status_operacional
      ),
    local_atual:
      normalizarTexto(cop.local_atual) ||
      null,
    foto_url:
      normalizarTexto(cop.foto_url) ||
      null,
    observacoes:
      normalizarTexto(cop.observacoes) ||
      null,
    ativo: cop.ativo !== false
  }
}

function prepararPayload(payload = {}) {
  const cop = normalizarCOP(payload)

  if (!cop.numero) {
    throw new Error(
      'Informe o número da COP.'
    )
  }

  if (!/^\d{2}$/.test(cop.numero)) {
    throw new Error(
      'O número da COP deve conter dois dígitos.'
    )
  }

  if (!cop.marca) {
    throw new Error(
      'Informe a marca da COP.'
    )
  }

  if (!STATUS_VALIDOS.has(
    cop.status_operacional
  )) {
    throw new Error(
      'Status operacional da COP inválido.'
    )
  }

  return {
    numero: cop.numero,
    identificacao_equipamento:
      cop.identificacao_equipamento,
    marca: cop.marca,
    status_operacional:
      cop.status_operacional,
    local_atual:
      cop.local_atual || 'SVDD',
    foto_url: cop.foto_url,
    observacoes: cop.observacoes,
    ativo: cop.ativo
  }
}

function limparPesquisa(valor) {
  return String(valor || '')
    .trim()
    .replace(/[%(),]/g, '')
}

function definirLocalPatrimonial(cop) {
  if (cop.local_atual) {
    return cop.local_atual
  }

  if (
    cop.status_operacional ===
    'EM_SERVICO'
  ) {
    return 'Em serviço'
  }

  if (
    cop.status_operacional ===
    'MANUTENCAO'
  ) {
    return 'Manutenção'
  }

  if (
    cop.status_operacional ===
    'BAIXADA'
  ) {
    return 'Baixada'
  }

  return 'SVDD'
}

export async function listarCOPs({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'numero',
  sortDirection = 'asc'
} = {}) {
  const inicio = (pagina - 1) * limite
  const fim = inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order(sortBy, {
      ascending:
        sortDirection === 'asc',
      nullsFirst: false
    })
    .range(inicio, fim)

  const pesquisa = limparPesquisa(
    filtros.pesquisa
  )

  if (pesquisa) {
    query = query.or(
      [
        `numero.ilike.%${pesquisa}%`,
        `identificacao_equipamento.ilike.%${pesquisa}%`,
        `marca.ilike.%${pesquisa}%`,
        `local_atual.ilike.%${pesquisa}%`
      ].join(',')
    )
  }

  if (filtros.numero?.trim()) {
    query = query.eq(
      'numero',
      normalizarNumero(filtros.numero)
    )
  }

  if (
    filtros.identificacao_equipamento
      ?.trim()
  ) {
    query = query.ilike(
      'identificacao_equipamento',
      `%${filtros.identificacao_equipamento.trim()}%`
    )
  }

  if (filtros.marca?.trim()) {
    query = query.ilike(
      'marca',
      `%${filtros.marca.trim()}%`
    )
  }

  if (
    filtros.status_operacional?.trim()
  ) {
    query = query.eq(
      'status_operacional',
      normalizarStatus(
        filtros.status_operacional
      )
    )
  }

  if (filtros.local_atual?.trim()) {
    query = query.ilike(
      'local_atual',
      `%${filtros.local_atual.trim()}%`
    )
  }

  if (
    filtros.ativo !== undefined &&
    filtros.ativo !== '' &&
    filtros.ativo !== null
  ) {
    const ativo =
      filtros.ativo === true ||
      filtros.ativo === 'true'

    query = query.eq('ativo', ativo)
  }

  const { data, error, count } =
    await query

  if (error) throw error

  return {
    data: (data || []).map(normalizarCOP),
    total: count || 0
  }
}

export async function buscarCOPPorId(id) {
  if (!id) {
    throw new Error(
      'ID da COP não informado.'
    )
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return normalizarCOP(data)
}

export async function buscarCOPPorNumero(
  numero
) {
  const numeroNormalizado =
    normalizarNumero(numero)

  if (!numeroNormalizado) return null

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('numero', numeroNormalizado)
    .maybeSingle()

  if (error) throw error

  return normalizarCOP(data)
}

export async function verificarCOPExistente({
  numero,
  identificacao_equipamento,
  ignorarId = null
} = {}) {
  const numeroNormalizado =
    normalizarNumero(numero)

  const identificacaoNormalizada =
    normalizarMaiusculo(
      identificacao_equipamento
    )

  if (
    !numeroNormalizado &&
    !identificacaoNormalizada
  ) {
    return null
  }

  const condicoes = []

  if (numeroNormalizado) {
    condicoes.push(
      `numero.eq.${numeroNormalizado}`
    )
  }

  if (identificacaoNormalizada) {
    condicoes.push(
      `identificacao_equipamento.eq.${identificacaoNormalizada}`
    )
  }

  let query = supabase
    .from(TABLE)
    .select(
      'id, numero, identificacao_equipamento, marca'
    )
    .or(condicoes.join(','))
    .limit(1)

  if (ignorarId) {
    query = query.neq('id', ignorarId)
  }

  const { data, error } = await query

  if (error) throw error

  return data?.[0] || null
}

async function buscarValoresUnicos(campo) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(campo)
    .eq('ativo', true)

  if (error) throw error

  return [
    ...new Set(
      (data || [])
        .map((item) => item[campo])
        .filter(Boolean)
    )
  ].sort((a, b) =>
    String(a).localeCompare(
      String(b),
      'pt-BR'
    )
  )
}

export function listarMarcasCOP() {
  return buscarValoresUnicos('marca')
}

export function listarLocaisCOP() {
  return buscarValoresUnicos(
    'local_atual'
  )
}

export async function cadastrarCOP(
  payload,
  user = null
) {
  const dados = prepararPayload(payload)

  const existente =
    await verificarCOPExistente({
      numero: dados.numero,
      identificacao_equipamento:
        dados.identificacao_equipamento
    })

  if (existente) {
    throw new Error(
      'Já existe uma COP com esse número ou ID da câmera.'
    )
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(dados)
    .select()
    .single()

  if (error) throw error

  const copNormalizada =
    normalizarCOP(data)

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'cop',
      referencia_id: copNormalizada.id,
      dados: copNormalizada,
      user,
      local_atual:
        definirLocalPatrimonial(
          copNormalizada
        ),
      companhia_atual: ''
    })

    return copNormalizada
  } catch (error) {
    const { error: rollbackError } =
      await supabase
        .from(TABLE)
        .delete()
        .eq('id', copNormalizada.id)

    if (rollbackError) {
      console.error(
        'Não foi possível desfazer o cadastro incompleto da COP:',
        rollbackError
      )
    }

    throw error
  }
}

export async function atualizarCOP(
  id,
  payload,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID da COP não informado.'
    )
  }

  const dados = prepararPayload(payload)

  const existente =
    await verificarCOPExistente({
      numero: dados.numero,
      identificacao_equipamento:
        dados.identificacao_equipamento,
      ignorarId: id
    })

  if (existente) {
    throw new Error(
      'Já existe outra COP com esse número ou ID da câmera.'
    )
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const copNormalizada =
    normalizarCOP(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'cop',
    referencia_id: copNormalizada.id,
    dados: copNormalizada,
    user,
    local_atual:
      definirLocalPatrimonial(
        copNormalizada
      ),
    companhia_atual: ''
  })

  return copNormalizada
}

export async function excluirCOP(
  id,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID da COP não informado.'
    )
  }

  await desativarPatrimonioPorReferencia({
    tipo: 'cop',
    referencia_id: id,
    user,
    motivo:
      'COP excluída ou baixada no cadastro específico.'
  })

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function desativarCOP(
  id,
  user = null
) {
  const cop = await buscarCOPPorId(id)

  return atualizarCOP(
    id,
    {
      ...cop,
      ativo: false,
      status_operacional: 'BAIXADA',
      local_atual: 'Baixada'
    },
    user
  )
}

export async function sincronizarCOPsComPatrimonios(
  user = null
) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const copsNormalizadas =
    (data || []).map(normalizarCOP)

  for (const cop of copsNormalizadas) {
    await criarOuAtualizarPatrimonio({
      tipo: 'cop',
      referencia_id: cop.id,
      dados: cop,
      user,
      local_atual:
        definirLocalPatrimonial(cop),
      companhia_atual: ''
    })
  }

  return copsNormalizadas.length
}

export async function obterResumoCOPs() {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'id, status_operacional, local_atual, ativo'
    )

  if (error) throw error

  const itens = (data || []).map(
    normalizarCOP
  )

  const resumo = {
    total: itens.length,
    reserva: 0,
    emServico: 0,
    manutencao: 0,
    baixadas: 0,
    inativas: 0,
    outros: 0
  }

  for (const item of itens) {
    if (!item.ativo) {
      resumo.inativas += 1
      continue
    }

    const status = normalizarStatus(
      item.status_operacional
    )

    if (status === 'BAIXADA') {
      resumo.baixadas += 1
      continue
    }

    if (status === 'MANUTENCAO') {
      resumo.manutencao += 1
      continue
    }

    if (status === 'EM_SERVICO') {
      resumo.emServico += 1
      continue
    }

    if (status === 'RESERVA') {
      resumo.reserva += 1
      continue
    }

    resumo.outros += 1
  }

  return resumo
}
