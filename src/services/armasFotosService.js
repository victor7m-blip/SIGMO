import { supabase } from './supabaseClient'

const BUCKET = 'armas-fotos'

export async function uploadFotoArma(file, armaId, user) {
  const extensao = file.name.split('.').pop()

  const nomeArquivo =
    `${armaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(nomeArquivo, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(nomeArquivo)

  const { error: bancoError } = await supabase
    .from('sigmo_armas_fotos')
    .insert({
      arma_id: armaId,
      url: data.publicUrl,
      caminho: nomeArquivo,
      created_by: user?.id,
      created_by_nome: user?.nome
    })

  if (bancoError) throw bancoError

  return data.publicUrl
}

export async function listarFotosArma(armaId) {
  const { data, error } = await supabase
    .from('sigmo_armas_fotos')
    .select('*')
    .eq('arma_id', armaId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}

export async function excluirFotoArma(id, caminho) {
  await supabase.storage
    .from(BUCKET)
    .remove([caminho])

  const { error } = await supabase
    .from('sigmo_armas_fotos')
    .delete()
    .eq('id', id)

  if (error) throw error
}