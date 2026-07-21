import { supabase } from './supabaseClient'

import {
  registrarEventoPatrimonial,
  TIPOS_EVENTO_PATRIMONIAL,
  obterNomeUsuario
} from './eventoPatrimonialService'

const BUCKET = 'tasers-fotos'
const TABLE = 'sigmo_tasers_fotos'
const TASER_TABLE = 'sigmo_tasers'

export async function uploadFotoTaser(
  file,
  taserId,
  user = null,
  principal = false
) {
  if (!file) {
    throw new Error(
      'Nenhuma foto selecionada.'
    )
  }

  if (!taserId) {
    throw new Error(
      'Salve o Taser antes de enviar fotos.'
    )
  }

  const extensao =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() || 'jpg'

  const nomeArquivo =
    `${taserId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extensao}`

  const { error: uploadError } =
    await supabase.storage
      .from(BUCKET)
      .upload(nomeArquivo, file, {
        cacheControl: '3600',
        upsert: false,
        contentType:
          file.type || undefined
      })

  if (uploadError) {
    throw uploadError
  }

  const { data: publicUrlData } =
    supabase.storage
      .from(BUCKET)
      .getPublicUrl(nomeArquivo)

  const publicUrl =
    publicUrlData?.publicUrl

  if (!publicUrl) {
    await supabase.storage
      .from(BUCKET)
      .remove([nomeArquivo])

    throw new Error(
      'Não foi possível gerar a URL da foto.'
    )
  }

  try {
    const fotosExistentes =
      await listarFotosTaser(taserId)

    const deveSerPrincipal =
      principal ||
      fotosExistentes.length === 0

    if (deveSerPrincipal) {
      await removerPrincipalFotosTaser(
        taserId
      )
    }

    const { data, error: bancoError } =
      await supabase
        .from(TABLE)
        .insert({
          taser_id: taserId,
          url: publicUrl,
          caminho: nomeArquivo,
          nome_arquivo:
            file.name || null,
          principal:
            deveSerPrincipal,
          created_by:
            user?.id || null,
          created_by_nome:
            obterNomeUsuario(user)
        })
        .select()
        .single()

    if (bancoError) {
      throw bancoError
    }

    if (deveSerPrincipal) {
      await atualizarFotoPrincipalNoTaser(
        taserId,
        publicUrl
      )
    }

    await registrarEventoPatrimonial({
      tipo:
        TIPOS_EVENTO_PATRIMONIAL
          .FOTO_ADICIONADA,

      patrimonioId: taserId,
      usuario: user,

      descricao:
        `${obterNomeUsuario(user)} adicionou uma foto ao Taser.`,

      metadata: {
        modulo: 'TASER',
        fotoId: data.id,
        caminho: nomeArquivo,
        principal:
          deveSerPrincipal,
        tabela: TABLE,
        bucket: BUCKET
      }
    })

    if (deveSerPrincipal) {
      await registrarEventoPatrimonial({
        tipo:
          TIPOS_EVENTO_PATRIMONIAL
            .FOTO_PRINCIPAL,

        patrimonioId: taserId,
        usuario: user,

        descricao:
          `${obterNomeUsuario(user)} definiu a foto principal do Taser.`,

        metadata: {
          modulo: 'TASER',
          fotoId: data.id,
          caminho: nomeArquivo,
          tabela: TABLE,
          bucket: BUCKET
        }
      })
    }

    return data
  } catch (error) {
    await supabase.storage
      .from(BUCKET)
      .remove([nomeArquivo])

    throw error
  }
}

