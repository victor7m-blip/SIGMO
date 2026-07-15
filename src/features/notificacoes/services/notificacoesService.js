import { supabase } from '../../../services/supabaseClient'

const TABLE = 'sigmo_notificacoes'
const VIEW_ATIVAS = 'sigmo_notificacoes_ativas'

export const TIPOS_NOTIFICACAO = {
  INFORMACAO: 'INFORMACAO',
  SUCESSO: 'SUCESSO',
  ALERTA: 'ALERTA',
  ERRO: 'ERRO',
  SOLICITACAO: 'SOLICITACAO',
  PATRIMONIO: 'PATRIMONIO',
  SEGURANCA: 'SEGURANCA',
  SISTEMA: 'SISTEMA'
}

function texto(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function normalizarRE(re) {
  return texto(re).replace(/\D/g, '')
}

function normalizarNotificacao(notificacao) {
  if (!notificacao) return null

  return {
    ...notificacao,
    destinatario_re: normalizarRE(notificacao.destinatario_re),
    destinatario_nome: texto(notificacao.destinatario_nome),
    titulo: texto(notificacao.titulo),
    mensagem: texto(notificacao.mensagem),
    tipo: texto(notificacao.tipo || TIPOS_NOTIFICACAO.INFORMACAO)
      .toUpperCase(),
    modulo: texto(notificacao.modulo),
    referencia_tipo: texto(notificacao.referencia_tipo),
    lida: Boolean(notificacao.lida),
    arquivada: Boolean(notificacao.arquivada)
  }
}

function validarNovaNotificacao(notificacao) {
  const dados = normalizarNotificacao(notificacao)

  if (!dados.destinatario_re) {
    throw new Error('O RE do destinatário da notificação é obrigatório.')
  }

  if (!dados.titulo) {
    throw new Error('O título da notificação é obrigatório.')
  }

  if (!dados.mensagem) {
    throw new Error('A mensagem da notificação é obrigatória.')
  }

  return dados
}

function tratarErro(error, mensagemPadrao) {
  console.error(mensagemPadrao, error)

  const mensagem =
    error?.message ||
    error?.details ||
    error?.hint ||
    mensagemPadrao

  throw new Error(mensagem)
}

export async function criarNotificacao({
  destinatarioRe,
  destinatarioNome = '',
  tipo = TIPOS_NOTIFICACAO.INFORMACAO,
  titulo,
  mensagem,
  modulo = null,
  referenciaTipo = null,
  referenciaId = null,
  dados = {},
  expiraEm = null
}) {
  try {
    const payload = validarNovaNotificacao({
      destinatario_re: destinatarioRe,
      destinatario_nome: destinatarioNome,
      tipo,
      titulo,
      mensagem,
      modulo,
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
      dados: dados || {},
      expira_em: expiraEm,
      lida: false,
      arquivada: false
    })

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return normalizarNotificacao(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível criar a notificação.')
  }
}

export async function criarNotificacoesEmLote(notificacoes = []) {
  try {
    if (!Array.isArray(notificacoes) || notificacoes.length === 0) {
      return []
    }

    const payload = notificacoes.map(item =>
      validarNovaNotificacao({
        destinatario_re:
          item.destinatarioRe ?? item.destinatario_re,
        destinatario_nome:
          item.destinatarioNome ?? item.destinatario_nome,
        tipo: item.tipo,
        titulo: item.titulo,
        mensagem: item.mensagem,
        modulo: item.modulo,
        referencia_tipo:
          item.referenciaTipo ?? item.referencia_tipo,
        referencia_id:
          item.referenciaId ?? item.referencia_id,
        dados: item.dados || {},
        expira_em:
          item.expiraEm ?? item.expira_em,
        lida: false,
        arquivada: false
      })
    )

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()

    if (error) throw error

    return (data || []).map(normalizarNotificacao)
  } catch (error) {
    tratarErro(error, 'Não foi possível criar as notificações.')
  }
}

export async function listarNotificacoes({
  re,
  apenasNaoLidas = false,
  incluirArquivadas = false,
  limite = 50
} = {}) {
  try {
    const destinatarioRe = normalizarRE(re)

    if (!destinatarioRe) {
      throw new Error('Informe o RE para listar as notificações.')
    }

    const fonte = incluirArquivadas ? TABLE : VIEW_ATIVAS

    let query = supabase
      .from(fonte)
      .select('*')
      .eq('destinatario_re', destinatarioRe)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Number(limite) || 50))

    if (apenasNaoLidas) {
      query = query.eq('lida', false)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(normalizarNotificacao)
  } catch (error) {
    tratarErro(error, 'Não foi possível listar as notificações.')
  }
}

export async function contarNotificacoesNaoLidas(re) {
  try {
    const destinatarioRe = normalizarRE(re)

    if (!destinatarioRe) return 0

    const { count, error } = await supabase
      .from(VIEW_ATIVAS)
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('destinatario_re', destinatarioRe)
      .eq('lida', false)

    if (error) throw error

    return count || 0
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível contar as notificações não lidas.'
    )
  }
}

