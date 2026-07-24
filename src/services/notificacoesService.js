import {
  supabase
} from './supabaseClient'

import {
  emitirNotificacao
} from './notificacaoEngine'

const TABLE =
  'sigmo_notificacoes'

function texto(valor) {
  return String(
    valor ?? ''
  ).trim()
}

function upper(
  valor,
  fallback = ''
) {
  const resultado =
    texto(valor).toUpperCase()

  return resultado || fallback
}

function limparPayload(
  payload = {}
) {
  const modulo =
    upper(
      payload.modulo,
      'SISTEMA'
    )

  const tipoRecebido =
    upper(
      payload.tipo,
      'INFORMACAO'
    )

  const tiposPermitidos = [
    'INFORMACAO',
    'SUCESSO',
    'ALERTA',
    'ERRO',
    'SOLICITACAO',
    'PATRIMONIO',
    'SEGURANCA',
    'SISTEMA'
  ]

  let tipo =
    tipoRecebido

  if (
    !tiposPermitidos.includes(
      tipo
    )
  ) {
    const ehPatrimonial =
      modulo.includes(
        'PATRIMONIO'
      ) ||
      modulo.includes(
        'PATRIMÔNIO'
      ) ||
      [
        'TRANSFERENCIA',
        'DISTRIBUICAO',
        'MOVIMENTACAO',
        'MOVIMENTACAO_PATRIMONIAL',
        'CAUTELA',
        'DEVOLUCAO',
        'RECEBIMENTO'
      ].includes(
        tipoRecebido
      )

    tipo =
      ehPatrimonial
        ? 'PATRIMONIO'
        : 'INFORMACAO'
  }

  return {
    titulo:
      texto(
        payload.titulo
      ),

    mensagem:
      texto(
        payload.mensagem
      ),

    tipo,

    modulo,

    prioridade:
      upper(
        payload.prioridade,
        'NORMAL'
      ),

    destinatario_usuario_id:
      payload.destinatario_usuario_id ||
      null,

    destinatario_policial_id:
      payload.destinatario_policial_id ||
      null,

    destinatario_perfil:
      payload.destinatario_perfil
        ? upper(
            payload.destinatario_perfil
          )
        : null,

    link:
      texto(
        payload.link
      ) ||
      null,

    metadata:
      payload.metadata &&
      typeof payload.metadata ===
        'object'
        ? payload.metadata
        : {},

    expira_em:
      payload.expira_em ||
      null,

    lida:
      false,

    arquivada:
      false
  }
}

export async function obterHoraServidor() {
  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_agora'
  )

  if (error) {
    throw error
  }

  return data
}

export function formatarDataHoraServidor(
  valor
) {
  if (!valor) {
    return 'DATA NÃO INFORMADA'
  }

  const data =
    new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return String(valor)
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone:
        'America/Sao_Paulo',

      day: '2-digit',
      month: '2-digit',
      year: 'numeric',

      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  ).format(data)
}

export async function criarNotificacao(
  payload
) {
  const dados =
    limparPayload(payload)

  if (!dados.titulo) {
    throw new Error(
      'O título da notificação é obrigatório.'
    )
  }

  if (!dados.mensagem) {
    throw new Error(
      'A mensagem da notificação é obrigatória.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert(dados)
    .select()
    .single()

  if (error) {
    throw error
  }

  emitirNotificacao({
    tipo: 'NOTIFICACAO_CRIADA',
    notificacao: data
  })

  return data
}

export async function criarNotificacoes(
  notificacoes = []
) {
  if (
    !Array.isArray(notificacoes) ||
    notificacoes.length === 0
  ) {
    return []
  }

  const payloads =
    notificacoes.map(
      limparPayload
    )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert(payloads)
    .select()

  if (error) {
    throw error
  }

  for (
    const notificacao of
    data ?? []
  ) {
    emitirNotificacao({
      tipo:
        'NOTIFICACAO_CRIADA',

      notificacao
    })
  }

  return data ?? []
}

export async function criarNotificacaoParaUsuario({
  usuarioId,
  policialId = null,
  ...payload
}) {
  if (
    !usuarioId &&
    !policialId
  ) {
    throw new Error(
      'Informe o destinatário da notificação.'
    )
  }

  return criarNotificacao({
    ...payload,

    destinatario_usuario_id:
      usuarioId || null,

    destinatario_policial_id:
      policialId || null
  })
}

export async function criarNotificacaoParaPerfil({
  perfil,
  ...payload
}) {
  if (!texto(perfil)) {
    throw new Error(
      'Informe o perfil destinatário.'
    )
  }

  return criarNotificacao({
    ...payload,

    destinatario_perfil:
      upper(perfil)
  })
}

export async function listarNotificacoes({
  usuarioId = null,
  policialId = null,
  perfil = null,
  apenasNaoLidas = false,
  limite = 50
} = {}) {
  let query =
    supabase
      .from(TABLE)
      .select('*')
      .eq(
        'arquivada',
        false
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(limite)

  const destinos = []

  if (usuarioId) {
    destinos.push(
      `destinatario_usuario_id.eq.${usuarioId}`
    )
  }

  if (policialId) {
    destinos.push(
      `destinatario_policial_id.eq.${policialId}`
    )
  }

  if (perfil) {
    destinos.push(
      `destinatario_perfil.eq.${upper(
        perfil
      )}`
    )
  }

  if (
    destinos.length > 0
  ) {
    query =
      query.or(
        destinos.join(',')
      )
  }

  if (apenasNaoLidas) {
    query =
      query.eq(
        'lida',
        false
      )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return data ?? []
}

export async function marcarComoLida(
  id
) {
  if (!id) {
    throw new Error(
      'Notificação não informada.'
    )
  }

  const horaServidor =
    await obterHoraServidor()

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      lida: true,
      lida_em:
        horaServidor
    })
    .eq(
      'id',
      id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  emitirNotificacao({
    tipo:
      'NOTIFICACAO_ATUALIZADA',

    notificacao: data
  })

  return data
}

export async function arquivarNotificacao(
  id
) {
  if (!id) {
    throw new Error(
      'Notificação não informada.'
    )
  }

  const horaServidor =
    await obterHoraServidor()

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      arquivada: true,
      arquivada_em:
        horaServidor
    })
    .eq(
      'id',
      id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  emitirNotificacao({
    tipo:
      'NOTIFICACAO_ARQUIVADA',

    notificacao: data
  })

  return data
}