export async function listarFotosTaser(
  taserId
) {
  if (!taserId) {
    return []
  }

  const { data, error } =
    await supabase
      .from(TABLE)
      .select('*')
      .eq('taser_id', taserId)
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

export async function definirFotoPrincipalTaser(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.taser_id) {
    throw new Error(
      'Foto inválida para definir como principal.'
    )
  }

  if (foto.principal) {
    await atualizarFotoPrincipalNoTaser(
      foto.taser_id,
      foto.url
    )

    return foto
  }

  await removerPrincipalFotosTaser(
    foto.taser_id
  )

  const { data, error } =
    await supabase
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

  await atualizarFotoPrincipalNoTaser(
    foto.taser_id,
    data.url
  )

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_PRINCIPAL,

    patrimonioId: foto.taser_id,
    usuario: user,

    descricao:
      `${obterNomeUsuario(user)} definiu uma foto como principal do Taser.`,

    metadata: {
      modulo: 'TASER',
      fotoId: foto.id,
      caminho:
        foto.caminho || null,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return data
}

export async function excluirFotoTaser(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.taser_id) {
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

  const { error: deleteError } =
    await supabase
      .from(TABLE)
      .delete()
      .eq('id', foto.id)

  if (deleteError) {
    throw deleteError
  }

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_REMOVIDA,

    patrimonioId: foto.taser_id,
    usuario: user,

    descricao:
      `${obterNomeUsuario(user)} removeu uma foto do Taser.`,

    metadata: {
      modulo: 'TASER',
      fotoId: foto.id,
      caminho:
        foto.caminho || null,
      eraPrincipal:
        Boolean(foto.principal),
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  let novaPrincipal = null

  if (foto.principal) {
    novaPrincipal =
      await definirNovaFotoPrincipalAutomatica(
        foto.taser_id
      )

    await atualizarFotoPrincipalNoTaser(
      foto.taser_id,
      novaPrincipal?.url || null
    )

    if (novaPrincipal) {
      await registrarEventoPatrimonial({
        tipo:
          TIPOS_EVENTO_PATRIMONIAL
            .FOTO_PRINCIPAL,

        patrimonioId:
          foto.taser_id,
        usuario: user,

        descricao:
          `${obterNomeUsuario(user)} definiu automaticamente outra foto como principal do Taser.`,

        metadata: {
          modulo: 'TASER',
          fotoId:
            novaPrincipal.id,
          caminho:
            novaPrincipal.caminho ||
            null,
          motivo:
            'EXCLUSAO_DA_FOTO_PRINCIPAL',
          tabela: TABLE,
          bucket: BUCKET
        }
      })
    }
  }

  return {
    sucesso: true,
    novaPrincipal,
    novaPrincipalUrl:
      novaPrincipal?.url || ''
  }
}

export async function baixarFotoTaser(
  foto,
  user = null
) {
  if (!foto?.url || !foto?.taser_id) {
    throw new Error(
      'Foto inválida para download.'
    )
  }

  const resposta =
    await fetch(foto.url)

  if (!resposta.ok) {
    throw new Error(
      'Não foi possível baixar a foto.'
    )
  }

  const blob =
    await resposta.blob()

  const urlTemporaria =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = urlTemporaria

  link.download =
    foto.nome_arquivo ||
    foto.caminho
      ?.split('/')
      .pop() ||
    `taser-${foto.id}.jpg`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(
    urlTemporaria
  )

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_BAIXADA,

    patrimonioId: foto.taser_id,
    usuario: user,

    descricao:
      `${obterNomeUsuario(user)} baixou uma foto do Taser.`,

    metadata: {
      modulo: 'TASER',
      fotoId: foto.id,
      caminho:
        foto.caminho || null,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return true
}

async function removerPrincipalFotosTaser(
  taserId
) {
  const { error } =
    await supabase
      .from(TABLE)
      .update({
        principal: false
      })
      .eq('taser_id', taserId)

  if (error) {
    throw error
  }
}

async function definirNovaFotoPrincipalAutomatica(
  taserId
) {
  const {
    data: proximaFoto,
    error: buscaError
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('taser_id', taserId)
    .order('created_at', {
      ascending: false
    })
    .limit(1)
    .maybeSingle()

  if (buscaError) {
    throw buscaError
  }

  if (!proximaFoto) {
    return null
  }

  const { data, error } =
    await supabase
      .from(TABLE)
      .update({
        principal: true
      })
      .eq('id', proximaFoto.id)
      .select()
      .single()

  if (error) {
    throw error
  }

  return data
}

async function atualizarFotoPrincipalNoTaser(
  taserId,
  fotoUrl
) {
  const { error } =
    await supabase
      .from(TASER_TABLE)
      .update({
        foto_url:
          fotoUrl || null
      })
      .eq('id', taserId)

  if (error) {
    throw error
  }
}