import { supabase } from './supabaseClient'

const BUCKET = 'policiais-fotos'
const TABLE = 'sigmo_policiais_fotos'
const POLICIAIS_TABLE = 'policiais'

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

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(nomeArquivo)

  const url = publicData.publicUrl

  const { data: fotosExistentes, error: countError } = await supabase
    .from(TABLE)
    .select('id')
    .eq('policial_id', policialId)
    .limit(1)

  if (countError) throw countError

  const primeiraFoto = !fotosExistentes || fotosExistentes.length === 0

  const { data, error: bancoError } = await supabase
    .from(TABLE)
    .insert({
      policial_id: policialId,
      url,
      caminho: nomeArquivo,
      principal: primeiraFoto,
      created_by: user?.id || null,
      created_by_nome: user?.nome || user?.email || null
    })
    .select()
    .single()

  if (bancoError) throw bancoError

  if (primeiraFoto) {
    await definirFotoPrincipal(policialId, data.id, url)
  }

  return data
}

export async function listarFotosPolicial(policialId) {
  if (!policialId) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('policial_id', policialId)
    .order('principal', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

export async function definirFotoPrincipal(policialId, fotoId, fotoUrl) {
  if (!policialId) throw new Error('Policial não informado.')
  if (!fotoId) throw new Error('Foto não informada.')

  const { error: limparError } = await supabase
    .from(TABLE)
    .update({ principal: false })
    .eq('policial_id', policialId)

  if (limparError) throw limparError

  const { data: foto, error: fotoError } = await supabase
    .from(TABLE)
    .update({ principal: true })
    .eq('id', fotoId)
    .eq('policial_id', policialId)
    .select()
    .single()

  if (fotoError) throw fotoError

  const urlPrincipal = fotoUrl || foto.url

  const { error: policialError } = await supabase
    .from(POLICIAIS_TABLE)
    .update({ foto_url: urlPrincipal })
    .eq('id', policialId)

  if (policialError) throw policialError

  return foto
}

export async function excluirFotoPolicial(foto, policialId) {
  if (!foto?.id) throw new Error('Foto não informada.')

  const eraPrincipal = Boolean(foto.principal)

  if (foto.caminho) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([foto.caminho])

    if (storageError) throw storageError
  }

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', foto.id)

  if (deleteError) throw deleteError

  if (eraPrincipal && policialId) {
    const fotosRestantes = await listarFotosPolicial(policialId)
    const novaPrincipal = fotosRestantes?.[0]

    if (novaPrincipal) {
      await definirFotoPrincipal(policialId, novaPrincipal.id, novaPrincipal.url)
    } else {
      const { error: limparPolicialError } = await supabase
        .from(POLICIAIS_TABLE)
        .update({ foto_url: null })
        .eq('id', policialId)

      if (limparPolicialError) throw limparPolicialError
    }
  }

  return true
}