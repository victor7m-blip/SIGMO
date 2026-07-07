import { supabase } from './supabaseClient'

// =====================================================
// SIGMO — MOTOR DE MOVIMENTAÇÃO
// Service principal
// =====================================================

export async function criarMovimentacao({
  tipo_movimentacao,
  origem_local,
  destino_local,
  solicitante,
  recebedor,
  observacoes = ''
}) {
  const { data, error } = await supabase.rpc('sigmo_criar_movimentacao', {
    p_tipo_movimentacao: tipo_movimentacao,
    p_origem_local: origem_local,
    p_destino_local: destino_local,
    p_solicitante_id: solicitante?.id || null,
    p_solicitante_nome: solicitante?.nome || solicitante?.nome_completo || '',
    p_solicitante_perfil: solicitante?.perfil || '',
    p_recebedor_id: recebedor?.id || null,
    p_recebedor_nome: recebedor?.nome || recebedor?.nome_completo || '',
    p_observacoes: observacoes
  })

  if (error) throw error
  return data
}

export async function adicionarItemMovimentacao({
  movimentacao_id,
  patrimonio_id,
  quantidade = 1,
  observacao = ''
}) {
  const { data, error } = await supabase.rpc('sigmo_adicionar_item_movimentacao', {
    p_movimentacao_id: movimentacao_id,
    p_patrimonio_id: patrimonio_id,
    p_quantidade: quantidade,
    p_observacao: observacao
  })

  if (error) throw error
  return data
}

export async function listarPatrimoniosDisponiveis(filtros = {}) {
  let query = supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('ativo', true)
    .order('descricao', { ascending: true })

  if (filtros.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  if (filtros.local_atual) {
    query = query.eq('local_atual', filtros.local_atual)
  }

  if (filtros.status) {
    query = query.eq('status', filtros.status)
  }

  if (filtros.busca) {
    query = query.or(
      `descricao.ilike.%${filtros.busca}%,numero_patrimonio.ilike.%${filtros.busca}%,numero_serie.ilike.%${filtros.busca}%`
    )
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function listarMovimentacoes(filtros = {}) {
  let query = supabase
    .from('sigmo_movimentacoes')
    .select(`
      *,
      itens:sigmo_movimentacao_itens(*),
      aprovacoes:sigmo_movimentacao_aprovacoes(*),
      recebimentos:sigmo_movimentacao_recebimentos(*)
    `)
    .order('created_at', { ascending: false })

  if (filtros.status) {
    query = query.eq('status', filtros.status)
  }

  if (filtros.tipo_movimentacao) {
    query = query.eq('tipo_movimentacao', filtros.tipo_movimentacao)
  }

  if (filtros.solicitante_id) {
    query = query.eq('solicitante_id', filtros.solicitante_id)
  }

  if (filtros.recebedor_id) {
    query = query.eq('recebedor_id', filtros.recebedor_id)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function buscarMovimentacaoPorId(id) {
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

  if (error) throw error
  return data
}

export async function aprovarMovimentacao({
  movimentacao_id,
  aprovador,
  observacao = ''
}) {
  const { error } = await supabase.rpc('sigmo_aprovar_movimentacao', {
    p_movimentacao_id: movimentacao_id,
    p_aprovador_id: aprovador?.id || null,
    p_aprovador_nome: aprovador?.nome || aprovador?.nome_completo || '',
    p_perfil_aprovador: aprovador?.perfil || '',
    p_observacao: observacao
  })

  if (error) throw error
}

export async function recusarMovimentacao({
  movimentacao_id,
  aprovador,
  observacao = ''
}) {
  const { error } = await supabase.rpc('sigmo_recusar_movimentacao', {
    p_movimentacao_id: movimentacao_id,
    p_aprovador_id: aprovador?.id || null,
    p_aprovador_nome: aprovador?.nome || aprovador?.nome_completo || '',
    p_perfil_aprovador: aprovador?.perfil || '',
    p_observacao: observacao
  })

  if (error) throw error
}

export async function confirmarRecebimentoMovimentacao({
  movimentacao_id,
  recebedor,
  observacao = ''
}) {
  const { error } = await supabase.rpc('sigmo_confirmar_recebimento_movimentacao', {
    p_movimentacao_id: movimentacao_id,
    p_recebedor_id: recebedor?.id || null,
    p_recebedor_nome: recebedor?.nome || recebedor?.nome_completo || '',
    p_observacao: observacao
  })

  if (error) throw error
}

export async function solicitarAlteracaoMovimentacao({
  movimentacao_id,
  recebedor,
  observacao = ''
}) {
  const { error } = await supabase.rpc('sigmo_solicitar_alteracao_movimentacao', {
    p_movimentacao_id: movimentacao_id,
    p_recebedor_id: recebedor?.id || null,
    p_recebedor_nome: recebedor?.nome || recebedor?.nome_completo || '',
    p_observacao: observacao
  })

  if (error) throw error
}

export async function cancelarMovimentacao({
  movimentacao_id,
  usuario,
  observacao = ''
}) {
  const { error } = await supabase.rpc('sigmo_cancelar_movimentacao', {
    p_movimentacao_id: movimentacao_id,
    p_usuario_id: usuario?.id || null,
    p_usuario_nome: usuario?.nome || usuario?.nome_completo || '',
    p_observacao: observacao
  })

  if (error) throw error
}

export async function listarHistoricoPatrimonio(patrimonio_id) {
  const { data, error } = await supabase
    .from('sigmo_patrimonio_historico')
    .select('*')
    .eq('patrimonio_id', patrimonio_id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listarMinhaCautela(usuario_id) {
  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('ativo', true)
    .eq('responsavel_atual_id', usuario_id)
    .order('descricao', { ascending: true })

  if (error) throw error
  return data || []
}