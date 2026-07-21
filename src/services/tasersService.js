import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_tasers'

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

function normalizarTipoTaser(tipo) {
  const valor = normalizarMaiusculo(tipo)

  if (!valor) {
    return 'PORTATIL'
  }

  return valor
}

function normalizarTaser(taser) {
  if (!taser) return null

  return {
    ...taser,

    patrimonio:
      normalizarMaiusculo(
        taser.patrimonio
      ) || null,

    numero_serie:
      normalizarMaiusculo(
        taser.numero_serie
      ) || null,

    marca:
      normalizarMaiusculo(
        taser.marca
      ) || null,

    modelo:
      normalizarMaiusculo(
        taser.modelo
      ) || null,

    tipo_taser:
      normalizarTipoTaser(
        taser.tipo_taser
      ),

    unidade:
      normalizarMaiusculo(
        taser.unidade
      ) || null,

    status_operacional:
      normalizarStatus(
        taser.status_operacional
      ),

    local_atual:
      normalizarTexto(
        taser.local_atual
      ) || null,

    equipe_vinculada:
      normalizarMaiusculo(
        taser.equipe_vinculada
      ) || null,

    viatura_vinculada:
      normalizarMaiusculo(
        taser.viatura_vinculada
      ) || null,

    qr_code:
      normalizarTexto(
        taser.qr_code
      ) || null,

    foto_url:
      normalizarTexto(
        taser.foto_url
      ) || null,

    observacoes:
      normalizarTexto(
        taser.observacoes
      ) || null,

    ativo:
      taser.ativo !== false
  }
}

function prepararPayload(payload = {}) {
  const taser = normalizarTaser(payload)

  return {
    patrimonio: taser.patrimonio,
    numero_serie: taser.numero_serie,
    marca: taser.marca,
    modelo: taser.modelo,
    tipo_taser:
      taser.tipo_taser,
    unidade: taser.unidade,
    status_operacional:
      taser.status_operacional,
    local_atual:
      taser.local_atual,
    equipe_vinculada:
      taser.equipe_vinculada,
    viatura_vinculada:
      taser.viatura_vinculada,
    observacoes:
      taser.observacoes,
    qr_code:
      taser.qr_code,
    foto_url:
      taser.foto_url,
    ativo:
      taser.ativo
  }
}

function limparPesquisa(valor) {
  return String(valor || '')
    .trim()
    .replace(/[%(),]/g, '')
}

function definirLocalPatrimonial(taser) {
  if (taser.local_atual) {
    return taser.local_atual
  }

  if (
    taser.status_operacional ===
    'EM_SERVICO'
  ) {
    return 'Em serviço'
  }

  if (
    taser.status_operacional ===
    'MANUTENCAO'
  ) {
    return 'Manutenção'
  }

  if (
    taser.status_operacional ===
    'RECOLHIDO'
  ) {
    return 'Recolhido'
  }

  if (
    taser.status_operacional ===
    'BAIXADO'
  ) {
    return 'Baixado'
  }

  return 'Guarda do Quartel'
}

export async function listarTasers({
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
        `tipo_taser.ilike.%${pesquisa}%`,
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
    filtros.tipo_taser?.trim()
  ) {
    query = query.eq(
      'tipo_taser',
      normalizarTipoTaser(
        filtros.tipo_taser
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
      normalizarTaser
    ),
    total: count || 0
  }
}

export async function buscarTaserPorId(
  id
) {
  if (!id) {
    throw new Error(
      'ID do Taser não informado.'
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

  return normalizarTaser(data)
}

export async function buscarTaserPorQRCode(
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

  return normalizarTaser(data)
}

export async function verificarTaserExistente({
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

export function listarMarcasTaser() {
  return buscarValoresUnicos(
    'marca'
  )
}

export function listarModelosTaser() {
  return buscarValoresUnicos(
    'modelo'
  )
}

export function listarUnidadesTaser() {
  return buscarValoresUnicos(
    'unidade'
  )
}

export function listarLocaisTaser() {
  return buscarValoresUnicos(
    'local_atual'
  )
}

export async function cadastrarTaser(
  payload,
  user = null
) {
  const dados =
    prepararPayload(payload)

  const existente =
    await verificarTaserExistente({
      patrimonio:
        dados.patrimonio,
      numero_serie:
        dados.numero_serie
    })

  if (existente) {
    throw new Error(
      'Já existe um Taser com esse patrimônio ou número de série.'
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

  const taserNormalizado =
    normalizarTaser(data)

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'taser',

      referencia_id:
        taserNormalizado.id,

      dados:
        taserNormalizado,

      user,

      local_atual:
        definirLocalPatrimonial(
          taserNormalizado
        ),

      companhia_atual:
        taserNormalizado.unidade ||
        ''
    })

    return taserNormalizado
  } catch (error) {
    const {
      error: rollbackError
    } = await supabase
      .from(TABLE)
      .delete()
      .eq(
        'id',
        taserNormalizado.id
      )

    if (rollbackError) {
      console.error(
        'Não foi possível desfazer o cadastro incompleto do Taser:',
        rollbackError
      )
    }

    throw error
  }
}

export async function atualizarTaser(
  id,
  payload,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID do Taser não informado.'
    )
  }

  const dados =
    prepararPayload(payload)

  const existente =
    await verificarTaserExistente({
      patrimonio:
        dados.patrimonio,
      numero_serie:
        dados.numero_serie,
      ignorarId: id
    })

  if (existente) {
    throw new Error(
      'Já existe outro Taser com esse patrimônio ou número de série.'
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

  const taserNormalizado =
    normalizarTaser(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'taser',

    referencia_id:
      taserNormalizado.id,

    dados:
      taserNormalizado,

    user,

    local_atual:
      definirLocalPatrimonial(
        taserNormalizado
      ),

    companhia_atual:
      taserNormalizado.unidade ||
      ''
  })

  return taserNormalizado
}

export async function excluirTaser(
  id,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID do Taser não informado.'
    )
  }

  await desativarPatrimonioPorReferencia({
    tipo: 'taser',

    referencia_id: id,

    user,

    motivo:
      'Taser excluído ou baixado no cadastro específico.'
  })

  const {
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function desativarTaser(
  id,
  user = null
) {
  return atualizarTaser(
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

export async function sincronizarTasersComPatrimonios(
  user = null
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const tasersNormalizados =
    (data || []).map(
      normalizarTaser
    )

  for (const taser of tasersNormalizados) {
    await criarOuAtualizarPatrimonio({
      tipo: 'taser',

      referencia_id:
        taser.id,

      dados: taser,

      user,

      local_atual:
        definirLocalPatrimonial(
          taser
        ),

      companhia_atual:
        taser.unidade || ''
    })
  }

  return tasersNormalizados.length
}