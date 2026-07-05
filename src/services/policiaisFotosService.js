import { supabase } from './supabaseClient'

const BUCKET = 'policiais-fotos'
const TABLE = 'sigmo_policiais_fotos'

export async function uploadFotoPolicial(file, policialId, user) {
  if (!file) throw new Error('Nenhuma foto selecionada.')
  if (!policialId) throw new Error('Salve o policial antes de enviar fotos.')

  const extensao = file.name.split('.').pop()?.toLowerCase() || 'jpg'

  const nomeArquivo =
    `${policialId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(nomeArquivo, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(nomeArquivo)

  const { error: bancoError } = await supabase
    .from(TABLE)
    .insert({
      policial_id: policialId,
      url: data.publicUrl,
      caminho: nomeArquivo,
      created_by: user?.id || null,
      created_by_nome: user?.nome || null
    })

  if (bancoError) throw bancoError

  return data.publicUrl
}

export async function listarFotosPolicial(policialId) {
  if (!policialId) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('policial_id', policialId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

export async function excluirFotoPolicial(id, caminho) {
  if (!id) throw new Error('Foto inválida para exclusão.')

  if (caminho) {
    await supabase.storage
      .from(BUCKET)
      .remove([caminho])
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error
}