import { supabase } from './supabaseClient'

const CODIGOS_TONFAS = [
  'TONFA-PADRAO',
  'CASSETETE-PADRAO'
]

function numero(valor) {
  const resultado = Number(valor)
  return Number.isFinite(resultado) ? resultado : 0
}

export async function buscarHistoricoPatrimonial({
  codigos = CODIGOS_TONFAS
} = {}) {
  const codigosValidos = (codigos || [])
    .map((codigo) => String(codigo || '').trim().toUpperCase())
    .filter(Boolean)

  if (!codigosValidos.length) {
    return {
      itens: [],
      lotes: [],
      movimentacoes: [],
      saldos: [],
      saldoTotal: 0
    }
  }

  const { data: itens, error: itensError } = await supabase
    .from('sigmo_patrimonio_itens')
    .select('id, categoria, codigo, nome, descricao, unidade_medida, ativo')
    .in('codigo', codigosValidos)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (itensError) throw itensError

  const itemIds = (itens || []).map((item) => item.id)

  if (!itemIds.length) {
    return {
      itens: [],
      lotes: [],
      movimentacoes: [],
      saldos: [],
      saldoTotal: 0
    }
  }

  const [lotesResult, movimentacoesResult, saldosResult] = await Promise.all([
    supabase
      .from('sigmo_patrimonio_lotes')
      .select('*')
      .in('item_id', itemIds)
      .order('criado_em', { ascending: false }),

    supabase
      .from('sigmo_patrimonio_movimentacoes')
      .select('*')
      .in('item_id', itemIds)
      .order('criado_em', { ascending: false }),

    supabase
      .from('sigmo_patrimonio_saldos')
      .select('*')
      .in('item_id', itemIds)
      .eq('ativo', true)
      .order('atualizado_em', { ascending: false })
  ])

  if (lotesResult.error) throw lotesResult.error
  if (movimentacoesResult.error) throw movimentacoesResult.error
  if (saldosResult.error) throw saldosResult.error

  const mapaItens = new Map(
    (itens || []).map((item) => [item.id, item])
  )

  const lotes = (lotesResult.data || []).map((lote) => ({
    ...lote,
    item: mapaItens.get(lote.item_id) || null
  }))

  const movimentacoes = (movimentacoesResult.data || []).map(
    (movimentacao) => ({
      ...movimentacao,
      item: mapaItens.get(movimentacao.item_id) || null
    })
  )

  const saldos = (saldosResult.data || []).map((saldo) => ({
    ...saldo,
    item: mapaItens.get(saldo.item_id) || null
  }))

  return {
    itens: itens || [],
    lotes,
    movimentacoes,
    saldos,
    saldoTotal: saldos.reduce(
      (total, saldo) => total + numero(saldo.quantidade),
      0
    )
  }
}
