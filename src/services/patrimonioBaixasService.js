import { supabase } from './supabaseClient'
import { criarOuAtualizarPatrimonio, desativarPatrimonioPorReferencia } from './patrimoniosService'
import { criarNotificacaoParaPerfil } from './notificacoesService'

const TABLE = 'sigmo_patrimonio_baixas'
const FOTOS_TABLE = 'sigmo_patrimonio_baixas_fotos'
const BUCKET = 'patrimonio-baixas'

function texto(valor) { return String(valor ?? '').trim() }
function maiusculo(valor) { return texto(valor).toUpperCase() }
function usuarioId(user) { return user?.id || user?.user_id || user?.usuario_id || null }
function usuarioNome(user) {
  return user?.nome_guerra || user?.nome || user?.nome_completo || user?.user_metadata?.nome || user?.email || 'USUÁRIO SIGMO'
}
function perfil(user) { return maiusculo(user?.perfil || user?.role || user?.tipo_usuario || user?.user_metadata?.perfil) }
function ehP4(user) { return ['P4', 'SECAO P4', 'SEÇÃO P4', 'GESTOR PATRIMONIAL'].includes(perfil(user)) }
function ehComandante(user) { return ['ADMINISTRADOR', 'COMANDANTE', 'COMANDANTE DE CIA', 'COMANDANTE DA CIA'].includes(perfil(user)) }

function extensao(arquivo) {
  const nome = texto(arquivo?.name).toLowerCase()
  const ext = nome.includes('.') ? nome.split('.').pop() : ''
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg'
}

async function uploadFoto({ modulo, referenciaId, arquivo }) {
  if (!arquivo?.type?.startsWith('image/')) throw new Error('Selecione apenas arquivos de imagem.')
  if (Number(arquivo.size || 0) > 5 * 1024 * 1024) throw new Error('Cada foto deve possuir no máximo 5 MB.')
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const caminho = `${maiusculo(modulo).toLowerCase()}/${texto(referenciaId)}/${id}.${extensao(arquivo)}`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { upsert: false, contentType: arquivo.type })
  if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  return { foto_url: data?.publicUrl || null, foto_caminho: caminho }
}

export async function listarSolicitacoesBaixa({ modulo = 'HT', referenciaId = null, status = null } = {}) {
  let query = supabase.from(TABLE).select('*, fotos:sigmo_patrimonio_baixas_fotos(*)').eq('modulo', maiusculo(modulo)).order('solicitada_em', { ascending: false })
  if (referenciaId) query = query.eq('referencia_id', referenciaId)
  if (status) query = query.eq('status', maiusculo(status))
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function solicitarBaixaHT({ ht, motivo, observacoes, fotos = [], user }) {
  if (!ehP4(user)) throw new Error('Somente o P4 pode solicitar a baixa patrimonial.')
  if (!ht?.id) throw new Error('HT não informado.')
  if (!texto(motivo)) throw new Error('Informe o motivo da baixa.')
  if (!texto(observacoes)) throw new Error('Informe as observações da solicitação.')
  if (!Array.isArray(fotos) || fotos.length === 0) throw new Error('Inclua pelo menos uma foto da solicitação de baixa.')

  const statusAtual = maiusculo(ht.status_operacional || ht.status)
  if (['BAIXADO', 'AGUARDANDO_APROVACAO_BAIXA'].includes(statusAtual)) throw new Error('Este HT já possui baixa concluída ou aguardando aprovação.')

  const { data: solicitacao, error } = await supabase.from(TABLE).insert({
    modulo: 'HT', referencia_id: ht.id, patrimonio: ht.patrimonio || null, numero_serie: ht.numero_serie || null,
    status: 'AGUARDANDO_APROVACAO', motivo: texto(motivo), observacoes: texto(observacoes),
    status_anterior: statusAtual || 'RESERVA', local_anterior: ht.local_atual || null,
    solicitada_por_id: usuarioId(user), solicitada_por_nome: usuarioNome(user)
  }).select().single()
  if (error) throw error

  const enviados = []
  try {
    for (let i = 0; i < fotos.length; i += 1) {
      const foto = await uploadFoto({ modulo: 'HT', referenciaId: ht.id, arquivo: fotos[i] })
      enviados.push(foto.foto_caminho)
      const { error: fotoError } = await supabase.from(FOTOS_TABLE).insert({
        baixa_id: solicitacao.id, foto_url: foto.foto_url, foto_caminho: foto.foto_caminho,
        legenda: `Evidência da solicitação ${i + 1}`, ordem: i, criada_por_id: usuarioId(user), criada_por_nome: usuarioNome(user)
      })
      if (fotoError) throw fotoError
    }

    const { error: htError } = await supabase.from('sigmo_hts').update({ status_operacional: 'AGUARDANDO_APROVACAO_BAIXA' }).eq('id', ht.id)
    if (htError) throw htError

    await criarOuAtualizarPatrimonio({ tipo: 'ht', referencia_id: ht.id, dados: { ...ht, status_operacional: 'AGUARDANDO_APROVACAO_BAIXA' }, user, local_atual: ht.local_atual || '' })
    await criarNotificacaoParaPerfil({ perfil: 'COMANDANTE DE CIA', titulo: 'Solicitação de baixa de HT', mensagem: `${usuarioNome(user)} solicitou a baixa do HT ${ht.patrimonio || ht.numero_serie || ''}.`, tipo: 'APROVACAO', modulo: 'HT', prioridade: 'ALTA', link: 'ht', metadata: { modulo: 'HT', referencia_id: ht.id, baixa_id: solicitacao.id } })
    return solicitacao
  } catch (erro) {
    if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados)
    await supabase.from(TABLE).delete().eq('id', solicitacao.id)
    throw erro
  }
}

