import { supabase } from './supabaseClient'

const BUCKET = 'policiais-fotos'

export async function uploadFotoPolicial(file, policialId, user) {
  const extensao = file.name.split('.').pop()

  const nomeArquivo =
    `${policialId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(nomeArquivo, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(nomeArquivo)

  const { error: bancoError } = await supabase
    .from('sigmo_policiais_fotos')
    .insert({
      policial_id: policialId,
      url: data.publicUrl,
      caminho: nomeArquivo,
      created_by: user?.id,
      created_by_nome: user?.nome
    })

  if (bancoError) throw bancoError

  return data.publicUrl
}

export async function listarFotosPolicial(policialId) {
  const { data, error } = await supabase
    .from('sigmo_policiais_fotos')
    .select('*')
    .eq('policial_id', policialId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}

export async function excluirFotoPolicial(id, caminho) {
  await supabase.storage
    .from(BUCKET)
    .remove([caminho])

  const { error } = await supabase
    .from('sigmo_policiais_fotos')
    .delete()
    .eq('id', id)

  if (error) throw error
}