import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_tpds'

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) {
    return ''
  }

  return String(valor).trim()
}

function normalizarMaiusculo(valor) {
  return normalizarTexto(valor).toUpperCase()
}

function normalizarStatus(status) {
  const valor = normalizarMaiusculo(status)

  if (!valor) {
    return 'RESERVA'
  }

  if (
    valor === 'DISPONÍVEL' ||
    valor === 'DISPONIVEL'
  ) {
    return 'RESERVA'
  }

  if (
    valor === 'EM SERVIÇO' ||
    valor === 'EM SERVICO'
  ) {
    return 'EM_SERVICO'
  }

  if (
    valor === 'MANUTENÇÃO' ||
    valor === 'MANUTENCAO'
  ) {
    return 'MANUTENCAO'
  }

  return valor
}

function normalizarTipoEquipamento(tipo) {
  const valor = normalizarMaiusculo(tipo)

  if (!valor) {
    return 'SMARTPHONE'
  }

  return valor
}

function normalizarTPD(tpd) {
  if (!tpd) return null

  return {
    ...tpd,

    patrimonio:
      normalizarMaiusculo(
        tpd.patrimonio
      ) || null,

    numero_serie:
      normalizarMaiusculo(
        tpd.numero_serie
      ) || null,

    marca:
      normalizarMaiusculo(
        tpd.marca
      ) || null,

    modelo:
      normalizarMaiusculo(
        tpd.modelo
      ) || null,

    tipo_equipamento:
      normalizarTipoEquipamento(
        tpd.tipo_equipamento
      ),

    unidade:
      normalizarMaiusculo(
        tpd.unidade
      ) || null,

    status_operacional:
      normalizarStatus(
        tpd.status_operacional
      ),

    local_atual:
      normalizarTexto(
        tpd.local_atual
      ) || null,

    equipe_vinculada:
      normalizarMaiusculo(
        tpd.equipe_vinculada
      ) || null,

    viatura_vinculada:
      normalizarMaiusculo(
        tpd.viatura_vinculada
      ) || null,

    qr_code:
      normalizarTexto(
        tpd.qr_code
      ) || null,

    foto_url:
      normalizarTexto(
        tpd.foto_url
      ) || null,

    observacoes:
      normalizarTexto(
        tpd.observacoes
      ) || null,

    ativo:
      tpd.ativo !== false
  }
}

function prepararPayload(payload = {}) {
  const tpd = normalizarTPD(payload)

  return {
    patrimonio: tpd.patrimonio,
    numero_serie: tpd.numero_serie,
    marca: tpd.marca,
    modelo: tpd.modelo,
    tipo_equipamento:
      tpd.tipo_equipamento,
    unidade: tpd.unidade,
    status_operacional:
      tpd.status_operacional,
    local_atual:
      tpd.local_atual,
    equipe_vinculada:
      tpd.equipe_vinculada,
    viatura_vinculada:
      tpd.viatura_vinculada,
    observacoes:
      tpd.observacoes,
    qr_code:
      tpd.qr_code,
    foto_url:
      tpd.foto_url,
    ativo:
      tpd.ativo
  }
}

function limparPesquisa(valor) {
  return String(valor || '')
    .trim()
    .replace(/[%(),]/g, '')
}

function definirLocalPatrimonial(tpd) {
  if (tpd.local_atual) {
    return tpd.local_atual
  }

  if (
    tpd.status_operacional ===
    'EM_SERVICO'
  ) {
    return 'Em serviço'
  }

  if (
    tpd.status_operacional ===
    'MANUTENCAO'
  ) {
    return 'Manutenção'
  }

  if (
    tpd.status_operacional ===
    'RECOLHIDO'
  ) {
    return 'Recolhido'
  }

  if (
    tpd.status_operacional ===
    'BAIXADO'
  ) {
    return 'Baixado'
  }

  return 'Guarda do Quartel'
}