export async function marcarNotificacaoComoLida({
  notificacaoId,
  destinatarioRe
}) {
  try {
    if (!notificacaoId) {
      throw new Error('Informe a notificação.')
    }

    const re = normalizarRE(destinatarioRe)

    if (!re) {
      throw new Error('Informe o RE do destinatário.')
    }

    const { data, error } = await supabase.rpc(
      'sigmo_marcar_notificacao_lida',
      {
        p_notificacao_id: notificacaoId,
        p_destinatario_re: re
      }
    )

    if (error) throw error

    return Boolean(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível marcar a notificação como lida.')
  }
}

export async function marcarTodasComoLidas(re) {
  try {
    const destinatarioRe = normalizarRE(re)

    if (!destinatarioRe) {
      throw new Error('Informe o RE do destinatário.')
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        lida: true,
        lida_em: new Date().toISOString()
      })
      .eq('destinatario_re', destinatarioRe)
      .eq('lida', false)
      .eq('arquivada', false)
      .select()

    if (error) throw error

    return (data || []).map(normalizarNotificacao)
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível marcar todas as notificações como lidas.'
    )
  }
}

export async function arquivarNotificacao({
  notificacaoId,
  destinatarioRe
}) {
  try {
    if (!notificacaoId) {
      throw new Error('Informe a notificação.')
    }

    const re = normalizarRE(destinatarioRe)

    if (!re) {
      throw new Error('Informe o RE do destinatário.')
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        arquivada: true,
        arquivada_em: new Date().toISOString()
      })
      .eq('id', notificacaoId)
      .eq('destinatario_re', re)
      .select()
      .single()

    if (error) throw error

    return normalizarNotificacao(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível arquivar a notificação.')
  }
}

export async function desarquivarNotificacao({
  notificacaoId,
  destinatarioRe
}) {
  try {
    if (!notificacaoId) {
      throw new Error('Informe a notificação.')
    }

    const re = normalizarRE(destinatarioRe)

    if (!re) {
      throw new Error('Informe o RE do destinatário.')
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        arquivada: false,
        arquivada_em: null
      })
      .eq('id', notificacaoId)
      .eq('destinatario_re', re)
      .select()
      .single()

    if (error) throw error

    return normalizarNotificacao(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível restaurar a notificação.')
  }
}

export async function excluirNotificacao({
  notificacaoId,
  destinatarioRe
}) {
  try {
    if (!notificacaoId) {
      throw new Error('Informe a notificação.')
    }

    const re = normalizarRE(destinatarioRe)

    if (!re) {
      throw new Error('Informe o RE do destinatário.')
    }

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', notificacaoId)
      .eq('destinatario_re', re)

    if (error) throw error

    return true
  } catch (error) {
    tratarErro(error, 'Não foi possível excluir a notificação.')
  }
}

export async function notificarSolicitacaoCriada(solicitacao) {
  if (!solicitacao?.solicitante_re) return null

  return criarNotificacao({
    destinatarioRe: solicitacao.solicitante_re,
    destinatarioNome: solicitacao.solicitante_nome,
    tipo: TIPOS_NOTIFICACAO.SOLICITACAO,
    titulo: 'Solicitação registrada',
    mensagem:
      `A solicitação ${solicitacao.protocolo} foi registrada ` +
      'e aguarda análise.',
    modulo: 'SOLICITACOES',
    referenciaTipo: 'SOLICITACAO',
    referenciaId: solicitacao.id,
    dados: {
      protocolo: solicitacao.protocolo,
      tipo: solicitacao.tipo,
      status: solicitacao.status
    }
  })
}

export async function notificarSolicitacaoAprovada(solicitacao) {
  if (!solicitacao?.solicitante_re) return null

  return criarNotificacao({
    destinatarioRe: solicitacao.solicitante_re,
    destinatarioNome: solicitacao.solicitante_nome,
    tipo: TIPOS_NOTIFICACAO.SUCESSO,
    titulo: 'Solicitação aprovada',
    mensagem:
      `A solicitação ${solicitacao.protocolo} foi aprovada.`,
    modulo: 'SOLICITACOES',
    referenciaTipo: 'SOLICITACAO',
    referenciaId: solicitacao.id,
    dados: {
      protocolo: solicitacao.protocolo,
      tipo: solicitacao.tipo,
      status: solicitacao.status
    }
  })
}

export async function notificarSolicitacaoReprovada(solicitacao) {
  if (!solicitacao?.solicitante_re) return null

  const motivo =
    texto(solicitacao.motivo_reprovacao) ||
    'Consulte os detalhes da solicitação.'

  return criarNotificacao({
    destinatarioRe: solicitacao.solicitante_re,
    destinatarioNome: solicitacao.solicitante_nome,
    tipo: TIPOS_NOTIFICACAO.ALERTA,
    titulo: 'Solicitação reprovada',
    mensagem:
      `A solicitação ${solicitacao.protocolo} foi reprovada. ` +
      `Motivo: ${motivo}`,
    modulo: 'SOLICITACOES',
    referenciaTipo: 'SOLICITACAO',
    referenciaId: solicitacao.id,
    dados: {
      protocolo: solicitacao.protocolo,
      tipo: solicitacao.tipo,
      status: solicitacao.status,
      motivo
    }
  })
}

export function assinarNotificacoes(re, callback) {
  const destinatarioRe = normalizarRE(re)

  if (!destinatarioRe || typeof callback !== 'function') {
    return () => {}
  }

  const channel = supabase
    .channel(`sigmo-notificacoes-${destinatarioRe}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `destinatario_re=eq.${destinatarioRe}`
      },
      payload => {
        callback({
          eventType: payload.eventType,
          nova: normalizarNotificacao(payload.new),
          anterior: normalizarNotificacao(payload.old)
        })
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}