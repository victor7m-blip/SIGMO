import { supabase } from './supabaseClient'
import {
  registrarEventoPatrimonial,
  TIPOS_EVENTO_PATRIMONIAL,
  obterNomeUsuario
} from './patrimonioEngineService'

const BUCKET = 'materiais-fotos'
const TABLE = 'sigmo_materiais_fotos'

export async function uploadFotoMaterial(
  file,
  materialId,
  user,
  principal = false
) {
  if (!file) {
    throw new Error('Nenhuma foto selecionada.')
  }

  if (!materialId) {
    throw new Error(
      'Salve o material antes de enviar fotos.'
    )
  }

  const extensao =
    file.name.split('.').pop()?.toLowerCase() ||
    'jpg'

  const nomeArquivo = [
    materialId,
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extensao}`
  ].join('/')

  const { error: uploadError } =
    await supabase.storage
      .from(BUCKET)
      .upload(nomeArquivo, file, {
        cacheControl: '3600',
        upsert: false
      })

  if (uploadError) {
    throw uploadError
  }

  const { data: publicUrlData } =
    supabase.storage
      .from(BUCKET)
      .getPublicUrl(nomeArquivo)

  const fotosExistentes =
    await listarFotosMaterial(materialId)

  const deveSerPrincipal =
    principal || fotosExistentes.length === 0

  if (deveSerPrincipal) {
    await removerPrincipalFotosMaterial(materialId)
  }

  const { data, error: bancoError } =
    await supabase
      .from(TABLE)
      .insert({
        material_id: materialId,
        url: publicUrlData.publicUrl,
        caminho: nomeArquivo,
        principal: deveSerPrincipal,
        created_by: user?.id || null,
        created_by_nome:
          obterNomeUsuario(user)
      })
      .select()
      .single()

  if (bancoError) {
    await supabase.storage
      .from(BUCKET)
      .remove([nomeArquivo])

    throw bancoError
  }

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL.FOTO_ADICIONADA,
    patrimonioId: materialId,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} adicionou uma foto.`,
    metadata: {
      fotoId: data.id,
      caminho: nomeArquivo,
      principal: deveSerPrincipal,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  if (deveSerPrincipal) {
    await registrarEventoPatrimonial({
      tipo:
        TIPOS_EVENTO_PATRIMONIAL.FOTO_PRINCIPAL,
      patrimonioId: materialId,
      usuario: user,
      descricao:
        `${obterNomeUsuario(user)} definiu a foto como principal.`,
      metadata: {
        fotoId: data.id,
        caminho: nomeArquivo,
        tabela: TABLE,
        bucket: BUCKET
      }
    })
  }

  return data
}

export async function listarFotosMaterial(
  materialId
) {
  if (!materialId) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('material_id', materialId)
    .order('principal', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw error
  }

  return data || []
}

export async function definirFotoPrincipalMaterial(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.material_id) {
    throw new Error(
      'Foto inválida para definir como principal.'
    )
  }

  await removerPrincipalFotosMaterial(
    foto.material_id
  )

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      principal: true
    })
    .eq('id', foto.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL.FOTO_PRINCIPAL,
    patrimonioId: foto.material_id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} definiu uma foto como principal.`,
    metadata: {
      fotoId: foto.id,
      caminho: foto.caminho || null,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return data
}

export async function excluirFotoMaterial(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.material_id) {
    throw new Error(
      'Foto inválida para exclusão.'
    )
  }

  if (foto.caminho) {
    const { error: storageError } =
      await supabase.storage
        .from(BUCKET)
        .remove([foto.caminho])

    if (storageError) {
      throw storageError
    }
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', foto.id)

  if (error) {
    throw error
  }

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL.FOTO_REMOVIDA,
    patrimonioId: foto.material_id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} removeu uma foto.`,
    metadata: {
      fotoId: foto.id,
      caminho: foto.caminho || null,
      eraPrincipal: Boolean(foto.principal),
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return true
}

export async function baixarFotoMaterial(
  foto,
  user = null
) {
  if (!foto?.url || !foto?.material_id) {
    throw new Error(
      'Foto inválida para download.'
    )
  }

  const resposta = await fetch(foto.url)

  if (!resposta.ok) {
    throw new Error(
      'Não foi possível baixar a foto.'
    )
  }

  const blob = await resposta.blob()
  const urlTemporaria =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = urlTemporaria
  link.download =
    foto.caminho?.split('/').pop() ||
    `material-${foto.id}.jpg`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(urlTemporaria)

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL.FOTO_BAIXADA,
    patrimonioId: foto.material_id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} baixou uma foto.`,
    metadata: {
      fotoId: foto.id,
      caminho: foto.caminho || null,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return true
}

async function removerPrincipalFotosMaterial(
  materialId
) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      principal: false
    })
    .eq('material_id', materialId)

  if (error) {
    throw error
  }
}