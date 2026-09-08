import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

import {
  MODULOS_MANUTENCAO,
  registrarManutencao
} from './manutencoesService'

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

function aplicarEstadoPatrimonialCOP(
  cop,
  patrimonio = null
) {
  const copNormalizada =
    normalizarCOP(cop)

  if (!copNormalizada) {
    return null
  }

  if (!patrimonio) {
    return copNormalizada
  }

  const statusPatrimonial =
    normalizarStatus(
      patrimonio.status
    )

  const localPatrimonial =
    normalizarTexto(
      patrimonio.local_atual
    )

  let statusEfetivo =
    copNormalizada.status_operacional

  if (
    statusPatrimonial === 'CAUTELADO' ||
    statusPatrimonial === 'EM_SERVICO' ||
    normalizarMaiusculo(
      localPatrimonial
    ).includes(
      'CAUTELA'
    )
  ) {
    statusEfetivo = 'EM_SERVICO'
  } else if (
    statusPatrimonial === 'MANUTENCAO' ||
    normalizarMaiusculo(
      localPatrimonial
    ).includes(
      'MANUTEN'
    )
  ) {
    statusEfetivo = 'MANUTENCAO'
  } else if (
    statusPatrimonial === 'BAIXADA'
  ) {
    statusEfetivo = 'BAIXADA'
  } else if (
    statusPatrimonial === 'RESERVA'
  ) {
    statusEfetivo = 'RESERVA'
  }

  return {
    ...copNormalizada,

    status_operacional:
      statusEfetivo,

    local_atual:
      localPatrimonial ||
      copNormalizada.local_atual,

    ativo:
      copNormalizada.ativo !== false &&
      patrimonio.ativo !== false,

    status_patrimonial:
      patrimonio.status ||
      null,

    local_patrimonial:
      patrimonio.local_atual ||
      null
  }
}

