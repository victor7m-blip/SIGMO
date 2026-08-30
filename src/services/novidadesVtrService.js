import { supabase } from './supabaseClient'

const VIEW_FLUXO = 'sigmo_viaturas_novidades_fluxo'
const TABLE_DOCUMENTOS = 'sigmo_viaturas_novidade_documentos'
const BUCKET = 'viaturas-fotos'

function ator(user) {
  return {
    id: user?.id || user?.user_id || user?.auth_id || null,
    nome: user?.nome || user?.nome_guerra || user?.nome_completo || user?.re || user?.email || null,
    re: user?.re || user?.matricula || null
  }
}

function nomeSeguro(nome = 'documento') {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export function urlDocumentoNovidadeVtr(storagePath) {
  if (!storagePath) return ''
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data?.publicUrl || ''
}

export async function listarNovidadesVtrFluxo() {
  const { data, error } = await supabase
    .from(VIEW_FLUXO)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function registrarCienciaProvidenciaVtr({
  ocorrenciaId,
  etapa,
  providencia,
  observacao,
  documento,
  user
}) {
  const a = ator(user)

  const { data, error } = await supabase.rpc('sigmo_registrar_ciencia_novidade_vtr', {
    p_ocorrencia_id: ocorrenciaId,
    p_etapa: etapa,
    p_providencia: providencia || null,
    p_observacao: observacao || null,
    p_documento: documento || null,
    p_usuario_id: a.id,
    p_usuario_nome: a.nome,
    p_usuario_re: a.re
  })

  if (error) throw error
  return data
}

export async function listarDocumentosNovidadeVtr(ocorrenciaId) {
  const { data, error } = await supabase
    .from(TABLE_DOCUMENTOS)
    .select('*')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((item) => ({
    ...item,
    url: urlDocumentoNovidadeVtr(item.storage_path)
  }))
}

export async function enviarDocumentoNovidadeVtr({
  viaturaId,
  ocorrenciaId,
  etapa,
  arquivo,
  user
}) {
  if (!viaturaId || !ocorrenciaId || !arquivo) {
    throw new Error('Documento da novidade inválido.')
  }

  const a = ator(user)
  const storagePath =
    `${viaturaId}/novidades-documentos/${ocorrenciaId}/${etapa}/` +
    `${Date.now()}-${nomeSeguro(arquivo.name)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arquivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: arquivo.type || undefined
    })

  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from(TABLE_DOCUMENTOS)
    .insert({
      ocorrencia_id: ocorrenciaId,
      etapa,
      nome_arquivo: arquivo.name,
      mime_type: arquivo.type || null,
      storage_path: storagePath,
      criado_por_id: a.id,
      criado_por_nome: a.nome,
      criado_por_re: a.re
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw error
  }

  return {
    ...data,
    url: urlDocumentoNovidadeVtr(storagePath)
  }
}

export async function excluirDocumentoNovidadeVtr(documento) {
  if (!documento?.id) throw new Error('Documento inválido.')

  if (documento.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([documento.storage_path])

    if (storageError) throw storageError
  }

  const { error } = await supabase
    .from(TABLE_DOCUMENTOS)
    .delete()
    .eq('id', documento.id)

  if (error) throw error
}
