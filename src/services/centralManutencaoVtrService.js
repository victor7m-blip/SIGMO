import { supabase } from './supabaseClient'

export const STATUS_MANUTENCAO_VTR = ['AGUARDANDO_PROVIDENCIA','AGUARDANDO_ENCAMINHAMENTO','ENCAMINHADA','EM_MANUTENCAO','AGUARDANDO_RETORNO','CONCLUIDA','CANCELADA']
export const TIPOS_MANUTENCAO_VTR = ['INTERNA', 'EXTERNA']
export const formatarStatusManutencaoVtr = (v='') => String(v).replaceAll('_',' ').toLowerCase().replace(/^./, c => c.toUpperCase())

export async function listarCentralManutencaoVtr() {
  const { data, error } = await supabase.from('sigmo_viaturas_central_manutencao').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export async function encaminharNovidadeManutencaoVtr(p) {
  const { data, error } = await supabase.rpc('sigmo_encaminhar_novidade_manutencao_vtr', {
    p_ocorrencia_id:p.ocorrenciaId, p_tipo_manutencao:p.tipo, p_local:p.local||null, p_oficina:p.oficina||null,
    p_os:p.os||null, p_providencia:p.providencia||null, p_usuario_id:p.usuarioId||null, p_usuario_nome:p.usuarioNome||null
  }); if(error) throw error; return data
}
export async function atualizarStatusManutencaoVtr(p) {
  const { data, error } = await supabase.rpc('sigmo_atualizar_status_manutencao_vtr', {p_ocorrencia_id:p.ocorrenciaId,p_status:p.status,p_observacao:p.observacao||null,p_usuario_id:p.usuarioId||null,p_usuario_nome:p.usuarioNome||null}); if(error) throw error; return data
}
export async function marcarNovidadeApuracaoVtr(p) {
  const { data, error } = await supabase.rpc('sigmo_marcar_novidade_apuracao_vtr', {p_ocorrencia_id:p.ocorrenciaId,p_documento:p.documento||null,p_observacoes:p.observacoes||null,p_usuario_id:p.usuarioId||null,p_usuario_nome:p.usuarioNome||null}); if(error) throw error; return data
}


export async function salvarTriagemNovidadeVtr(p) {
  const { data, error } = await supabase.rpc('sigmo_salvar_triagem_novidade_vtr', {
    p_ocorrencia_id: p.ocorrenciaId,
    p_disponibilidade_vtr: p.disponibilidadeVtr,
    p_responsabilidade_status: p.responsabilidadeStatus,
    p_providencia: p.providencia,
    p_observacao_condicao: p.observacaoCondicao || null,
    p_usuario_id: p.usuarioId || null,
    p_usuario_nome: p.usuarioNome || null
  })

  if (error) throw error
  return data
}