export async function listarCOPs({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'numero',
  sortDirection = 'asc'
} = {}) {
  const [
    {
      data: copsData,
      error: copsError
    },
    {
      data: patrimoniosData,
      error: patrimoniosError
    }
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*'),

    supabase
      .from('sigmo_patrimonios')
      .select(
        'referencia_id, status, local_atual, ativo'
      )
      .eq('tipo', 'cop')
  ])

  if (copsError) {
    throw copsError
  }

  if (patrimoniosError) {
    throw patrimoniosError
  }

  const patrimonioPorReferencia =
    new Map(
      (patrimoniosData || [])
        .filter(
          (item) =>
            item?.referencia_id
        )
        .map((item) => [
          String(
            item.referencia_id
          ),
          item
        ])
    )

  let lista =
    (copsData || [])
      .map((cop) =>
        aplicarEstadoPatrimonialCOP(
          cop,
          patrimonioPorReferencia.get(
            String(cop.id)
          ) || null
        )
      )
      .filter(Boolean)

  const pesquisa =
    normalizarMaiusculo(
      limparPesquisa(
        filtros.pesquisa
      )
    )

  if (pesquisa) {
    lista = lista.filter(
      (cop) =>
        [
          cop.numero,
          cop.identificacao_equipamento,
          cop.marca,
          cop.local_atual
        ].some((valor) =>
          normalizarMaiusculo(
            valor
          ).includes(
            pesquisa
          )
        )
    )
  }

  if (
    filtros.numero?.trim()
  ) {
    const numeroFiltro =
      normalizarNumero(
        filtros.numero
      )

    lista = lista.filter(
      (cop) =>
        cop.numero ===
        numeroFiltro
    )
  }

  if (
    filtros
      .identificacao_equipamento
      ?.trim()
  ) {
    const identificacaoFiltro =
      normalizarMaiusculo(
        filtros
          .identificacao_equipamento
      )

    lista = lista.filter(
      (cop) =>
        normalizarMaiusculo(
          cop.identificacao_equipamento
        ).includes(
          identificacaoFiltro
        )
    )
  }

  if (
    filtros.marca?.trim()
  ) {
    const marcaFiltro =
      normalizarMaiusculo(
        filtros.marca
      )

    lista = lista.filter(
      (cop) =>
        normalizarMaiusculo(
          cop.marca
        ).includes(
          marcaFiltro
        )
    )
  }

  if (
    filtros.status_operacional
      ?.trim()
  ) {
    const statusFiltro =
      normalizarStatus(
        filtros.status_operacional
      )

    lista = lista.filter(
      (cop) =>
        cop.status_operacional ===
        statusFiltro
    )
  }

  if (
    filtros.local_atual?.trim()
  ) {
    const localFiltro =
      normalizarMaiusculo(
        filtros.local_atual
      )

    lista = lista.filter(
      (cop) =>
        normalizarMaiusculo(
          cop.local_atual
        ).includes(
          localFiltro
        )
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

    lista = lista.filter(
      (cop) =>
        cop.ativo === ativo
    )
  }

  const direcao =
    sortDirection === 'desc'
      ? -1
      : 1

  lista.sort((a, b) => {
    const valorA =
      a?.[sortBy]

    const valorB =
      b?.[sortBy]

    if (
      valorA === null ||
      valorA === undefined
    ) {
      return 1
    }

    if (
      valorB === null ||
      valorB === undefined
    ) {
      return -1
    }

    return (
      String(valorA)
        .localeCompare(
          String(valorB),
          'pt-BR',
          {
            numeric: true,
            sensitivity: 'base'
          }
        ) *
      direcao
    )
  })

  const total =
    lista.length

  const paginaValida =
    Math.max(
      1,
      Number(pagina) || 1
    )

  const limiteValido =
    Math.max(
      1,
      Number(limite) || 20
    )

  const inicio =
    (
      paginaValida - 1
    ) *
    limiteValido

  return {
    data:
      lista.slice(
        inicio,
        inicio +
          limiteValido
      ),

    total
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

export async function listarCOPsDisponiveisManutencao({
  pesquisa = ''
} = {}) {
  const [
    { data: copsData, error: copsError },
    {
      data: patrimoniosData,
      error: patrimoniosError
    }
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*')
      .eq('ativo', true)
      .order('numero', {
        ascending: true
      }),

    supabase
      .from('sigmo_patrimonios')
      .select(
        'referencia_id, status, local_atual, ativo'
      )
      .eq('tipo', 'cop')
  ])

  if (copsError) throw copsError
  if (patrimoniosError) {
    throw patrimoniosError
  }

  const patrimonioPorReferencia =
    new Map(
      (patrimoniosData || [])
        .filter(
          (item) => item?.referencia_id
        )
        .map((item) => [
          String(
            item.referencia_id
          ),
          item
        ])
    )

  const termo =
    normalizarMaiusculo(
      pesquisa
    )

  return (copsData || [])
    .map(normalizarCOP)
    .filter((cop) => {
      if (
        cop.ativo === false ||
        cop.status_operacional ===
          'MANUTENCAO' ||
        cop.status_operacional ===
          'BAIXADA'
      ) {
        return false
      }

      const patrimonio =
        patrimonioPorReferencia.get(
          String(cop.id)
        )

      if (!patrimonio) {
        return false
      }

      if (
        patrimonio.ativo === false
      ) {
        return false
      }

      const statusPatrimonial =
        normalizarStatus(
          patrimonio.status
        )

      const localPatrimonial =
        normalizarMaiusculo(
          patrimonio.local_atual
        )

      if (
        statusPatrimonial ===
          'CAUTELADO' ||
        statusPatrimonial ===
          'EM_SERVICO' ||
        statusPatrimonial ===
          'MANUTENCAO' ||
        statusPatrimonial ===
          'BAIXADA' ||
        localPatrimonial.includes(
          'CAUTELA'
        ) ||
        localPatrimonial.includes(
          'MANUTEN'
        )
      ) {
        return false
      }

      if (
        statusPatrimonial !==
          'RESERVA'
      ) {
        return false
      }

      return true
    })
    .filter((cop) => {
      if (!termo) {
        return true
      }

      return [
        cop.numero,
        cop.identificacao_equipamento,
        cop.marca,
        cop.local_atual
      ].some((valor) =>
        normalizarMaiusculo(
          valor
        ).includes(
          termo
        )
      )
    })
    .map((cop) => {
      const patrimonio =
        patrimonioPorReferencia.get(
          String(cop.id)
        )

      return {
        ...cop,
        status_patrimonial:
          patrimonio?.status ||
          null,
        local_patrimonial:
          patrimonio?.local_atual ||
          null
      }
    })
}

async function buscarPatrimonioCentralCOP(
  copId
) {
  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select(
      'id, status, local_atual, ativo'
    )
    .eq('tipo', 'cop')
    .eq('referencia_id', copId)
    .maybeSingle()

  if (error) throw error

  return data
}

export async function enviarCOPParaManutencao({
  copId,
  tipoNovidade = 'MANUTENÇÃO CORRETIVA',
  descricao = null,
  observacoes = null,
  foto = null,
  fotos = [],
  user = null
}) {
  if (!copId) {
    throw new Error(
      'COP não informada para manutenção.'
    )
  }

  const cop = await buscarCOPPorId(
    copId
  )

  if (
    cop.ativo === false ||
    cop.status_operacional === 'BAIXADA'
  ) {
    throw new Error(
      'Uma COP baixada ou inativa não pode ser colocada em manutenção.'
    )
  }

  if (
    cop.status_operacional ===
    'MANUTENCAO'
  ) {
    throw new Error(
      'Esta COP já está em manutenção.'
    )
  }

  if (!normalizarTexto(descricao)) {
    throw new Error(
      'Informe a descrição da novidade ou do defeito.'
    )
  }

  const patrimonio =
    await buscarPatrimonioCentralCOP(
      cop.id
    )

  const statusPatrimonial =
    normalizarStatus(
      patrimonio?.status
    )

  const localPatrimonial =
    normalizarMaiusculo(
      patrimonio?.local_atual
    )

  if (
    patrimonio?.ativo === false
  ) {
    throw new Error(
      'Esta COP está inativa no patrimônio central.'
    )
  }

  if (
    statusPatrimonial === 'CAUTELADO' ||
    statusPatrimonial === 'EM_SERVICO' ||
    localPatrimonial.includes(
      'CAUTELA INDIVIDUAL'
    )
  ) {
    throw new Error(
      'Uma COP em serviço ou cautelada não pode ser enviada para manutenção antes da devolução.'
    )
  }

  if (
    statusPatrimonial === 'MANUTENCAO' ||
    localPatrimonial.includes(
      'MANUTEN'
    )
  ) {
    throw new Error(
      'Esta COP já está em manutenção no patrimônio central.'
    )
  }

  const manutencao =
    await registrarManutencao({
      modulo:
        MODULOS_MANUTENCAO.COP,
      tipoMaterial:
        'COP',
      referenciaId:
        cop.id,
      patrimonioId:
        patrimonio?.id ||
        null,
      quantidade:
        1,
      tipoNovidade,
      descricao,
      observacoes:
        [
          normalizarTexto(
            observacoes
          ),
          `STATUS ANTERIOR: ${
            cop.status_operacional ||
            'NÃO INFORMADO'
          }`,
          `LOCAL ANTERIOR: ${
            cop.local_atual ||
            'NÃO INFORMADO'
          }`
        ]
          .filter(Boolean)
          .join(' | '),
      origem:
        cop.local_atual ||
        'SVDD',
      destino:
        'MANUTENCAO',
      foto,
      fotos,
      user
    })

  const copAtualizada =
    await buscarCOPPorId(
      cop.id
    )

  return {
    cop:
      copAtualizada,
    manutencao
  }
}

export async function obterResumoCOPs() {
  const [
    { data: copsData, error: copsError },
    {
      data: patrimoniosData,
      error: patrimoniosError
    }
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select(
        'id, status_operacional, local_atual, ativo'
      ),
    supabase
      .from('sigmo_patrimonios')
      .select(
        'referencia_id, status, local_atual, ativo'
      )
      .eq('tipo', 'cop')
  ])

  if (copsError) throw copsError
  if (patrimoniosError) {
    throw patrimoniosError
  }

  const itens = (copsData || []).map(
    normalizarCOP
  )

  const patrimonioPorReferencia =
    new Map(
      (patrimoniosData || [])
        .filter(
          (item) => item?.referencia_id
        )
        .map((item) => [
          item.referencia_id,
          item
        ])
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

    const patrimonio =
      patrimonioPorReferencia.get(
        item.id
      )

    const statusPatrimonial =
      normalizarStatus(
        patrimonio?.status
      )

    const localPatrimonial =
      normalizarMaiusculo(
        patrimonio?.local_atual
      )

    const statusCadastro =
      normalizarStatus(
        item.status_operacional
      )

    if (
      statusCadastro === 'BAIXADA' ||
      statusPatrimonial === 'BAIXADA' ||
      patrimonio?.ativo === false
    ) {
      resumo.baixadas += 1
      continue
    }

    if (
      statusCadastro === 'MANUTENCAO' ||
      statusPatrimonial ===
        'MANUTENCAO' ||
      localPatrimonial.includes(
        'MANUTEN'
      )
    ) {
      resumo.manutencao += 1
      continue
    }

    if (
      statusPatrimonial ===
        'CAUTELADO' ||
      statusPatrimonial ===
        'EM_SERVICO' ||
      localPatrimonial.includes(
        'CAUTELA INDIVIDUAL'
      )
    ) {
      resumo.emServico += 1
      continue
    }

    if (
      statusPatrimonial ===
        'RESERVA' ||
      statusCadastro === 'RESERVA'
    ) {
      resumo.reserva += 1
      continue
    }

    if (
      statusCadastro ===
        'EM_SERVICO'
    ) {
      resumo.emServico += 1
      continue
    }

    resumo.outros += 1
  }

  return resumo
}
