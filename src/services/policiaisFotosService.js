import { supabase } from './supabaseClient'
import { registerAudit } from './auditoriaService'

const BUCKET = 'policiais-fotos'
const TABLE = 'sigmo_policiais_fotos'
const POLICIAIS_TABLE = 'policiais'

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.name ||
    user?.email ||
    'SIGMO'
  )
}

async function registrarAuditoriaFoto({
  tipo,
  descricao,
  user = null
}) {
  try {
    await registerAudit(
      tipo,
      descricao,
      user,
      'Policiais',
      'Informativo'
    )
  } catch (error) {
    console.warn(
      'Operação realizada, mas a auditoria não foi registrada:',
      error
    )
  }
}

export async function uploadFotoPolicial(
  file,
  policialId,
  user = null
) {
  if (!file) {
    throw new Error('Nenhuma foto selecionada.')
  }

  if (!policialId) {
    throw new Error(
      'Salve o policial antes de enviar fotos.'
    )
  }

  const extensao =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() || 'jpg'

  const nomeArquivo =
    `${policialId}/${Date.now()}-${Math.random()
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

  const { data: publicData } =
    supabase.storage
      .from(BUCKET)
      .getPublicUrl(nomeArquivo)

  const url = publicData.publicUrl

  const {
    data: fotosExistentes,
    error: countError
  } = await supabase
    .from(TABLE)
    .select('id')
    .eq('policial_id', policialId)
    .limit(1)

  if (countError) {
    await supabase.storage
      .from(BUCKET)
      .remove([nomeArquivo])

    throw countError
  }

  const primeiraFoto =
    !fotosExistentes ||
    fotosExistentes.length === 0

  const { data, error: bancoError } =
    await supabase
      .from(TABLE)
      .insert({
        policial_id: policialId,
        url,
        caminho: nomeArquivo,
        principal: primeiraFoto,
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

  await registrarAuditoriaFoto({
    tipo: 'FOTO_ADICIONADA',
    descricao:
      `${obterNomeUsuario(user)} adicionou uma foto ao cadastro do policial.`,
    user
  })

  if (primeiraFoto) {
    await definirFotoPrincipal(
      policialId,
      data.id,
      url,
      user,
      false
    )
  }

  return data
}

export async function listarFotosPolicial(
  policialId
) {
  if (!policialId) {
    return []
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('policial_id', policialId)
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

export async function definirFotoPrincipal(
  policialId,
  fotoId,
  fotoUrl = null,
  user = null,
  registrarAuditoria = true
) {
  if (!policialId) {
    throw new Error('Policial não informado.')
  }

  if (!fotoId) {
    throw new Error('Foto não informada.')
  }

  const { error: limparError } =
    await supabase
      .from(TABLE)
      .update({
        principal: false
      })
      .eq('policial_id', policialId)

  if (limparError) {
    throw limparError
  }

  const { data: foto, error: fotoError } =
    await supabase
      .from(TABLE)
      .update({
        principal: true
      })
      .eq('id', fotoId)
      .eq('policial_id', policialId)
      .select()
      .single()

  if (fotoError) {
    throw fotoError
  }

  const urlPrincipal =
    fotoUrl || foto.url

  const { error: policialError } =
    await supabase
      .from(POLICIAIS_TABLE)
      .update({
        foto_url: urlPrincipal
      })
      .eq('id', policialId)

  if (policialError) {
    throw policialError
  }

  if (registrarAuditoria) {
    await registrarAuditoriaFoto({
      tipo: 'FOTO_PRINCIPAL',
      descricao:
        `${obterNomeUsuario(user)} definiu a foto principal do policial.`,
      user
    })
  }

  return foto
}

export async function excluirFotoPolicial(
  foto,
  policialId = null,
  user = null
) {
  const idPolicial =
    policialId || foto?.policial_id

  if (!foto?.id) {
    throw new Error('Foto não informada.')
  }

  if (!idPolicial) {
    throw new Error('Policial não informado.')
  }

  const eraPrincipal =
    Boolean(foto.principal)

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

  await registrarAuditoriaFoto({
    tipo: 'FOTO_REMOVIDA',
    descricao:
      `${obterNomeUsuario(user)} removeu uma foto do cadastro do policial.`,
    user
  })

  if (eraPrincipal) {
    const fotosRestantes =
      await listarFotosPolicial(idPolicial)

    const novaPrincipal =
      fotosRestantes?.[0]

    if (novaPrincipal) {
      await definirFotoPrincipal(
        idPolicial,
        novaPrincipal.id,
        novaPrincipal.url,
        user,
        false
      )

      await registrarAuditoriaFoto({
        tipo: 'FOTO_PRINCIPAL',
        descricao:
          `${obterNomeUsuario(user)} definiu automaticamente outra foto como principal.`,
        user
      })
    } else {
      const { error: limparPolicialError } =
        await supabase
          .from(POLICIAIS_TABLE)
          .update({
            foto_url: null
          })
          .eq('id', idPolicial)

      if (limparPolicialError) {
        throw limparPolicialError
      }
    }
  }

  return true
}

export async function baixarFotoPolicial(
  foto,
  user = null
) {
  if (!foto?.url) {
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
    foto.caminho?.split('/').pop() ||
    `policial-${foto.id}.jpg`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(urlTemporaria)

  await registrarAuditoriaFoto({
    tipo: 'FOTO_BAIXADA',
    descricao:
      `${obterNomeUsuario(user)} baixou uma foto do cadastro do policial.`,
    user
  })

  return true
}