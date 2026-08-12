import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

const TABLE = 'sigmo_armas'

function normalizarStatus(status) {
  if (!status) return 'RESERVA'

  const valor = String(status)
    .trim()
    .toUpperCase()

  if (
    valor === 'DISPONÍVEL' ||
    valor === 'DISPONIVEL' ||
    valor === 'ATIVO'
  ) {
    return 'RESERVA'
  }

  return valor
}

function statusControladoPelaEngine(status) {
  return [
    'CARGA',
    'CAUTELADO'
  ].includes(
    normalizarStatus(status)
  )
}

function propriedadePMESP(valor) {
  return String(
    valor || 'PMESP'
  )
    .trim()
    .toUpperCase() === 'PMESP'
}

function normalizarArma(arma) {
  return {
    ...arma,

    propriedade: String(
      arma.propriedade || 'PMESP'
    )
      .trim()
      .toUpperCase(),

    status_operacional: normalizarStatus(
      arma.status_operacional ||
        arma.status
    )
  }
}

function limparPesquisa(valor) {
  return String(valor || '')
    .trim()
    .replace(/[%(),]/g, '')
}

export async function listarArmas({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio =
    (pagina - 1) * limite

  const fim =
    inicio + limite - 1

  const campoOrdenacao =
    sortBy === 'status_operacional'
      ? 'status'
      : sortBy

  let query = supabase
    .from(TABLE)
    .select('*', {
      count: 'exact'
    })
    .order(campoOrdenacao, {
      ascending:
        sortDirection === 'asc',

      nullsFirst: false
    })
    .range(inicio, fim)

  const pesquisa =
    limparPesquisa(filtros.pesquisa)

  if (pesquisa) {
    query = query.or(
      [
        `patrimonio.ilike.%${pesquisa}%`,
        `numero_serie.ilike.%${pesquisa}%`,
        `qr_code.ilike.%${pesquisa}%`,
        `especie.ilike.%${pesquisa}%`,
        `marca.ilike.%${pesquisa}%`,
        `modelo.ilike.%${pesquisa}%`,
        `proprietario_re.ilike.%${pesquisa}%`,
        `proprietario_nome.ilike.%${pesquisa}%`
      ].join(',')
    )
  }

  if (filtros.patrimonio?.trim()) {
    query = query.ilike(
      'patrimonio',
      `%${filtros.patrimonio.trim()}%`
    )
  }

  if (filtros.propriedade?.trim()) {
    query = query.eq(
      'propriedade',
      filtros.propriedade
        .trim()
        .toUpperCase()
    )
  }

  if (filtros.numero_serie?.trim()) {
    query = query.ilike(
      'numero_serie',
      `%${filtros.numero_serie.trim()}%`
    )
  }

  if (filtros.qr_code?.trim()) {
    query = query.ilike(
      'qr_code',
      `%${filtros.qr_code.trim()}%`
    )
  }

  if (filtros.especie?.trim()) {
    query = query.ilike(
      'especie',
      `%${filtros.especie.trim()}%`
    )
  }

  if (filtros.calibre?.trim()) {
    query = query.ilike(
      'calibre',
      `%${filtros.calibre.trim()}%`
    )
  }

  if (filtros.status?.trim()) {
    query = query.eq(
      'status',
      filtros.status
        .trim()
        .toUpperCase()
    )
  }

  if (filtros.unidade?.trim()) {
    query = query.ilike(
      'unidade',
      `%${filtros.unidade.trim()}%`
    )
  }

  if (filtros.proprietario_re?.trim()) {
    query = query.ilike(
      'proprietario_re',
      `%${filtros.proprietario_re.trim()}%`
    )
  }

  if (filtros.proprietario_nome?.trim()) {
    query = query.ilike(
      'proprietario_nome',
      `%${filtros.proprietario_nome.trim()}%`
    )
  }

  const {
    data,
    error,
    count
  } = await query

  if (error) throw error

  return {
    data: (data ?? []).map(
      normalizarArma
    ),

    total: count ?? 0
  }
}

export async function buscarArmaPorId(id) {
  if (!id) {
    throw new Error('ID da arma não informado.')
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    throw new Error('Arma não encontrada.')
  }

  return normalizarArma(data)
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

  if (error) throw error

  return [
    ...new Set(
      (data || [])
        .map((item) =>
          item[campo]
        )
        .filter(Boolean)
    )
  ].sort()
}

export function listarEspecies() {
  return buscarValoresUnicos(
    'especie'
  )
}

export function listarCalibres() {
  return buscarValoresUnicos(
    'calibre'
  )
}

export function listarUnidades() {
  return buscarValoresUnicos(
    'unidade'
  )
}

export async function cadastrarArma(
  payload,
  user = null
) {
  const statusNormalizado =
    normalizarStatus(
      payload.status_operacional ||
        payload.status
    )

  if (
    propriedadePMESP(payload.propriedade) &&
    statusControladoPelaEngine(
      statusNormalizado
    )
  ) {
    throw new Error(
      'CARGA e CAUTELADO são controlados pela Engine Patrimonial. Cadastre a arma em RESERVA e use Pagar/Receber Material.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert({
      ...payload,

      propriedade: String(
        payload.propriedade ||
          'PMESP'
      )
        .trim()
        .toUpperCase(),

      status: statusNormalizado,

      qr_code:
        payload.qr_code || null
    })
    .select()
    .single()

  if (error) throw error

  const armaNormalizada =
    normalizarArma(data)

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'arma',

      referencia_id:
        armaNormalizada.id,

      dados: armaNormalizada,

      user,

      local_atual:
        armaNormalizada.local_atual ||
        (
          statusNormalizado === 'CARGA'
            ? 'Carga permanente'
            : 'Guarda do Quartel'
        ),

      companhia_atual:
        armaNormalizada.unidade || ''
    })

    return armaNormalizada
  } catch (error) {
    const {
      error: rollbackError
    } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', armaNormalizada.id)

    if (rollbackError) {
      console.error(
        'Não foi possível desfazer o cadastro incompleto da arma:',
        rollbackError
      )
    }

    throw error
  }
}

