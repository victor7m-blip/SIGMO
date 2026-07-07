import { supabase } from './supabaseClient'

const BUCKET = 'armas-fotos'
const TABLE = 'sigmo_armas_fotos'

export async function uploadFotoArma(file, armaId, user, principal = false) {
  if (!file) throw new Error('Nenhuma foto selecionada.')
  if (!armaId) throw new Error('Salve a arma antes de enviar fotos.')

  const extensao = file.name.split('.').pop()?.toLowerCase() || 'jpg'

  const nomeArquivo =
    `${armaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensao}`

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

  const fotosExistentes = await listarFotosArma(armaId)
const deveSerPrincipal = principal || fotosExistentes.length === 0

if (deveSerPrincipal) {
  await removerPrincipalFotosArma(armaId)
}

  const { error: bancoError } = await supabase
    .from(TABLE)
    .insert({
      arma_id: armaId,
      url: data.publicUrl,
      caminho: nomeArquivo,
      principal: deveSerPrincipal,
      created_by: user?.id,
      created_by_nome: user?.nome
    })

  if (bancoError) throw bancoError

  return data.publicUrl
}

export async function listarFotosArma(armaId) {
  if (!armaId) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('arma_id', armaId)
    .order('principal', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

export async function definirFotoPrincipalArma(foto) {
  if (!foto?.id || !foto?.arma_id) {
    throw new Error('Foto inválida para definir como principal.')
  }

  await removerPrincipalFotosArma(foto.arma_id)

  const { error } = await supabase
    .from(TABLE)
    .update({ principal: true })
    .eq('id', foto.id)

  if (error) throw error

  return foto.url
}

export async function excluirFotoArma(foto) {
  if (!foto?.id) throw new Error('Foto inválida para exclusão.')

  if (foto.caminho) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([foto.caminho])

    if (storageError) throw storageError
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', foto.id)

  if (error) throw error
}

async function removerPrincipalFotosArma(armaId) {
  const { error } = await supabase
    .from(TABLE)
    .update({ principal: false })
    .eq('arma_id', armaId)

  if (error) throw error
}