export async function decidirBaixaHT({ solicitacao, decisao, observacoes = '', user }) {
  if (!ehComandante(user)) throw new Error('Somente o Comandante da Cia pode decidir a solicitação de baixa.')
  const acao = maiusculo(decisao)
  if (!['APROVAR', 'REPROVAR', 'DILIGENCIA'].includes(acao)) throw new Error('Decisão inválida.')
  if (acao !== 'APROVAR' && !texto(observacoes)) throw new Error('Informe a justificativa da decisão.')

  const novoStatus = acao === 'APROVAR' ? 'APROVADA' : acao === 'REPROVAR' ? 'REPROVADA' : 'DILIGENCIA'
  const { data, error } = await supabase.from(TABLE).update({
    status: novoStatus, decisao_observacoes: texto(observacoes) || null,
    decidida_em: new Date().toISOString(), decidida_por_id: usuarioId(user), decidida_por_nome: usuarioNome(user)
  }).eq('id', solicitacao.id).eq('status', 'AGUARDANDO_APROVACAO').select().single()
  if (error) throw error

  const statusHT = acao === 'APROVAR' ? 'BAIXADO' : (solicitacao.status_anterior || 'RESERVA')
  const ativo = acao !== 'APROVAR'
  const { data: ht, error: htError } = await supabase.from('sigmo_hts').update({ status_operacional: statusHT, ativo }).eq('id', solicitacao.referencia_id).select().single()
  if (htError) throw htError

  if (acao === 'APROVAR') {
    await desativarPatrimonioPorReferencia({ tipo: 'ht', referencia_id: solicitacao.referencia_id, user, motivo: solicitacao.motivo })
  } else {
    await criarOuAtualizarPatrimonio({ tipo: 'ht', referencia_id: solicitacao.referencia_id, dados: { ...ht, status_operacional: statusHT, ativo }, user, local_atual: solicitacao.local_anterior || ht.local_atual || '' })
  }
  await criarNotificacaoParaPerfil({ perfil: 'P4', titulo: acao === 'APROVAR' ? 'Baixa de HT aprovada' : 'Solicitação de baixa atualizada', mensagem: `A solicitação do HT ${solicitacao.patrimonio || solicitacao.numero_serie || ''} foi marcada como ${novoStatus}.`, tipo: acao === 'APROVAR' ? 'SUCESSO' : 'ALERTA', modulo: 'HT', prioridade: 'NORMAL', link: 'ht', metadata: { modulo: 'HT', referencia_id: solicitacao.referencia_id, baixa_id: solicitacao.id } })
  return data
}
