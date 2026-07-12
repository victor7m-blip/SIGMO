import { supabase } from './supabaseClient'
import {
  registrarEventoPatrimonial,
  TIPOS_EVENTO_PATRIMONIAL,
  obterNomeUsuario
} from './eventoPatrimonialService'

const BUCKET = 'armas-fotos'
const TABLE = 'sigmo_armas_fotos'

export async function uploadFotoArma(
  file,
  armaId,
  user = null,
  principal = false
) {
  if (!file) {
    throw new Error('Nenhuma foto selecionada.')
  }

  if (!armaId) {
    throw new Error(
      'Salve a arma antes de enviar fotos.'
    )
  }

  const extensao =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() || 'jpg'

  const nomeArquivo =
    `${armaId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extensao}`

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
    await listarFotosArma(armaId)

  const deveSerPrincipal =
    principal || fotosExistentes.length === 0

  if (deveSerPrincipal) {
    await removerPrincipalFotosArma(
      armaId
    )
  }

  const { data, error: bancoError } =
    await supabase
      .from(TABLE)
      .insert({
        arma_id: armaId,
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
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_ADICIONADA,
    patrimonioId: armaId,
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
        TIPOS_EVENTO_PATRIMONIAL
          .FOTO_PRINCIPAL,
      patrimonioId: armaId,
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

  // Mantém compatibilidade com o retorno antigo.
  return data.url
}

export async function listarFotosArma(
  armaId
) {
  if (!armaId) {
    return []
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('arma_id', armaId)
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

export async function definirFotoPrincipalArma(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.arma_id) {
    throw new Error(
      'Foto inválida para definir como principal.'
    )
  }

  if (foto.principal) {
    return foto.url
  }

  await removerPrincipalFotosArma(
    foto.arma_id
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
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_PRINCIPAL,
    patrimonioId: foto.arma_id,
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

  // Mantém compatibilidade com o retorno antigo.
  return data.url
}

export async function excluirFotoArma(
  foto,
  user = null
) {
  if (!foto?.id || !foto?.arma_id) {
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
    patrimonioId: foto.arma_id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} removeu uma foto.`,
    metadata: {
      fotoId: foto.id,
      caminho: foto.caminho || null,
      eraPrincipal:
        Boolean(foto.principal),
      tabela: TABLE,
      bucket: BUCKET
    }
  })

  if (foto.principal) {
    const novaPrincipal =
      await definirNovaFotoPrincipalAutomatica(
        foto.arma_id
      )

    if (novaPrincipal) {
      await registrarEventoPatrimonial({
        tipo:
          TIPOS_EVENTO_PATRIMONIAL
            .FOTO_PRINCIPAL,
        patrimonioId: foto.arma_id,
        usuario: user,
        descricao:
          `${obterNomeUsuario(user)} definiu automaticamente outra foto como principal.`,
        metadata: {
          fotoId: novaPrincipal.id,
          caminho:
            novaPrincipal.caminho || null,
          motivo:
            'EXCLUSÃO DA FOTO PRINCIPAL',
          tabela: TABLE,
          bucket: BUCKET
        }
      })
    }
  }

  return true
}

export async function baixarFotoArma(
  foto,
  user = null
) {
  if (!foto?.url || !foto?.arma_id) {
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
    `arma-${foto.id}.jpg`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(urlTemporaria)

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL
        .FOTO_BAIXADA,
    patrimonioId: foto.arma_id,
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

async function removerPrincipalFotosArma(
  armaId
) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      principal: false
    })
    .eq('arma_id', armaId)

  if (error) {
    throw error
  }
}

async function definirNovaFotoPrincipalAutomatica(
  armaId
) {
  const {
    data: proximaFoto,
    error: buscaError
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('arma_id', armaId)
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

  const { data, error } = await supabase
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