import { supabase } from './supabaseClient'
import { ehComandante } from './permissionService'

const TABLE_VIATURAS = 'sigmo_viaturas'
const TABLE_KM = 'sigmo_viaturas_quilometragem'
const TABLE_MANUT = 'sigmo_viaturas_manutencoes_riv'
const TABLE_OCORRENCIAS = 'sigmo_viaturas_riv_ocorrencias'
const TABLE_HISTORICO_OCORRENCIAS = 'sigmo_viaturas_riv_ocorrencias_historico'

export const ITENS_MANUTENCAO_RIV = [
  { value: 'OLEO_MOTOR', label: 'Óleo do motor', margemKmPadrao: 1000, margemDiasPadrao: 30 },
  { value: 'FREIOS', label: 'Freios / pastilhas', margemKmPadrao: 1000, margemDiasPadrao: 30 }
]

function normalizar(valor) {
  return String(valor || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function podeCorrigirQuilometragem(user) {
  const perfil = normalizar(user?.perfil || user?.role || user?.tipo_usuario || user?.user_metadata?.perfil)
  return [
    'P4', 'SECAO P4', 'GESTOR PATRIMONIAL',
    'SVDD', 'ENCARREGADO SVDD', 'ENCARREGADO DO SVDD',
    'COMANDANTE DE CIA', 'COMANDANTE DA CIA', 'COMANDANTE'
  ].includes(perfil)
}

function atorDoUsuario(user) {
  return {
    criado_por_id: user?.id || user?.user_id || user?.auth_id || null,
    criado_por_nome: user?.nome || user?.nome_guerra || user?.nome_completo || user?.re || user?.email || null
  }
}

function inteiro(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function obterRivResumo(viaturaId) {
  const [{ data: viatura, error: e1 }, { data: km, error: e2 }, { data: manut, error: e3 }, { data: ocorrencias, error: e4 }] = await Promise.all([
    supabase.from(TABLE_VIATURAS).select('id, prefixo, quilometragem_atual').eq('id', viaturaId).single(),
    supabase.from(TABLE_KM).select('*').eq('viatura_id', viaturaId).order('created_at', { ascending: false }).limit(50),
    supabase.from(TABLE_MANUT).select('*').eq('viatura_id', viaturaId).order('created_at', { ascending: true }),
    supabase.from(TABLE_OCORRENCIAS).select('*').eq('viatura_id', viaturaId).order('created_at', { ascending: false }).limit(30)
  ])
  if (e1) throw e1
  if (e2) throw e2
  if (e3) throw e3
  if (e4) throw e4
  return { quilometragemAtual: Number(viatura?.quilometragem_atual || 0), historicoKm: km || [], manutencoes: manut || [], ocorrencias: ocorrencias || [] }
}

export async function registrarQuilometragem({ viatura, quilometragem, observacao, user }) {
  const km = inteiro(quilometragem)
  if (!viatura?.id) throw new Error('Viatura inválida.')
  if (km == null || km < 0) throw new Error('Informe uma quilometragem válida.')
  const atual = Number(viatura.quilometragem_atual || 0)
  if (km < atual) throw new Error(`A nova quilometragem não pode ser menor que a atual (${atual.toLocaleString('pt-BR')} km). Use “Corrigir quilometragem” se houve erro de lançamento.`)

  const { data, error } = await supabase.from(TABLE_KM).insert({
    viatura_id: viatura.id,
    quilometragem: km,
    observacao: String(observacao || '').trim().toUpperCase() || null,
    tipo_lancamento: 'REGISTRO',
    ...atorDoUsuario(user)
  }).select().single()
  if (error) throw error

  const { error: updateError } = await supabase.from(TABLE_VIATURAS).update({ quilometragem_atual: km, updated_at: new Date().toISOString() }).eq('id', viatura.id)
  if (updateError) throw updateError
  return data
}

export async function corrigirQuilometragem({ viaturaId, novaQuilometragem, justificativa, user }) {
  if (!podeCorrigirQuilometragem(user)) throw new Error('Seu perfil não possui permissão para corrigir quilometragem.')
  const km = inteiro(novaQuilometragem)
  const motivo = String(justificativa || '').trim()
  if (!viaturaId) throw new Error('Viatura inválida.')
  if (km == null || km < 0) throw new Error('Informe a quilometragem correta.')
  if (!motivo) throw new Error('Informe obrigatoriamente o motivo da correção.')
  const ator = atorDoUsuario(user)

  const { data, error } = await supabase.rpc('sigmo_corrigir_quilometragem_viatura', {
    p_viatura_id: viaturaId,
    p_nova_quilometragem: km,
    p_justificativa: motivo.toUpperCase(),
    p_usuario_id: ator.criado_por_id,
    p_usuario_nome: ator.criado_por_nome
  })
  if (error) throw error
  return data
}

export async function salvarManutencaoRiv({ viaturaId, item, nomeItem, itemPersonalizado = false, ultimaData, ultimaKm, proximaData, proximaKm, margemAlertaKm, margemAlertaDias, observacoes, user }) {
  if (!viaturaId) throw new Error('Viatura inválida.')
  if (!item) throw new Error('Informe o item de manutenção.')
  if (!String(nomeItem || '').trim()) throw new Error('Informe o nome do item de manutenção.')
  const ator = atorDoUsuario(user)
  const payload = {
    viatura_id: viaturaId,
    item,
    nome_item: String(nomeItem).trim().toUpperCase(),
    item_personalizado: Boolean(itemPersonalizado),
    ultima_data: ultimaData || null,
    ultima_km: inteiro(ultimaKm),
    proxima_data: proximaData || null,
    proxima_km: inteiro(proximaKm),
    margem_alerta_km: inteiro(margemAlertaKm) ?? 1000,
    margem_alerta_dias: inteiro(margemAlertaDias) ?? 30,
    observacoes: String(observacoes || '').trim().toUpperCase() || null,
    atualizado_por_id: ator.criado_por_id,
    atualizado_por_nome: ator.criado_por_nome,
    updated_at: new Date().toISOString()
  }
  const { data, error } = await supabase.from(TABLE_MANUT).upsert(payload, { onConflict: 'viatura_id,item' }).select().single()
  if (error) throw error
  return data
}

export async function registrarOcorrenciaRiv({ viatura, tipo, titulo, descricao, user }) {
  if (!viatura?.id) throw new Error('Viatura inválida.')
  if (!tipo) throw new Error('Informe o tipo do registro.')
  if (!String(titulo || '').trim()) throw new Error('Informe o título.')
  const { data, error } = await supabase.from(TABLE_OCORRENCIAS).insert({
    viatura_id: viatura.id, tipo, titulo: String(titulo).trim().toUpperCase(), descricao: String(descricao || '').trim().toUpperCase() || null,
    quilometragem: Number(viatura.quilometragem_atual || 0), ...atorDoUsuario(user)
  }).select().single()
  if (error) throw error
  return data
}

export async function alterarStatusOcorrenciaRiv(id, resolvida) {
  const { data, error } = await supabase.from(TABLE_OCORRENCIAS).update({ resolvida: Boolean(resolvida), resolvida_em: resolvida ? new Date().toISOString() : null }).eq('id', id).select().single()
  if (error) throw error
  return data
}


export function podeReabrirManutencaoRiv(user) {
  return ehComandante(user)
}

export async function obterHistoricoOcorrenciaRiv(ocorrenciaId) {
  if (!ocorrenciaId) return []
  const { data, error } = await supabase
    .from(TABLE_HISTORICO_OCORRENCIAS)
    .select('*')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

async function registrarHistoricoOcorrencia({ ocorrenciaId, acao, descricao, user }) {
  const ator = atorDoUsuario(user)
  const { data, error } = await supabase
    .from(TABLE_HISTORICO_OCORRENCIAS)
    .insert({
      ocorrencia_id: ocorrenciaId,
      acao: String(acao || '').trim().toUpperCase(),
      descricao: String(descricao || '').trim().toUpperCase() || null,
      criado_por_id: ator.criado_por_id,
      criado_por_nome: ator.criado_por_nome
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function concluirManutencaoRiv(item, user) {
  if (!item?.id || item.tipo !== 'MANUTENCAO') throw new Error('Manutenção inválida.')
  if (item.resolvida) throw new Error('Esta manutenção já está concluída.')

  const agora = new Date().toISOString()
  const ator = atorDoUsuario(user)
  const { data, error } = await supabase
    .from(TABLE_OCORRENCIAS)
    .update({
      resolvida: true,
      resolvida_em: agora,
      encerrada_por_id: ator.criado_por_id,
      encerrada_por_nome: ator.criado_por_nome,
      reaberta_em: null
    })
    .eq('id', item.id)
    .eq('resolvida', false)
    .select()
    .single()
  if (error) throw error

  await registrarHistoricoOcorrencia({
    ocorrenciaId: item.id,
    acao: 'CONCLUIDA',
    descricao: 'MANUTENÇÃO CONCLUÍDA E BLOQUEADA PARA ALTERAÇÕES.',
    user
  })
  return data
}

export async function reabrirManutencaoRiv(item, justificativa, user) {
  if (!podeReabrirManutencaoRiv(user)) throw new Error('Somente o Comandante de Cia pode reabrir uma manutenção concluída.')
  if (!item?.id || item.tipo !== 'MANUTENCAO') throw new Error('Manutenção inválida.')
  if (!item.resolvida) throw new Error('A manutenção já está aberta.')
  const motivo = String(justificativa || '').trim()
  if (!motivo) throw new Error('Informe obrigatoriamente a justificativa da reabertura.')

  const agora = new Date().toISOString()
  const ator = atorDoUsuario(user)
  const { data, error } = await supabase
    .from(TABLE_OCORRENCIAS)
    .update({
      resolvida: false,
      resolvida_em: null,
      reaberta_em: agora,
      reaberta_por_id: ator.criado_por_id,
      reaberta_por_nome: ator.criado_por_nome,
      justificativa_reabertura: motivo.toUpperCase()
    })
    .eq('id', item.id)
    .eq('resolvida', true)
    .select()
    .single()
  if (error) throw error

  await registrarHistoricoOcorrencia({
    ocorrenciaId: item.id,
    acao: 'REABERTA',
    descricao: `JUSTIFICATIVA: ${motivo}`,
    user
  })
  return data
}


export async function concluirAvariaRiv({ item, providencia, observacoes, user }) {
  if (!item?.id || item.tipo !== 'AVARIA') throw new Error('Avaria inválida.')
  if (item.resolvida === true) throw new Error('Esta avaria já está resolvida.')

  const providenciaFinal = String(providencia || '').trim()
  const observacoesFinais = String(observacoes || '').trim()
  if (!providenciaFinal) throw new Error('Informe obrigatoriamente a providência/solução adotada.')

  const ator = atorDoUsuario(user)
  const { data, error } = await supabase.rpc('sigmo_concluir_avaria_riv', {
    p_ocorrencia_id: item.id,
    p_providencia: providenciaFinal.toUpperCase(),
    p_observacoes: observacoesFinais.toUpperCase() || null,
    p_usuario_nome: ator.criado_por_nome,
    p_perfil: String(user?.perfil || user?.role || user?.tipo_usuario || user?.user_metadata?.perfil || '').trim().toUpperCase()
  })
  if (error) throw error
  return data
}

export async function reabrirAvariaRiv({ item, justificativa, user }) {
  if (!item?.id || item.tipo !== 'AVARIA') throw new Error('Avaria inválida.')
  if (item.resolvida !== true) throw new Error('Esta avaria já está aberta.')

  const motivo = String(justificativa || '').trim()
  if (!motivo) throw new Error('Informe a justificativa da reabertura.')

  const ator = atorDoUsuario(user)
  const { data, error } = await supabase.rpc('sigmo_reabrir_avaria_riv', {
    p_ocorrencia_id: item.id,
    p_justificativa: motivo.toUpperCase(),
    p_usuario_nome: ator.criado_por_nome
  })
  if (error) throw error
  return data
}

export function calcularStatusManutencao(registro, quilometragemAtual) {
  if (!registro) return { nivel: 'SEM_REGISTRO', label: 'Sem programação' }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const proximaData = registro.proxima_data ? new Date(`${registro.proxima_data}T00:00:00`) : null
  const proximaKm = Number.isFinite(Number(registro.proxima_km)) ? Number(registro.proxima_km) : null
  const margemKm = Number(registro.margem_alerta_km || 0)
  const margemDias = Number(registro.margem_alerta_dias || 0)
  const diasRestantes = proximaData ? Math.ceil((proximaData.getTime() - hoje.getTime()) / 86400000) : null
  const kmRestantes = proximaKm != null ? proximaKm - Number(quilometragemAtual || 0) : null
  if ((diasRestantes != null && diasRestantes < 0) || (kmRestantes != null && kmRestantes < 0)) return { nivel: 'VENCIDO', label: 'Vencido', diasRestantes, kmRestantes }
  if ((diasRestantes != null && diasRestantes <= margemDias) || (kmRestantes != null && kmRestantes <= margemKm)) return { nivel: 'ATENCAO', label: 'Próximo do vencimento', diasRestantes, kmRestantes }
  return { nivel: 'OK', label: 'Em dia', diasRestantes, kmRestantes }
}


const TABLE_FOTOS = 'sigmo_viaturas_fotos'
const BUCKET_FOTOS = 'viaturas-fotos'

function nomeSeguroFoto(nome = 'foto.jpg') {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
}

function urlPublicaFoto(path) {
  if (!path) return null
  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path)
  return data?.publicUrl || null
}

export async function listarFotosOcorrenciaRiv(ocorrenciaId) {
  if (!ocorrenciaId) return []
  const { data, error } = await supabase
    .from(TABLE_FOTOS)
    .select('*')
    .eq('riv_ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((foto) => ({ ...foto, url: urlPublicaFoto(foto.storage_path) }))
}

export async function enviarFotosOcorrenciaRiv({ viaturaId, ocorrenciaId, tipo, fase = 'ANTES', arquivos, user }) {
  const lista = Array.from(arquivos || [])
  if (!viaturaId || !ocorrenciaId) throw new Error('Registro do RIV inválido para fotos.')
  if (!lista.length) return []

  if (tipo === 'MANUTENCAO') {
    const { data: manutencao, error: manutencaoError } = await supabase
      .from(TABLE_OCORRENCIAS)
      .select('id, resolvida')
      .eq('id', ocorrenciaId)
      .single()
    if (manutencaoError) throw manutencaoError
    if (manutencao?.resolvida) throw new Error('A manutenção está concluída. Reabra-a antes de adicionar novas fotos.')
  }

  const origem = tipo === 'MANUTENCAO' ? 'MANUTENCAO' : tipo === 'AVARIA' ? 'AVARIA' : 'RIV'
  const pasta = origem === 'MANUTENCAO' ? 'manutencoes' : origem === 'AVARIA' ? 'avarias' : 'riv'
  const ator = atorDoUsuario(user)
  const resultados = []

  for (let i = 0; i < lista.length; i += 1) {
    const arquivo = lista[i]
    if (!arquivo.type?.startsWith('image/')) throw new Error('Selecione somente arquivos de imagem.')
    const storagePath = `${viaturaId}/${pasta}/${Date.now()}-${i}-${nomeSeguroFoto(arquivo.name)}`
    const { error: uploadError } = await supabase.storage.from(BUCKET_FOTOS).upload(storagePath, arquivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: arquivo.type
    })
    if (uploadError) throw uploadError

    const { data, error } = await supabase.from(TABLE_FOTOS).insert({
      viatura_id: viaturaId,
      origem,
      storage_path: storagePath,
      nome_arquivo: arquivo.name,
      principal: false,
      riv_ocorrencia_id: ocorrenciaId,
      fase_riv: fase,
      ...ator
    }).select().single()

    if (error) {
      await supabase.storage.from(BUCKET_FOTOS).remove([storagePath])
      throw error
    }
    resultados.push({ ...data, url: urlPublicaFoto(storagePath) })
  }
  return resultados
}

export async function obterFotosRivPorViatura(viaturaId) {
  const { data, error } = await supabase
    .from(TABLE_FOTOS)
    .select('*')
    .eq('viatura_id', viaturaId)
    .not('riv_ocorrencia_id', 'is', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((foto) => ({ ...foto, url: urlPublicaFoto(foto.storage_path) }))
}
