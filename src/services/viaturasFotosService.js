import { supabase } from './supabaseClient'

const TABLE_FOTOS = 'sigmo_viaturas_fotos'
const TABLE_VIATURAS = 'sigmo_viaturas'
const BUCKET = 'viaturas-fotos'
const LIMITE_CADASTRO_INICIAL = 10

function nomeSeguro(nome = 'foto.jpg') {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
}

function publicUrl(path) {
  if (!path) return null

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  return data?.publicUrl || null
}

function atorDoUsuario(user) {
  return {
    criado_por_id:
      user?.id ||
      user?.user_id ||
      user?.auth_id ||
      null,
    criado_por_nome:
      user?.nome ||
      user?.nome_guerra ||
      user?.nome_completo ||
      user?.re ||
      user?.email ||
      null
  }
}

export async function listarFotosViatura(viaturaId) {
  const { data, error } = await supabase
    .from(TABLE_FOTOS)
    .select('*')
    .eq('viatura_id', viaturaId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((foto) => ({
    ...foto,
    url: publicUrl(foto.storage_path)
  }))
}

export async function contarFotosCadastroInicial(viaturaId) {
  const { count, error } = await supabase
    .from(TABLE_FOTOS)
    .select('id', { count: 'exact', head: true })
    .eq('viatura_id', viaturaId)
    .eq('origem', 'CADASTRO_INICIAL')

  if (error) throw error
  return count || 0
}

export async function enviarFotosCadastroInicial({
  viatura,
  arquivos,
  user
}) {
  const lista = Array.from(arquivos || [])

  if (!viatura?.id) {
    throw new Error('Viatura inválida para envio de fotos.')
  }

  if (lista.length === 0) return []

  const existentes = await contarFotosCadastroInicial(viatura.id)

  if (existentes + lista.length > LIMITE_CADASTRO_INICIAL) {
    throw new Error(
      `O cadastro inicial permite até ${LIMITE_CADASTRO_INICIAL} fotos.`
    )
  }

  const fotosAtuais = await listarFotosViatura(viatura.id)
  const existePrincipal = fotosAtuais.some((item) => item.principal)
  const resultados = []

  for (let index = 0; index < lista.length; index += 1) {
    const arquivo = lista[index]

    if (!arquivo.type?.startsWith('image/')) {
      throw new Error('Selecione somente arquivos de imagem.')
    }

    const timestamp = Date.now()
    const storagePath =
      `${viatura.id}/cadastro/${timestamp}-${index}-${nomeSeguro(arquivo.name)}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arquivo, {
        cacheControl: '3600',
        upsert: false,
        contentType: arquivo.type
      })

    if (uploadError) throw uploadError

    const principal = !existePrincipal && index === 0

    const { data, error: insertError } = await supabase
      .from(TABLE_FOTOS)
      .insert({
        viatura_id: viatura.id,
        origem: 'CADASTRO_INICIAL',
        storage_path: storagePath,
        nome_arquivo: arquivo.name,
        principal,
        ...atorDoUsuario(user)
      })
      .select()
      .single()

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      throw insertError
    }

    if (principal) {
      const { error: updateError } = await supabase
        .from(TABLE_VIATURAS)
        .update({
          foto_principal_path: storagePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', viatura.id)

      if (updateError) throw updateError
    }

    resultados.push({
      ...data,
      url: publicUrl(storagePath)
    })
  }

  return resultados
}

export async function definirFotoPrincipal(viaturaId, foto) {
  if (!viaturaId || !foto?.id || !foto?.storage_path) {
    throw new Error('Foto inválida.')
  }

  const { error: resetError } = await supabase
    .from(TABLE_FOTOS)
    .update({ principal: false })
    .eq('viatura_id', viaturaId)

  if (resetError) throw resetError

  const { error: fotoError } = await supabase
    .from(TABLE_FOTOS)
    .update({ principal: true })
    .eq('id', foto.id)

  if (fotoError) throw fotoError

  const { error: viaturaError } = await supabase
    .from(TABLE_VIATURAS)
    .update({
      foto_principal_path: foto.storage_path,
      updated_at: new Date().toISOString()
    })
    .eq('id', viaturaId)

  if (viaturaError) throw viaturaError
}

export async function excluirFotoViatura(viaturaId, foto) {
  if (!viaturaId || !foto?.id || !foto?.storage_path) {
    throw new Error('Foto inválida.')
  }

  const eraPrincipal = foto.principal === true

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([foto.storage_path])

  if (storageError) throw storageError

  const { error: deleteError } = await supabase
    .from(TABLE_FOTOS)
    .delete()
    .eq('id', foto.id)

  if (deleteError) throw deleteError

  if (!eraPrincipal) return

  const restantes = await listarFotosViatura(viaturaId)
  const novaPrincipal = restantes[0] || null

  if (novaPrincipal) {
    await definirFotoPrincipal(viaturaId, novaPrincipal)
    return
  }

  const { error } = await supabase
    .from(TABLE_VIATURAS)
    .update({
      foto_principal_path: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', viaturaId)

  if (error) throw error
}
