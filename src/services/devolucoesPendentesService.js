import { supabase } from './supabaseClient'

const STATUS_PENDENTES = [
  'aguardando_recebimento',
  'alteracao_solicitada',
  'em_andamento'
]

export async function buscarDevolucaoPendentePolicial({
  policialId
} = {}) {
  if (!policialId) {
    return null
  }

  const {
    data: movimentacoes,
    error: movimentacoesError
  } = await supabase
    .from('sigmo_movimentacoes')
    .select('*')
    .eq('tipo_movimentacao', 'DEVOLUCAO')
    .eq('solicitante_id', policialId)
    .in('status', STATUS_PENDENTES)
    .order('created_at', { ascending: false })
    .limit(1)

  if (movimentacoesError) {
    throw movimentacoesError
  }

  const movimentacao = movimentacoes?.[0]

  if (!movimentacao?.id) {
    return null
  }

  const {
    data: itens,
    error: itensError
  } = await supabase
    .from('sigmo_movimentacao_itens')
    .select('*')
    .eq('movimentacao_id', movimentacao.id)
    .order('created_at', { ascending: true })

  if (itensError) {
    throw itensError
  }

  const patrimonioIds = [
    ...new Set(
      (itens || [])
        .map((item) => item?.patrimonio_id)
        .filter(Boolean)
    )
  ]

  let patrimoniosPorId = new Map()

  if (patrimonioIds.length > 0) {
    const {
      data: patrimonios,
      error: patrimoniosError
    } = await supabase
      .from('sigmo_patrimonios')
      .select('*')
      .in('id', patrimonioIds)

    if (patrimoniosError) {
      throw patrimoniosError
    }

    patrimoniosPorId = new Map(
      (patrimonios || []).map((patrimonio) => [
        String(patrimonio.id),
        patrimonio
      ])
    )
  }

  return {
    ...movimentacao,
    itens: (itens || [])
      .filter((item) =>
        String(item?.status_item || '')
          .trim()
          .toLowerCase() !== 'recebido'
      )
      .map((item) => ({
        ...item,
        patrimonio: patrimoniosPorId.get(
          String(item.patrimonio_id)
        ) || null
      }))
  }
}

export async function confirmarItensDevolucao({
  movimentacaoId,
  itemIds = [],
  user = null,
  observacao = ''
}) {
  const ids = [...new Set(
    (Array.isArray(itemIds) ? itemIds : [])
      .filter(Boolean)
      .map(String)
  )]

  if (!movimentacaoId) {
    throw new Error('Movimentação de devolução não informada.')
  }

  if (ids.length === 0) {
    throw new Error('Nenhum item da devolução foi informado.')
  }

  const { data, error } = await supabase.rpc(
    'sigmo_confirmar_itens_devolucao',
    {
      p_movimentacao_id: movimentacaoId,
      p_item_ids: ids,
      p_recebedor_id: user?.id || null,
      p_recebedor_nome:
        user?.nome_guerra ||
        user?.nome ||
        user?.nome_completo ||
        user?.email ||
        'USUÁRIO SIGMO',
      p_observacao: observacao || null
    }
  )

  if (error) {
    throw error
  }

  return data
}
