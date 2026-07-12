import { supabase } from './supabaseClient'
import {
  obterNomeUsuario,
  registrarEventoPatrimonial,
  TIPOS_EVENTO_PATRIMONIAL
} from './eventoPatrimonialService'

// =====================================================
// SIGMO — MOTOR DE MOVIMENTAÇÃO
// Service principal
// =====================================================

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
}

function obterTipoEventoMovimentacao(
  tipoMovimentacao
) {
  const tipo =
    normalizarTexto(tipoMovimentacao)

  const tiposCautela = [
    'CAUTELA',
    'CAUTELAR',
    'ACAUTELAMENTO'
  ]

  const tiposDevolucao = [
    'DEVOLUÇÃO',
    'DEVOLUCAO',
    'RETORNO'
  ]

  const tiposTransferencia = [
    'TRANSFERÊNCIA',
    'TRANSFERENCIA',
    'REMANEJAMENTO'
  ]

  const tiposBaixa = [
    'BAIXA',
    'BAIXA PATRIMONIAL'
  ]

  if (tiposCautela.includes(tipo)) {
    return TIPOS_EVENTO_PATRIMONIAL.CAUTELA
  }

  if (tiposDevolucao.includes(tipo)) {
    return TIPOS_EVENTO_PATRIMONIAL.DEVOLUCAO
  }

  if (tiposTransferencia.includes(tipo)) {
    return TIPOS_EVENTO_PATRIMONIAL.TRANSFERENCIA
  }

  if (tiposBaixa.includes(tipo)) {
    return TIPOS_EVENTO_PATRIMONIAL.BAIXA
  }

  return TIPOS_EVENTO_PATRIMONIAL.MOVIMENTACAO
}

function criarDescricaoMovimentacao({
  movimentacao,
  usuario,
  acao = 'registrou uma movimentação'
}) {
  const nomeUsuario =
    obterNomeUsuario(usuario)

  const tipo =
    movimentacao?.tipo_movimentacao ||
    'MOVIMENTAÇÃO'

  const origem =
    movimentacao?.origem_local ||
    '-'

  const destino =
    movimentacao?.destino_local ||
    '-'

  return (
    `${nomeUsuario} ${acao}: ` +
    `${tipo}. ${origem} → ${destino}.`
  )
}

async function listarItensMovimentacao(
  movimentacaoId
) {
  if (!movimentacaoId) {
    return []
  }

  const { data, error } = await supabase
    .from('sigmo_movimentacao_itens')
    .select('*')
    .eq(
      'movimentacao_id',
      movimentacaoId
    )

  if (error) {
    throw error
  }

  return data || []
}

async function registrarEventoNosItens({
  movimentacao,
  usuario = null,
  tipoEvento = null,
  descricao = null,
  acao = 'registrou uma movimentação',
  metadata = null
}) {
  if (!movimentacao?.id) {
    return []
  }

  const itens =
    Array.isArray(movimentacao.itens)
      ? movimentacao.itens
      : await listarItensMovimentacao(
          movimentacao.id
        )

  if (itens.length === 0) {
    return []
  }

  const evento =
    tipoEvento ||
    obterTipoEventoMovimentacao(
      movimentacao.tipo_movimentacao
    )

  const descricaoEvento =
    descricao ||
    criarDescricaoMovimentacao({
      movimentacao,
      usuario,
      acao
    })

  const resultados = []

  for (const item of itens) {
    if (!item?.patrimonio_id) {
      continue
    }

    const resultado =
      await registrarEventoPatrimonial({
        tipo: evento,
        patrimonioId:
          item.patrimonio_id,
        usuario,
        descricao:
          descricaoEvento,
        movimentacaoId:
          movimentacao.id,
        metadata: {
          movimentacaoId:
            movimentacao.id,
          itemId:
            item.id || null,
          tipoMovimentacao:
            movimentacao
              .tipo_movimentacao ||
            null,
          origemLocal:
            movimentacao
              .origem_local ||
            null,
          destinoLocal:
            movimentacao
              .destino_local ||
            null,
          quantidade:
            item.quantidade || 1,
          ...metadata
        }
      })

    resultados.push(resultado)
  }

  return resultados
}