export async function atualizarArma(
  id,
  payload,
  user = null
) {
  const atual =
    await buscarArmaPorId(id)

  const statusAtual =
    normalizarStatus(
      atual.status_operacional ||
      atual.status
    )

  const statusSolicitado =
    normalizarStatus(
      payload.status_operacional ||
      payload.status
    )

  const pmesp =
    propriedadePMESP(
      payload.propriedade ||
      atual.propriedade
    )

  if (
    pmesp &&
    statusControladoPelaEngine(
      statusSolicitado
    ) &&
    statusSolicitado !== statusAtual
  ) {
    throw new Error(
      'CARGA e CAUTELADO são controlados pela Engine Patrimonial. Use Pagar/Receber Material.'
    )
  }

  const operacaoProtegida =
    pmesp &&
    statusControladoPelaEngine(
      statusAtual
    )

  const payloadSeguro =
    operacaoProtegida
      ? {
          ...payload,
          status:
            atual.status,
          status_operacional:
            atual.status_operacional,
          carga_policial_id:
            atual.carga_policial_id,
          carga_policial_re:
            atual.carga_policial_re,
          carga_policial_nome:
            atual.carga_policial_nome,
          carga_policial_posto_graduacao:
            atual.carga_policial_posto_graduacao,
          carga_policial_companhia:
            atual.carga_policial_companhia,
          carga_policial_pelotao:
            atual.carga_policial_pelotao,
          carga_policial_funcao:
            atual.carga_policial_funcao
        }
      : payload

  const statusNormalizado =
    normalizarStatus(
      payloadSeguro.status_operacional ||
        payloadSeguro.status
    )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      ...payloadSeguro,

      propriedade: String(
        payloadSeguro.propriedade ||
          atual.propriedade ||
          'PMESP'
      )
        .trim()
        .toUpperCase(),

      status: statusNormalizado,

      qr_code:
        payloadSeguro.qr_code ||
        atual.qr_code ||
        null
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const armaNormalizada =
    normalizarArma(data)

  await criarOuAtualizarPatrimonio({
    tipo: 'arma',

    referencia_id:
      armaNormalizada.id,

    dados: armaNormalizada,

    user,

    local_atual:
      armaNormalizada.local_atual ||
      'Guarda do Quartel',

    companhia_atual:
      armaNormalizada.unidade || ''
  })

  return armaNormalizada
}

export async function excluirArma(
  id,
  user = null
) {
  await desativarPatrimonioPorReferencia({
    tipo: 'arma',

    referencia_id: id,

    user,

    motivo:
      'Arma excluída ou baixada no cadastro específico.'
  })

  const {
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function sincronizarArmasComPatrimonios(
  user = null
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')

  if (error) throw error

  const armasNormalizadas =
    (data || []).map(
      normalizarArma
    )

  for (
    const arma of armasNormalizadas
  ) {
    await criarOuAtualizarPatrimonio({
      tipo: 'arma',

      referencia_id: arma.id,

      dados: arma,

      user,

      local_atual:
        arma.local_atual ||
        'Guarda do Quartel',

      companhia_atual:
        arma.unidade || ''
    })
  }

  return armasNormalizadas.length
}

export async function finalizarDevolucaoCargaP4({
  itens = []
} = {}) {
  const patrimonioIds = [
    ...new Set(
      (Array.isArray(itens) ? itens : [])
        .map((item) => item?.patrimonio_id)
        .filter(Boolean)
    )
  ]

  if (patrimonioIds.length === 0) {
    throw new Error(
      'Nenhum patrimônio foi informado para finalizar a devolução ao P4.'
    )
  }

  const {
    data: patrimonios,
    error: patrimonioError
  } = await supabase
    .from('sigmo_patrimonios')
    .select('id, tipo, referencia_id')
    .in('id', patrimonioIds)

  if (patrimonioError) throw patrimonioError

  const armas = (patrimonios || []).filter(
    (patrimonio) =>
      String(patrimonio?.tipo || '')
        .trim()
        .toUpperCase() === 'ARMA' &&
      patrimonio?.referencia_id
  )

  if (armas.length === 0) {
    return {
      armasAtualizadas: 0
    }
  }

  const armaIds = armas.map(
    (patrimonio) => patrimonio.referencia_id
  )

  const {
    error: armaError
  } = await supabase
    .from(TABLE)
    .update({
      status: 'RESERVA',
      local_atual: 'GUARDA DO P4',
      carga_policial_id: null,
      carga_policial_re: null,
      carga_policial_nome: null,
      carga_policial_posto_graduacao: null,
      carga_policial_companhia: null,
      carga_policial_pelotao: null,
      carga_policial_funcao: null
    })
    .in('id', armaIds)

  if (armaError) throw armaError

  const idsPatrimonioArmas = armas.map(
    (patrimonio) => patrimonio.id
  )

  const {
    error: sincronizacaoError
  } = await supabase
    .from('sigmo_patrimonios')
    .update({
      status: 'RESERVA',
      local_atual: 'DEPÓSITO DO P4'
    })
    .in('id', idsPatrimonioArmas)

  if (sincronizacaoError) {
    throw sincronizacaoError
  }

  return {
    armasAtualizadas: armaIds.length
  }
}

