import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_hts'

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

function normalizarTipoHT(tipo) {
  const valor = normalizarMaiusculo(tipo)

  if (!valor) {
    return 'PORTATIL'
  }

  return valor
}

function normalizarHT(ht) {
  if (!ht) return null

  return {
    ...ht,

    patrimonio:
      normalizarMaiusculo(
        ht.patrimonio
      ) || null,

    numero_serie:
      normalizarMaiusculo(
        ht.numero_serie
      ) || null,

    marca:
      normalizarMaiusculo(
        ht.marca
      ) || null,

    modelo:
      normalizarMaiusculo(
        ht.modelo
      ) || null,

    tipo_ht:
      normalizarTipoHT(
        ht.tipo_ht
      ),

    unidade:
      normalizarMaiusculo(
        ht.unidade
      ) || null,

    status_operacional:
      normalizarStatus(
        ht.status_operacional
      ),

    local_atual:
      normalizarTexto(
        ht.local_atual
      ) || null,

    equipe_vinculada:
      normalizarMaiusculo(
        ht.equipe_vinculada
      ) || null,

    viatura_vinculada:
      normalizarMaiusculo(
        ht.viatura_vinculada
      ) || null,

    qr_code:
      normalizarTexto(
        ht.qr_code
      ) || null,

    foto_url:
      normalizarTexto(
        ht.foto_url
      ) || null,

    observacoes:
      normalizarTexto(
        ht.observacoes
      ) || null,

    ativo:
      ht.ativo !== false
  }
}

function prepararPayload(payload = {}) {
  const ht = normalizarHT(payload)

  return {
    patrimonio: ht.patrimonio,
    numero_serie: ht.numero_serie,
    marca: ht.marca,
    modelo: ht.modelo,
    tipo_ht:
      ht.tipo_ht,
    unidade: ht.unidade,
    status_operacional:
      ht.status_operacional,
    local_atual:
      ht.local_atual,
    equipe_vinculada:
      ht.equipe_vinculada,
    viatura_vinculada:
      ht.viatura_vinculada,
    observacoes:
      ht.observacoes,
    qr_code:
      ht.qr_code,
    foto_url:
      ht.foto_url,
    ativo:
      ht.ativo
  }
}

function limparPesquisa(valor) {
  return String(valor || '')
    .trim()
    .replace(/[%(),]/g, '')
}

function definirLocalPatrimonial(ht) {
  if (ht.local_atual) {
    return ht.local_atual
  }

  if (
    ht.status_operacional ===
    'EM_SERVICO'
  ) {
    return 'Em serviço'
  }

  if (
    ht.status_operacional ===
    'MANUTENCAO'
  ) {
    return 'Manutenção'
  }

  if (
    ht.status_operacional ===
    'RECOLHIDO'
  ) {
    return 'Recolhido'
  }

  if (
    ht.status_operacional ===
    'BAIXADO'
  ) {
    return 'Baixado'
  }

  return 'Guarda do Quartel'
}

export async function listarHTs({
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
        `tipo_ht.ilike.%${pesquisa}%`,
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
    filtros.tipo_ht?.trim()
  ) {
    query = query.eq(
      'tipo_ht',
      normalizarTipoHT(
        filtros.tipo_ht
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
      normalizarHT
    ),
    total: count || 0
  }
}

export async function buscarHTPorId(
  id
) {
  if (!id) {
    throw new Error(
      'ID do HT não informado.'
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

  return normalizarHT(data)
}

export async function buscarHTPorQRCode(
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

  return normalizarHT(data)
}

export async function verificarHTExistente({
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

export function listarMarcasHT() {
  return buscarValoresUnicos(
    'marca'
  )
}

export function listarModelosHT() {
  return buscarValoresUnicos(
    'modelo'
  )
}

export function listarUnidadesHT() {
  return buscarValoresUnicos(
    'unidade'
  )
}

export function listarLocaisHT() {
  return buscarValoresUnicos(
    'local_atual'
  )
}

export async function cadastrarHT(
  payload,
  user = null
) {
  const dados =
    prepararPayload(payload)

  const existente =
    await verificarHTExistente({
      patrimonio:
        dados.patrimonio,
      numero_serie:
        dados.numero_serie
    })

  if (existente) {
    throw new Error(
      'Já existe um HT com esse patrimônio ou número de série.'
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

  const htNormalizado =
    normalizarHT(data)

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'ht',

      referencia_id:
        htNormalizado.id,

      dados:
        htNormalizado,

      user,

      local_atual:
        definirLocalPatrimonial(
          htNormalizado
        ),

      companhia_atual:
        htNormalizado.unidade ||
        ''
    })

    return htNormalizado
  } catch (error) {
    const {
      error: rollbackError
    } = await supabase
      .from(TABLE)
      .delete()
      .eq(
        'id',
        htNormalizado.id
      )

    if (rollbackError) {
      console.error(
        'Não foi possível desfazer o cadastro incompleto do HT:',
        rollbackError
      )
    }

    throw error
  }
}

export async function atualizarHT(
  id,
  payload,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID do HT não informado.'
    )
  }

  const dados =
    prepararPayload(payload)

  const existente =
    await verificarHTExistente({
      patrimonio:
        dados.patrimonio,
      numero_serie:
        dados.numero_serie,
      ignorarId: id
    })

  if (existente) {
    throw new Error(
      'Já existe outro HT com esse patrimônio ou número de série.'
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

  const htNormalizado =
    normalizarHT(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'ht',

    referencia_id:
      htNormalizado.id,

    dados:
      htNormalizado,

    user,

    local_atual:
      definirLocalPatrimonial(
        htNormalizado
      ),

    companhia_atual:
      htNormalizado.unidade ||
      ''
  })

  return htNormalizado
}

export async function excluirHT(
  id,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID do HT não informado.'
    )
  }

  await desativarPatrimonioPorReferencia({
    tipo: 'ht',

    referencia_id: id,

    user,

    motivo:
      'HT excluído ou baixado no cadastro específico.'
  })

  const {
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function desativarHT(
  id,
  user = null
) {
  return atualizarHT(
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

export async function sincronizarHTsComPatrimonios(
  user = null
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const htsNormalizados =
    (data || []).map(
      normalizarHT
    )

  for (const ht of htsNormalizados) {
    await criarOuAtualizarPatrimonio({
      tipo: 'ht',

      referencia_id:
        ht.id,

      dados: ht,

      user,

      local_atual:
        definirLocalPatrimonial(
          ht
        ),

      companhia_atual:
        ht.unidade || ''
    })
  }

  return htsNormalizados.length
}