export async function criarMovimentacao({
  tipo_movimentacao,
  origem_local,
  destino_local,
  solicitante,
  recebedor,
  observacoes = ''
}) {
  const { data, error } = await supabase.rpc(
    'sigmo_criar_movimentacao',
    {
      p_tipo_movimentacao:
        tipo_movimentacao,
      p_origem_local:
        origem_local,
      p_destino_local:
        destino_local,
      p_solicitante_id:
        solicitante?.id || null,
      p_solicitante_nome:
        obterNomeUsuario(solicitante),
      p_solicitante_perfil:
        solicitante?.perfil || '',
      p_recebedor_id:
        recebedor?.id || null,
      p_recebedor_nome:
        obterNomeUsuario(recebedor),
      p_observacoes:
        observacoes
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function adicionarItemMovimentacao({
  movimentacao_id,
  patrimonio_id,
  quantidade = 1,
  observacao = '',
  usuario = null
}) {
  const { data, error } = await supabase.rpc(
    'sigmo_adicionar_item_movimentacao',
    {
      p_movimentacao_id:
        movimentacao_id,
      p_patrimonio_id:
        patrimonio_id,
      p_quantidade:
        quantidade,
      p_observacao:
        observacao
    }
  )

  if (error) {
    throw error
  }

  try {
    const movimentacao =
      await buscarMovimentacaoPorId(
        movimentacao_id
      )

    const usuarioEvento =
      usuario ||
      {
        id:
          movimentacao
            ?.solicitante_id ||
          null,
        nome:
          movimentacao
            ?.solicitante_nome ||
          null,
        perfil:
          movimentacao
            ?.solicitante_perfil ||
          null
      }

    await registrarEventoPatrimonial({
      tipo:
        obterTipoEventoMovimentacao(
          movimentacao
            ?.tipo_movimentacao
        ),
      patrimonioId:
        patrimonio_id,
      usuario:
        usuarioEvento,
      descricao:
        criarDescricaoMovimentacao({
          movimentacao,
          usuario:
            usuarioEvento,
          acao:
            'incluiu o patrimônio na movimentação'
        }),
      movimentacaoId:
        movimentacao_id,
      metadata: {
        movimentacaoId:
          movimentacao_id,
        quantidade,
        observacao,
        tipoMovimentacao:
          movimentacao
            ?.tipo_movimentacao ||
          null,
        origemLocal:
          movimentacao
            ?.origem_local ||
          null,
        destinoLocal:
          movimentacao
            ?.destino_local ||
          null
      }
    })
  } catch (eventoError) {
    console.warn(
      'Item adicionado, mas o evento patrimonial não foi registrado:',
      eventoError
    )
  }

  return data
}

export async function listarPatrimoniosDisponiveis(
  filtros = {}
) {
  let query = supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('ativo', true)
    .order('descricao', {
      ascending: true
    })

  if (filtros.tipo) {
    query = query.eq(
      'tipo',
      filtros.tipo
    )
  }

  if (filtros.local_atual) {
    query = query.eq(
      'local_atual',
      filtros.local_atual
    )
  }

  if (filtros.status) {
    query = query.eq(
      'status',
      filtros.status
    )
  }

  if (filtros.busca) {
    query = query.or(
      `descricao.ilike.%${filtros.busca}%,` +
      `numero_patrimonio.ilike.%${filtros.busca}%,` +
      `numero_serie.ilike.%${filtros.busca}%`
    )
  }

  const { data, error } =
    await query

  if (error) {
    throw error
  }

  return data || []
}

export async function listarMovimentacoes(
  filtros = {}
) {
  let query = supabase
    .from('sigmo_movimentacoes')
    .select(`
      *,
      itens:sigmo_movimentacao_itens(*),
      aprovacoes:sigmo_movimentacao_aprovacoes(*),
      recebimentos:sigmo_movimentacao_recebimentos(*)
    `)
    .order('created_at', {
      ascending: false
    })

  if (filtros.status) {
    query = query.eq(
      'status',
      filtros.status
    )
  }

  if (filtros.tipo_movimentacao) {
    query = query.eq(
      'tipo_movimentacao',
      filtros.tipo_movimentacao
    )
  }

  if (filtros.solicitante_id) {
    query = query.eq(
      'solicitante_id',
      filtros.solicitante_id
    )
  }

  if (filtros.recebedor_id) {
    query = query.eq(
      'recebedor_id',
      filtros.recebedor_id
    )
  }

  const { data, error } =
    await query

  if (error) {
    throw error
  }

  return data || []
}

export async function buscarMovimentacaoPorId(
  id
) {
  const { data, error } = await supabase
    .from('sigmo_movimentacoes')
    .select(`
      *,
      itens:sigmo_movimentacao_itens(*),
      aprovacoes:sigmo_movimentacao_aprovacoes(*),
      recebimentos:sigmo_movimentacao_recebimentos(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function aprovarMovimentacao({
  movimentacao_id,
  aprovador,
  observacao = ''
}) {
  const { error } = await supabase.rpc(
    'sigmo_aprovar_movimentacao',
    {
      p_movimentacao_id:
        movimentacao_id,
      p_aprovador_id:
        aprovador?.id || null,
      p_aprovador_nome:
        obterNomeUsuario(aprovador),
      p_perfil_aprovador:
        aprovador?.perfil || '',
      p_observacao:
        observacao
    }
  )

  if (error) {
    throw error
  }

  try {
    const movimentacao =
      await buscarMovimentacaoPorId(
        movimentacao_id
      )

    await registrarEventoNosItens({
      movimentacao,
      usuario:
        aprovador,
      acao:
        'aprovou a movimentação',
      metadata: {
        etapa:
          'APROVAÇÃO',
        observacao
      }
    })
  } catch (eventoError) {
    console.warn(
      'Movimentação aprovada, mas o evento patrimonial não foi registrado:',
      eventoError
    )
  }

  return true
}

export async function recusarMovimentacao({
  movimentacao_id,
  aprovador,
  observacao = ''
}) {
  const { error } = await supabase.rpc(
    'sigmo_recusar_movimentacao',
    {
      p_movimentacao_id:
        movimentacao_id,
      p_aprovador_id:
        aprovador?.id || null,
      p_aprovador_nome:
        obterNomeUsuario(aprovador),
      p_perfil_aprovador:
        aprovador?.perfil || '',
      p_observacao:
        observacao
    }
  )

  if (error) {
    throw error
  }

  try {
    const movimentacao =
      await buscarMovimentacaoPorId(
        movimentacao_id
      )

    await registrarEventoNosItens({
      movimentacao,
      usuario:
        aprovador,
      tipoEvento:
        TIPOS_EVENTO_PATRIMONIAL
          .MOVIMENTACAO,
      acao:
        'recusou a movimentação',
      metadata: {
        etapa:
          'RECUSA',
        observacao
      }
    })
  } catch (eventoError) {
    console.warn(
      'Movimentação recusada, mas o evento patrimonial não foi registrado:',
      eventoError
    )
  }

  return true
}

export async function confirmarRecebimentoMovimentacao({
  movimentacao_id,
  recebedor,
  observacao = ''
}) {
  const { error } = await supabase.rpc(
    'sigmo_confirmar_recebimento_movimentacao',
    {
      p_movimentacao_id:
        movimentacao_id,
      p_recebedor_id:
        recebedor?.id || null,
      p_recebedor_nome:
        obterNomeUsuario(recebedor),
      p_observacao:
        observacao
    }
  )

  if (error) {
    throw error
  }

  try {
    const movimentacao =
      await buscarMovimentacaoPorId(
        movimentacao_id
      )

    await registrarEventoNosItens({
      movimentacao,
      usuario:
        recebedor,
      acao:
        'confirmou o recebimento da movimentação',
      metadata: {
        etapa:
          'RECEBIMENTO',
        observacao
      }
    })
  } catch (eventoError) {
    console.warn(
      'Recebimento confirmado, mas o evento patrimonial não foi registrado:',
      eventoError
    )
  }

  return true
}

export async function solicitarAlteracaoMovimentacao({
  movimentacao_id,
  recebedor,
  observacao = ''
}) {
  const { error } = await supabase.rpc(
    'sigmo_solicitar_alteracao_movimentacao',
    {
      p_movimentacao_id:
        movimentacao_id,
      p_recebedor_id:
        recebedor?.id || null,
      p_recebedor_nome:
        obterNomeUsuario(recebedor),
      p_observacao:
        observacao
    }
  )

  if (error) {
    throw error
  }

  try {
    const movimentacao =
      await buscarMovimentacaoPorId(
        movimentacao_id
      )

    await registrarEventoNosItens({
      movimentacao,
      usuario:
        recebedor,
      tipoEvento:
        TIPOS_EVENTO_PATRIMONIAL
          .MOVIMENTACAO,
      acao:
        'solicitou alteração na movimentação',
      metadata: {
        etapa:
          'SOLICITAÇÃO DE ALTERAÇÃO',
        observacao
      }
    })
  } catch (eventoError) {
    console.warn(
      'Alteração solicitada, mas o evento patrimonial não foi registrado:',
      eventoError
    )
  }

  return true
}

export async function cancelarMovimentacao({
  movimentacao_id,
  usuario,
  observacao = ''
}) {
  const { error } = await supabase.rpc(
    'sigmo_cancelar_movimentacao',
    {
      p_movimentacao_id:
        movimentacao_id,
      p_usuario_id:
        usuario?.id || null,
      p_usuario_nome:
        obterNomeUsuario(usuario),
      p_observacao:
        observacao
    }
  )

  if (error) {
    throw error
  }

  try {
    const movimentacao =
      await buscarMovimentacaoPorId(
        movimentacao_id
      )

    await registrarEventoNosItens({
      movimentacao,
      usuario,
      tipoEvento:
        TIPOS_EVENTO_PATRIMONIAL
          .MOVIMENTACAO,
      acao:
        'cancelou a movimentação',
      metadata: {
        etapa:
          'CANCELAMENTO',
        observacao
      }
    })
  } catch (eventoError) {
    console.warn(
      'Movimentação cancelada, mas o evento patrimonial não foi registrado:',
      eventoError
    )
  }

  return true
}

export async function listarHistoricoPatrimonio(
  patrimonio_id
) {
  if (!patrimonio_id) {
    return []
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonio_historico')
    .select('*')
    .eq(
      'patrimonio_id',
      patrimonio_id
    )
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw error
  }

  return data || []
}

export async function listarMinhaCautela(
  usuario_id
) {
  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('ativo', true)
    .eq(
      'responsavel_atual_id',
      usuario_id
    )
    .order('descricao', {
      ascending: true
    })

  if (error) {
    throw error
  }

  return data || []
}