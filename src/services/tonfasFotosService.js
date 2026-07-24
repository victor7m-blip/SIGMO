import { supabase } from './supabaseClient'

import {
  registrarEventoPatrimonial,
  TIPOS_EVENTO_PATRIMONIAL,
  obterNomeUsuario
} from './eventoPatrimonialService'

const BUCKET = 'tonfas-fotos'
const TABLE = 'sigmo_tonfas_fotos'
const TONFA_TABLE = 'sigmo_tonfas'

export async function uploadFotoTonfa(
  file,
  tonfaId,
  user = null,
  principal = false
) {
  if (!file) {
    throw new Error(
      'Nenhuma foto selecionada.'
    )
  }

  if (!tonfaId) {
    throw new Error(
      'Salve o Tonfa antes de enviar fotos.'
    )
  }

  const extensao =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() || 'jpg'

  const nomeArquivo =
    `${tonfaId}/${Date.now()}-${Math.random()
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
      await listarFotosTonfa(tonfaId)

    const deveSerPrincipal =
      principal ||
      fotosExistentes.length === 0

    if (deveSerPrincipal) {
      await removerPrincipalFotosTonfa(
        tonfaId
      )
    }

    const { data, error: bancoError } =
      await supabase
        .from(TABLE)
        .insert({
          tonfa_id: tonfaId,
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
      await atualizarFotoPrincipalNoTonfa(
        tonfaId,
        publicUrl
      )
    }

    await registrarEventoPatrimonial({
      tipo:
        TIPOS_EVENTO_PATRIMONIAL
          .FOTO_ADICIONADA,

      patrimonioId: tonfaId,
      usuario: user,

      descricao:
        `${obterNomeUsuario(user)} adicionou uma foto ao Tonfa.`,

      metadata: {
        modulo: 'TONFA',
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

        patrimonioId: tonfaId,
        usuario: user,

        descricao:
          `${obterNomeUsuario(user)} definiu a foto principal do Tonfa.`,

        metadata: {
          modulo: 'TONFA',
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

export async function listarFotosTonfa(
  tonfaId
) {
  if (!tonfaId) {
    return []
  }

  const { data, error } =
    await supabase
      .from(TABLE)
      .select('*')
      .eq('tonfa_id', tonfaId)
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

export async function definirFotoPrincipalTonfa(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.tonfa_id) {
    throw new Error(
      'Foto inválida para definir como principal.'
    )
  }

  if (foto.principal) {
    await atualizarFotoPrincipalNoTonfa(
      foto.tonfa_id,
      foto.url
    )

    return foto
  }

  await removerPrincipalFotosTonfa(
    foto.tonfa_id
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

  await atualizarFotoPrincipalNoTonfa(
    foto.tonfa_id,
    data.url
  )

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_PRINCIPAL,

    patrimonioId: foto.tonfa_id,
    usuario: user,

    descricao:
      `${obterNomeUsuario(user)} definiu uma foto como principal do Tonfa.`,

    metadata: {
      modulo: 'TONFA',
      fotoId: foto.id,
      caminho:
        foto.caminho || null,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return data
}

export async function excluirFotoTonfa(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.tonfa_id) {
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

    patrimonioId: foto.tonfa_id,
    usuario: user,

    descricao:
      `${obterNomeUsuario(user)} removeu uma foto do Tonfa.`,

    metadata: {
      modulo: 'TONFA',
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
        foto.tonfa_id
      )

    await atualizarFotoPrincipalNoTonfa(
      foto.tonfa_id,
      novaPrincipal?.url || null
    )

    if (novaPrincipal) {
      await registrarEventoPatrimonial({
        tipo:
          TIPOS_EVENTO_PATRIMONIAL
            .FOTO_PRINCIPAL,

        patrimonioId:
          foto.tonfa_id,
        usuario: user,

        descricao:
          `${obterNomeUsuario(user)} definiu automaticamente outra foto como principal do Tonfa.`,

        metadata: {
          modulo: 'TONFA',
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

export async function baixarFotoTonfa(
  foto,
  user = null
) {
  if (!foto?.url || !foto?.tonfa_id) {
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
    `tonfa-${foto.id}.jpg`

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

    patrimonioId: foto.tonfa_id,
    usuario: user,

    descricao:
      `${obterNomeUsuario(user)} baixou uma foto do Tonfa.`,

    metadata: {
      modulo: 'TONFA',
      fotoId: foto.id,
      caminho:
        foto.caminho || null,
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  return true
}

async function removerPrincipalFotosTonfa(
  tonfaId
) {
  const { error } =
    await supabase
      .from(TABLE)
      .update({
        principal: false
      })
      .eq('tonfa_id', tonfaId)

  if (error) {
    throw error
  }
}

async function definirNovaFotoPrincipalAutomatica(
  tonfaId
) {
  const {
    data: proximaFoto,
    error: buscaError
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('tonfa_id', tonfaId)
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

async function atualizarFotoPrincipalNoTonfa(
  tonfaId,
  fotoUrl
) {
  const { error } =
    await supabase
      .from(TONFA_TABLE)
      .update({
        foto_url:
          fotoUrl || null
      })
      .eq('id', tonfaId)

  if (error) {
    throw error
  }
}