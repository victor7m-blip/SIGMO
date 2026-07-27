import { supabase } from './supabaseClient'

const TABLE =
  'sigmo_tonfas_movimentacoes'

export const STATUS_MOVIMENTACAO_TONFA = {
  EM_SERVICO: 'EM_SERVICO',
  DEVOLVIDA: 'DEVOLVIDA',
  CANCELADA: 'CANCELADA'
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(numero)
  )
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, '')
}

function normalizarReComparacao(valor) {
  return somenteNumeros(valor).slice(0, 6)
}

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function obterReUsuario(user) {
  return (
    user?.re ||
    user?.policial_re ||
    user?.user_metadata?.re ||
    null
  )
}

export async function registrarCautelaTonfa({
  tonfa,
  policial,
  quantidade,
  devolucaoPrevista = null,
  observacoes = null,
  user = null
}) {
  if (!tonfa?.id) {
    throw new Error(
      'A Tonfa ou o Cassetete da movimentação não foi informado.'
    )
  }

  if (!policial) {
    throw new Error(
      'O policial responsável pela cautela não foi informado.'
    )
  }

  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade da cautela deve ser maior que zero.'
    )
  }

  const policialNome =
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    null

  const payload = {
    tonfa_id:
      tonfa.id,

    tipo_material:
      maiusculo(tonfa.tipo) ||
      'TONFA',

    origem:
      'SVDD',

    destino:
      'POLICIAL',

    quantidade:
      valor,

    policial_id:
      policial?.id ||
      policial?.policial_id ||
      null,

    policial_re:
      policial?.re ||
      policial?.policial_re ||
      null,

    policial_nome:
      policialNome,

    retirado_por:
      obterNomeUsuario(user),

    devolucao_prevista:
      devolucaoPrevista ||
      null,

    status:
      STATUS_MOVIMENTACAO_TONFA.EM_SERVICO,

    observacoes:
      texto(observacoes) ||
      null
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function buscarMovimentacaoTonfaPorId(
  id
) {
  if (!id) {
    throw new Error(
      'ID da movimentação da Tonfa não informado.'
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

  if (error) {
    throw error
  }

  return data
}

export async function listarTonfasEmServico({
  re = '',
  policialId = null
} = {}) {
  const reProcurado =
    normalizarReComparacao(re)

  if (
    !reProcurado &&
    !policialId
  ) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq(
      'status',
      STATUS_MOVIMENTACAO_TONFA.EM_SERVICO
    )

  if (error) {
    throw error
  }

  return (data ?? [])
    .filter((movimentacao) => {
      const mesmoPolicialId =
        policialId &&
        String(
          movimentacao.policial_id ||
          ''
        ) ===
          String(policialId)

      const mesmoRe =
        reProcurado &&
        normalizarReComparacao(
          movimentacao.policial_re
        ) === reProcurado

      return (
        mesmoPolicialId ||
        mesmoRe
      )
    })
    .map((movimentacao) => ({
      id:
        `TONFA-MOV-${movimentacao.id}`,

      patrimonio_id:
        null,

      referencia_id:
        movimentacao.tonfa_id,

      movimentacao_tonfa_id:
        movimentacao.id,

      tonfa_id:
        movimentacao.tonfa_id,

      tipo_registro:
        'TONFA_QUANTIDADE',

      modulo:
        'TONFA_QUANTIDADE',

      tipo:
        maiusculo(
          movimentacao.tipo_material
        ) ||
        'TONFA',

      categoria:
        maiusculo(
          movimentacao.tipo_material
        ) ||
        'TONFA',

      patrimonio:
        'ESTOQUE CONTROLADO',

      identificador:
        maiusculo(
          movimentacao.tipo_material
        ) ||
        'TONFA',

      descricao:
        maiusculo(
          movimentacao.tipo_material
        ) ||
        'TONFA',

      local_origem:
        'CAUTELA INDIVIDUAL',

      local_atual:
        'CAUTELA INDIVIDUAL',

      status:
        'EM SERVIÇO',

      quantidade:
        numeroInteiro(
          movimentacao.quantidade
        ),

      policial_id:
        movimentacao.policial_id,

      policial_re:
        movimentacao.policial_re,

      policial_nome:
        movimentacao.policial_nome,

      devolucao_prevista:
        movimentacao.devolucao_prevista,

      retirado_por:
        movimentacao.retirado_por,

      criado_em:
        movimentacao.criado_em,

      movimentacao_original:
        movimentacao
    }))
}

export async function listarCautelasAtivas({
  tipoMaterial = ''
} = {}) {
  let query = supabase
    .from('sigmo_tonfas_movimentacoes')
    .select('*')
    .eq(
      'status',
      STATUS_MOVIMENTACAO_TONFA.EM_SERVICO
    )
    .order('criado_em', {
      ascending: false
    })

  const tipo =
    String(tipoMaterial || '')
      .trim()
      .toUpperCase()

  if (tipo) {
    query = query.eq(
      'tipo_material',
      tipo
    )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map(
    (movimentacao) => ({
      ...movimentacao,

      tipo_material:
        String(
          movimentacao.tipo_material ||
          'TONFA'
        )
          .trim()
          .toUpperCase(),

      quantidade:
        Number(
          movimentacao.quantidade ||
          0
        ),

      policial_nome:
        movimentacao.policial_nome ||
        'POLICIAL NÃO IDENTIFICADO',

      policial_re:
        movimentacao.policial_re ||
        'RE NÃO INFORMADO'
    })
  )
}

export async function concluirMovimentacaoTonfa(
  movimentacaoId
) {
  if (!movimentacaoId) {
    throw new Error(
      'Movimentação da Tonfa não informada.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      status:
        STATUS_MOVIMENTACAO_TONFA.DEVOLVIDA
    })
    .eq(
      'id',
      movimentacaoId
    )
    .eq(
      'status',
      STATUS_MOVIMENTACAO_TONFA.EM_SERVICO
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function reabrirMovimentacaoTonfa(
  movimentacaoId
) {
  if (!movimentacaoId) {
    return null
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      status:
        STATUS_MOVIMENTACAO_TONFA.EM_SERVICO
    })
    .eq(
      'id',
      movimentacaoId
    )
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export {
  obterNomeUsuario,
  obterReUsuario
}