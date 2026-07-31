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
    valor === 'DISPONIVEL'
  ) {
    return 'RESERVA'
  }

  return valor
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


async function enriquecerArmasComResponsabilidadePatrimonial(armas = []) {
  const lista = Array.isArray(armas) ? armas : []
  const referencias = lista
    .map((arma) => arma?.id)
    .filter(Boolean)

  if (!referencias.length) return lista

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('id, referencia_id, responsavel_atual_id, responsavel_atual_nome, local_atual, status, dados')
    .eq('tipo', 'arma')
    .eq('ativo', true)
    .in('referencia_id', referencias)

  if (error) {
    console.error('Erro ao carregar responsabilidade patrimonial das armas:', error)
    return lista
  }

  const patrimonios = data || []

  const porReferencia = new Map(
    patrimonios.map((item) => [String(item.referencia_id), item])
  )

  const patrimonioIds = patrimonios
    .map((item) => item?.id)
    .filter(Boolean)

  let movimentosPorPatrimonio = new Map()

  if (patrimonioIds.length) {
    const { data: movimentos, error: erroMovimentos } = await supabase
      .from('sigmo_patrimonio_movimentacoes')
      .select('*')
      .in('patrimonio_id', patrimonioIds)
      .in('tipo_movimentacao', [
        'CARGA_PERMANENTE',
        'CAUTELA_SERVICO',
        'CAUTELA'
      ])
      .order('created_at', { ascending: false })

    if (erroMovimentos) {
      console.error(
        'Erro ao carregar movimentações de carga/cautela das armas:',
        erroMovimentos
      )
    } else {
      movimentosPorPatrimonio = new Map()

      for (const movimento of movimentos || []) {
        const chave = String(movimento?.patrimonio_id || '')
        if (chave && !movimentosPorPatrimonio.has(chave)) {
          movimentosPorPatrimonio.set(chave, movimento)
        }
      }
    }
  }

  return lista.map((arma) => {
    const patrimonio = porReferencia.get(String(arma.id))
    if (!patrimonio) return arma

    const dados = patrimonio.dados || {}
    const movimento = movimentosPorPatrimonio.get(String(patrimonio.id)) || null
    const dadosMovimento = movimento?.dados || movimento?.metadata || {}

    const responsavelNome =
      patrimonio.responsavel_atual_nome ||
      dados.carga_policial_nome ||
      dados.responsavel_nome ||
      dadosMovimento.carga_policial_nome ||
      dadosMovimento.policial_nome ||
      dadosMovimento.responsavel_nome ||
      arma.responsavel_nome ||
      null

    const responsavelRe =
      dados.carga_policial_re ||
      dados.responsavel_re ||
      dadosMovimento.carga_policial_re ||
      dadosMovimento.policial_re ||
      dadosMovimento.responsavel_re ||
      arma.responsavel_re ||
      null

    return {
      ...arma,
      responsavel_atual_id:
        patrimonio.responsavel_atual_id ||
        arma.responsavel_atual_id ||
        null,
      responsavel_atual_nome: responsavelNome,
      responsavel_nome: responsavelNome,
      responsavel_re: responsavelRe,
      carga_policial_nome:
        dados.carga_policial_nome || responsavelNome,
      carga_policial_re:
        dados.carga_policial_re || responsavelRe,
      local_atual:
        patrimonio.local_atual ||
        arma.local_atual ||
        null,
      status_patrimonial:
        patrimonio.status ||
        null,
      vinculo_patrimonial_tipo:
        movimento?.tipo_movimentacao ||
        movimento?.tipo ||
        null,
      vinculo_patrimonial_em:
        movimento?.created_at ||
        movimento?.criado_em ||
        movimento?.data_movimentacao ||
        null
    }
  })
}

function limparPesquisa(valor) {
  return String(valor || '')
    .trim()
    .replace(/[%(),]/g, '')
}


async function buscarReferenciasPorResponsavel(pesquisa) {
  const termo = limparPesquisa(pesquisa)
  if (!termo) return []

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('referencia_id, responsavel_atual_nome, dados')
    .eq('tipo', 'arma')
    .eq('ativo', true)

  if (error) {
    console.error('Erro ao pesquisar responsável patrimonial das armas:', error)
    return []
  }

  const termoNormalizado = termo.toLocaleLowerCase('pt-BR')

  return (data || [])
    .filter((item) => {
      const dados = item?.dados || {}
      const valores = [
        item?.responsavel_atual_nome,
        dados?.carga_policial_nome,
        dados?.carga_policial_re,
        dados?.responsavel_nome,
        dados?.responsavel_re,
        dados?.policial_nome,
        dados?.policial_re
      ]

      return valores.some((valor) =>
        String(valor || '')
          .toLocaleLowerCase('pt-BR')
          .includes(termoNormalizado)
      )
    })
    .map((item) => item?.referencia_id)
    .filter(Boolean)
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
    // O responsável atual de uma arma pode estar somente na Engine Patrimonial
    // (sigmo_patrimonios), e não nos campos legados proprietario_* da sigmo_armas.
    // Primeiro localizamos as armas pelo nome/RE do responsável e depois juntamos
    // essas referências à pesquisa normal da tabela de armas.
    const referenciasResponsavel = await buscarReferenciasPorResponsavel(pesquisa)

    const condicoesPesquisa = [
      `patrimonio.ilike.%${pesquisa}%`,
      `numero_serie.ilike.%${pesquisa}%`,
      `qr_code.ilike.%${pesquisa}%`,
      `especie.ilike.%${pesquisa}%`,
      `marca.ilike.%${pesquisa}%`,
      `modelo.ilike.%${pesquisa}%`,
      `proprietario_re.ilike.%${pesquisa}%`,
      `proprietario_nome.ilike.%${pesquisa}%`
    ]

    if (referenciasResponsavel.length) {
      condicoesPesquisa.push(
        `id.in.(${referenciasResponsavel.join(',')})`
      )
    }

    query = query.or(condicoesPesquisa.join(','))
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

  const armasNormalizadas = (data ?? []).map(normalizarArma)
  const armasEnriquecidas = await enriquecerArmasComResponsabilidadePatrimonial(
    armasNormalizadas
  )

  return {
    data: armasEnriquecidas,
    total: count ?? 0
  }
}


export async function buscarArmaPorId(id) {
  if (!id) return null

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  if (!data) return null

  const [armaEnriquecida] = await enriquecerArmasComResponsabilidadePatrimonial([
    normalizarArma(data)
  ])

  return armaEnriquecida || null
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
  const statusNormalizado =
    normalizarStatus(
      payload.status_operacional ||
        payload.status
    )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
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