export async function listarTPDs({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'criado_em',
  sortDirection = 'desc'
} = {}) {
  const inicio =
    (pagina - 1) * limite

  const fim =
    inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', {
      count: 'exact'
    })
    .order(sortBy, {
      ascending:
        sortDirection === 'asc',
      nullsFirst: false
    })
    .range(inicio, fim)

  const pesquisa =
    limparPesquisa(
      filtros.pesquisa
    )

  if (pesquisa) {
    query = query.or(
      [
        `patrimonio.ilike.%${pesquisa}%`,
        `numero_serie.ilike.%${pesquisa}%`,
        `qr_code.ilike.%${pesquisa}%`,
        `marca.ilike.%${pesquisa}%`,
        `modelo.ilike.%${pesquisa}%`,
        `tipo_equipamento.ilike.%${pesquisa}%`,
        `unidade.ilike.%${pesquisa}%`,
        `local_atual.ilike.%${pesquisa}%`,
        `equipe_vinculada.ilike.%${pesquisa}%`,
        `viatura_vinculada.ilike.%${pesquisa}%`
      ].join(',')
    )
  }

  if (
    filtros.patrimonio?.trim()
  ) {
    query = query.ilike(
      'patrimonio',
      `%${filtros.patrimonio.trim()}%`
    )
  }

  if (
    filtros.numero_serie?.trim()
  ) {
    query = query.ilike(
      'numero_serie',
      `%${filtros.numero_serie.trim()}%`
    )
  }

  if (
    filtros.qr_code?.trim()
  ) {
    query = query.ilike(
      'qr_code',
      `%${filtros.qr_code.trim()}%`
    )
  }

  if (
    filtros.marca?.trim()
  ) {
    query = query.ilike(
      'marca',
      `%${filtros.marca.trim()}%`
    )
  }

  if (
    filtros.modelo?.trim()
  ) {
    query = query.ilike(
      'modelo',
      `%${filtros.modelo.trim()}%`
    )
  }

  if (
    filtros.tipo_equipamento?.trim()
  ) {
    query = query.eq(
      'tipo_equipamento',
      normalizarTipoEquipamento(
        filtros.tipo_equipamento
      )
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

  if (
    filtros.unidade?.trim()
  ) {
    query = query.ilike(
      'unidade',
      `%${filtros.unidade.trim()}%`
    )
  }

  if (
    filtros.local_atual?.trim()
  ) {
    query = query.ilike(
      'local_atual',
      `%${filtros.local_atual.trim()}%`
    )
  }

  if (
    filtros.equipe_vinculada?.trim()
  ) {
    query = query.ilike(
      'equipe_vinculada',
      `%${filtros.equipe_vinculada.trim()}%`
    )
  }

  if (
    filtros.viatura_vinculada?.trim()
  ) {
    query = query.ilike(
      'viatura_vinculada',
      `%${filtros.viatura_vinculada.trim()}%`
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

    query = query.eq(
      'ativo',
      ativo
    )
  }

  const {
    data,
    error,
    count
  } = await query

  if (error) throw error

  return {
    data: (data || []).map(
      normalizarTPD
    ),
    total: count || 0
  }
}

export async function buscarTPDPorId(
  id
) {
  if (!id) {
    throw new Error(
      'ID do TPD não informado.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return normalizarTPD(data)
}

export async function buscarTPDPorQRCode(
  qrCode
) {
  const codigo =
    normalizarTexto(qrCode)

  if (!codigo) {
    return null
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('qr_code', codigo)
    .maybeSingle()

  if (error) throw error

  return normalizarTPD(data)
}

export async function verificarTPDExistente({
  patrimonio,
  numero_serie,
  ignorarId = null
} = {}) {
  const patrimonioNormalizado =
    normalizarMaiusculo(
      patrimonio
    )

  const serieNormalizada =
    normalizarMaiusculo(
      numero_serie
    )

  if (
    !patrimonioNormalizado &&
    !serieNormalizada
  ) {
    return null
  }

  const condicoes = []

  if (patrimonioNormalizado) {
    condicoes.push(
      `patrimonio.eq.${patrimonioNormalizado}`
    )
  }

  if (serieNormalizada) {
    condicoes.push(
      `numero_serie.eq.${serieNormalizada}`
    )
  }

  let query = supabase
    .from(TABLE)
    .select(
      'id, patrimonio, numero_serie, marca, modelo'
    )
    .or(condicoes.join(','))
    .limit(1)

  if (ignorarId) {
    query = query.neq(
      'id',
      ignorarId
    )
  }

  const {
    data,
    error
  } = await query

  if (error) throw error

  return data?.[0] || null
}

async function buscarValoresUnicos(
  campo
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select(campo)
    .eq('ativo', true)

  if (error) throw error

  return [
    ...new Set(
      (data || [])
        .map(
          (item) =>
            item[campo]
        )
        .filter(Boolean)
    )
  ].sort((a, b) =>
    String(a).localeCompare(
      String(b),
      'pt-BR'
    )
  )
}

export function listarMarcasTPD() {
  return buscarValoresUnicos(
    'marca'
  )
}

export function listarModelosTPD() {
  return buscarValoresUnicos(
    'modelo'
  )
}

export function listarUnidadesTPD() {
  return buscarValoresUnicos(
    'unidade'
  )
}

export function listarLocaisTPD() {
  return buscarValoresUnicos(
    'local_atual'
  )
}

export async function cadastrarTPD(
  payload,
  user = null
) {
  const dados =
    prepararPayload(payload)

  const existente =
    await verificarTPDExistente({
      patrimonio:
        dados.patrimonio,
      numero_serie:
        dados.numero_serie
    })

  if (existente) {
    throw new Error(
      'Já existe um TPD com esse patrimônio ou número de série.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert(dados)
    .select()
    .single()

  if (error) throw error

  const tpdNormalizado =
    normalizarTPD(data)

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'tpd',

      referencia_id:
        tpdNormalizado.id,

      dados:
        tpdNormalizado,

      user,

      local_atual:
        definirLocalPatrimonial(
          tpdNormalizado
        ),

      companhia_atual:
        tpdNormalizado.unidade ||
        ''
    })

    return tpdNormalizado
  } catch (error) {
    const {
      error: rollbackError
    } = await supabase
      .from(TABLE)
      .delete()
      .eq(
        'id',
        tpdNormalizado.id
      )

    if (rollbackError) {
      console.error(
        'Não foi possível desfazer o cadastro incompleto do TPD:',
        rollbackError
      )
    }

    throw error
  }
}

export async function atualizarTPD(
  id,
  payload,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID do TPD não informado.'
    )
  }

  const dados =
    prepararPayload(payload)

  const existente =
    await verificarTPDExistente({
      patrimonio:
        dados.patrimonio,
      numero_serie:
        dados.numero_serie,
      ignorarId: id
    })

  if (existente) {
    throw new Error(
      'Já existe outro TPD com esse patrimônio ou número de série.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const tpdNormalizado =
    normalizarTPD(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'tpd',

    referencia_id:
      tpdNormalizado.id,

    dados:
      tpdNormalizado,

    user,

    local_atual:
      definirLocalPatrimonial(
        tpdNormalizado
      ),

    companhia_atual:
      tpdNormalizado.unidade ||
      ''
  })

  return tpdNormalizado
}

export async function excluirTPD(
  id,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID do TPD não informado.'
    )
  }

  await desativarPatrimonioPorReferencia({
    tipo: 'tpd',

    referencia_id: id,

    user,

    motivo:
      'TPD excluído ou baixado no cadastro específico.'
  })

  const {
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function desativarTPD(
  id,
  user = null
) {
  return atualizarTPD(
    id,
    {
      ativo: false,
      status_operacional:
        'BAIXADO',
      local_atual:
        'Baixado'
    },
    user
  )
}

export async function sincronizarTPDsComPatrimonios(
  user = null
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const tpdsNormalizados =
    (data || []).map(
      normalizarTPD
    )

  for (
    const tpd of tpdsNormalizados
  ) {
    await criarOuAtualizarPatrimonio({
      tipo: 'tpd',

      referencia_id:
        tpd.id,

      dados:
        tpd,

      user,

      local_atual:
        definirLocalPatrimonial(
          tpd
        ),

      companhia_atual:
        tpd.unidade || ''
    })
  }

  return tpdsNormalizados.length
}