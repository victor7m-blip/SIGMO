import { supabase } from './supabaseClient'
import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_materiais'

function normalizarStatus(status) {
  if (!status) return 'ATIVO'

  return String(status).trim().toUpperCase()
}

function normalizarMaterial(material) {
  return {
    ...material,
    status: normalizarStatus(material.status)
  }
}

export async function listarMateriais({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio = (pagina - 1) * limite
  const fim = inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order(sortBy, {
      ascending: sortDirection === 'asc',
      nullsFirst: false
    })
    .range(inicio, fim)

  if (filtros.patrimonio?.trim()) {
    query = query.ilike('patrimonio', `%${filtros.patrimonio.trim()}%`)
  }

  if (filtros.descricao?.trim()) {
    query = query.ilike('descricao', `%${filtros.descricao.trim()}%`)
  }

  if (filtros.categoria?.trim()) {
    query = query.ilike('categoria', `%${filtros.categoria.trim()}%`)
  }

  if (filtros.marca?.trim()) {
    query = query.ilike('marca', `%${filtros.marca.trim()}%`)
  }

  if (filtros.modelo?.trim()) {
    query = query.ilike('modelo', `%${filtros.modelo.trim()}%`)
  }

  if (filtros.numero_serie?.trim()) {
    query = query.ilike('numero_serie', `%${filtros.numero_serie.trim()}%`)
  }

  if (filtros.status?.trim()) {
    query = query.eq('status', normalizarStatus(filtros.status))
  }

  if (filtros.unidade?.trim()) {
    query = query.ilike('unidade', `%${filtros.unidade.trim()}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data ?? []).map(normalizarMaterial),
    total: count ?? 0
  }
}

async function buscarValoresUnicos(campo) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(campo)

  if (error) throw error

  return [...new Set(
    (data || [])
      .map((item) => item[campo])
      .filter(Boolean)
  )].sort()
}

export function listarCategoriasMateriais() {
  return buscarValoresUnicos('categoria')
}

export function listarUnidadesMateriais() {
  return buscarValoresUnicos('unidade')
}

export async function cadastrarMaterial(payload, user = null) {
  const statusNormalizado = normalizarStatus(payload.status)

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...payload,
      status: statusNormalizado
    })
    .select()
    .single()

  if (error) throw error

  const materialNormalizado = normalizarMaterial(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'material',
    referencia_id: materialNormalizado.id,
    dados: materialNormalizado,
    user,
    local_atual: materialNormalizado.local_atual || 'Guarda do Quartel',
    companhia_atual: materialNormalizado.unidade || ''
  })

  return materialNormalizado
}

export async function atualizarMaterial(id, payload, user = null) {
  const statusNormalizado = normalizarStatus(payload.status)

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...payload,
      status: statusNormalizado
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const materialNormalizado = normalizarMaterial(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'material',
    referencia_id: materialNormalizado.id,
    dados: materialNormalizado,
    user,
    local_atual: materialNormalizado.local_atual || 'Guarda do Quartel',
    companhia_atual: materialNormalizado.unidade || ''
  })

  return materialNormalizado
}

export async function excluirMaterial(id, user = null) {
  await desativarPatrimonioPorReferencia({
    tipo: 'material',
    referencia_id: id,
    user,
    motivo: 'Material excluído ou baixado no cadastro específico.'
  })

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function sincronizarMateriaisComPatrimonios(user = null) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const materiaisNormalizados = (data || []).map(normalizarMaterial)

  for (const material of materiaisNormalizados) {
    await criarOuAtualizarPatrimonio({
      tipo: 'material',
      referencia_id: material.id,
      dados: material,
      user,
      local_atual: material.local_atual || 'Guarda do Quartel',
      companhia_atual: material.unidade || ''
    })
  }

  return materiaisNormalizados.length
}

