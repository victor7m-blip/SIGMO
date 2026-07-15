import { supabase } from '../../../services/supabaseClient'
import {
  notificarSolicitacaoCriada
} from '../../notificacoes/services/notificacoesService'

const TABLE = 'sigmo_solicitacoes'
const VIEW_RESUMO = 'sigmo_solicitacoes_resumo'
const TABLE_HISTORICO = 'sigmo_solicitacoes_historico'

export const TIPOS_SOLICITACAO = {
  ALTERACAO_CADASTRAL: 'ALTERACAO_CADASTRAL',
  ALTERACAO_SENHA: 'ALTERACAO_SENHA',
  CONCESSAO_PERFIL: 'CONCESSAO_PERFIL',
  REVOGACAO_PERFIL: 'REVOGACAO_PERFIL',
  AUXILIAR_SVDD_TEMPORARIO: 'AUXILIAR_SVDD_TEMPORARIO',
  TRANSFERENCIA_PATRIMONIAL: 'TRANSFERENCIA_PATRIMONIAL',
  DESTINACAO_P4: 'DESTINACAO_P4',
  CARGA_PERMANENTE: 'CARGA_PERMANENTE',
  OUTRA: 'OUTRA'
}

export const STATUS_SOLICITACAO = {
  PENDENTE: 'PENDENTE',
  EM_ANALISE: 'EM_ANALISE',
  APROVADA: 'APROVADA',
  REPROVADA: 'REPROVADA',
  CANCELADA: 'CANCELADA',
  EXECUTADA: 'EXECUTADA',
  ERRO_EXECUCAO: 'ERRO_EXECUCAO'
}

export const PRIORIDADES_SOLICITACAO = {
  BAIXA: 'BAIXA',
  NORMAL: 'NORMAL',
  ALTA: 'ALTA',
  URGENTE: 'URGENTE'
}

function texto(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function normalizarRE(re) {
  return texto(re).replace(/\D/g, '')
}

function normalizarSolicitacao(solicitacao) {
  if (!solicitacao) return null

  return {
    ...solicitacao,
    solicitante_re: normalizarRE(solicitacao.solicitante_re),
    policial_re: normalizarRE(solicitacao.policial_re),
    analisado_por_re: normalizarRE(solicitacao.analisado_por_re),
    tipo: texto(solicitacao.tipo).toUpperCase(),
    status: texto(solicitacao.status).toUpperCase(),
    prioridade: texto(solicitacao.prioridade).toUpperCase(),
    executado: Boolean(solicitacao.executado),
    dados_atuais: solicitacao.dados_atuais || {},
    dados_solicitados: solicitacao.dados_solicitados || {},
    metadados: solicitacao.metadados || {}
  }
}

function tratarErro(error, mensagemPadrao) {
  console.error(mensagemPadrao, error)

  throw new Error(
    error?.message ||
    error?.details ||
    error?.hint ||
    mensagemPadrao
  )
}

function validarNovaSolicitacao(dados) {
  const solicitanteRe = normalizarRE(dados.solicitanteRe)

  if (!solicitanteRe) {
    throw new Error('O RE do solicitante é obrigatório.')
  }

  if (!texto(dados.tipo)) {
    throw new Error('O tipo da solicitação é obrigatório.')
  }

  if (!texto(dados.titulo)) {
    throw new Error('O título da solicitação é obrigatório.')
  }

  return {
    protocolo: texto(dados.protocolo) || null,
    tipo: texto(dados.tipo).toUpperCase(),
    titulo: texto(dados.titulo),
    descricao: texto(dados.descricao) || null,
    solicitante_re: solicitanteRe,
    solicitante_nome: texto(dados.solicitanteNome),
    policial_re:
      normalizarRE(dados.policialRe) || solicitanteRe,
    policial_nome:
      texto(dados.policialNome) ||
      texto(dados.solicitanteNome),
    status: STATUS_SOLICITACAO.PENDENTE,
    prioridade:
      texto(dados.prioridade || PRIORIDADES_SOLICITACAO.NORMAL)
        .toUpperCase(),
    dados_atuais: dados.dadosAtuais || {},
    dados_solicitados: dados.dadosSolicitados || {},
    metadados: dados.metadados || {},
    origem: texto(dados.origem || 'SIGMO'),
    modulo: texto(dados.modulo) || null,
    executado: false
  }
}

export async function criarSolicitacao(dados) {
  try {
    const payload = validarNovaSolicitacao(dados)

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    const solicitacao = normalizarSolicitacao(data)

    try {
      await notificarSolicitacaoCriada(solicitacao)

      await registrarHistoricoSolicitacao({
        solicitacaoId: solicitacao.id,
        evento: 'NOTIFICACAO_ENVIADA',
        statusAnterior: solicitacao.status,
        statusNovo: solicitacao.status,
        descricao: 'Notificação de criação enviada ao solicitante.',
        responsavelRe: solicitacao.solicitante_re,
        responsavelNome: solicitacao.solicitante_nome
      })
    } catch (notificationError) {
      console.warn(
        'A solicitação foi criada, mas a notificação falhou.',
        notificationError
      )
    }

    return solicitacao
  } catch (error) {
    tratarErro(error, 'Não foi possível criar a solicitação.')
  }
}

export async function listarSolicitacoes({
  status = '',
  tipo = '',
  solicitanteRe = '',
  policialRe = '',
  busca = '',
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  try {
    const paginaAtual = Math.max(1, Number(pagina) || 1)
    const limiteAtual = Math.max(1, Number(limite) || 20)
    const inicio = (paginaAtual - 1) * limiteAtual
    const fim = inicio + limiteAtual - 1

    let query = supabase
      .from(VIEW_RESUMO)
      .select('*', { count: 'exact' })
      .order(sortBy, {
        ascending: sortDirection === 'asc',
        nullsFirst: false
      })
      .range(inicio, fim)

    if (texto(status)) {
      query = query.eq('status', texto(status).toUpperCase())
    }

    if (texto(tipo)) {
      query = query.eq('tipo', texto(tipo).toUpperCase())
    }

    const reSolicitante = normalizarRE(solicitanteRe)

    if (reSolicitante) {
      query = query.eq('solicitante_re', reSolicitante)
    }

    const rePolicial = normalizarRE(policialRe)

    if (rePolicial) {
      query = query.eq('policial_re', rePolicial)
    }

    const termo = texto(busca)

    if (termo) {
      query = query.or(
        [
          `protocolo.ilike.%${termo}%`,
          `titulo.ilike.%${termo}%`,
          `descricao.ilike.%${termo}%`,
          `solicitante_nome.ilike.%${termo}%`,
          `policial_nome.ilike.%${termo}%`,
          `solicitante_re.ilike.%${termo}%`,
          `policial_re.ilike.%${termo}%`
        ].join(',')
      )
    }

    const { data, count, error } = await query

    if (error) throw error

    return {
      itens: (data || []).map(normalizarSolicitacao),
      total: count || 0,
      pagina: paginaAtual,
      limite: limiteAtual,
      totalPaginas: Math.max(
        1,
        Math.ceil((count || 0) / limiteAtual)
      )
    }
  } catch (error) {
    tratarErro(error, 'Não foi possível listar as solicitações.')
  }
}

export async function obterSolicitacaoPorId(id) {
  try {
    if (!id) {
      throw new Error('Informe a solicitação.')
    }

    const { data, error } = await supabase
      .from(VIEW_RESUMO)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return normalizarSolicitacao(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível carregar a solicitação.')
  }
}

export async function obterSolicitacaoPorProtocolo(protocolo) {
  try {
    const codigo = texto(protocolo).toUpperCase()

    if (!codigo) {
      throw new Error('Informe o protocolo.')
    }

    const { data, error } = await supabase
      .from(VIEW_RESUMO)
      .select('*')
      .eq('protocolo', codigo)
      .single()

    if (error) throw error

    return normalizarSolicitacao(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível localizar a solicitação.')
  }
}

export async function atualizarSolicitacaoPendente({
  id,
  titulo,
  descricao,
  prioridade,
  dadosSolicitados,
  metadados,
  responsavelRe,
  responsavelNome
}) {
  try {
    const atual = await obterSolicitacaoPorId(id)

    if (atual.status !== STATUS_SOLICITACAO.PENDENTE) {
      throw new Error(
        'Somente solicitações pendentes podem ser alteradas.'
      )
    }

    const alteracoes = {}

    if (titulo !== undefined) {
      alteracoes.titulo = texto(titulo)
    }

    if (descricao !== undefined) {
      alteracoes.descricao = texto(descricao) || null
    }

    if (prioridade !== undefined) {
      alteracoes.prioridade = texto(prioridade).toUpperCase()
    }

    if (dadosSolicitados !== undefined) {
      alteracoes.dados_solicitados = dadosSolicitados || {}
    }

    if (metadados !== undefined) {
      alteracoes.metadados = metadados || {}
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(alteracoes)
      .eq('id', id)
      .eq('status', STATUS_SOLICITACAO.PENDENTE)
      .select()
      .single()

    if (error) throw error

    const solicitacao = normalizarSolicitacao(data)

    await registrarHistoricoSolicitacao({
      solicitacaoId: id,
      evento: 'ATUALIZADA',
      statusAnterior: atual.status,
      statusNovo: solicitacao.status,
      descricao: 'Solicitação pendente atualizada.',
      responsavelRe,
      responsavelNome,
      dados: {
        alteracoes
      }
    })

    return solicitacao
  } catch (error) {
    tratarErro(error, 'Não foi possível atualizar a solicitação.')
  }
}

export async function iniciarAnaliseSolicitacao({
  id,
  analisadoPorRe,
  analisadoPorNome = ''
}) {
  try {
    const atual = await obterSolicitacaoPorId(id)

    if (atual.status !== STATUS_SOLICITACAO.PENDENTE) {
      throw new Error(
        'A solicitação não está disponível para iniciar análise.'
      )
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: STATUS_SOLICITACAO.EM_ANALISE,
        analisado_por_re: normalizarRE(analisadoPorRe),
        analisado_por_nome: texto(analisadoPorNome),
        analisado_em: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', STATUS_SOLICITACAO.PENDENTE)
      .select()
      .single()

    if (error) throw error

    const solicitacao = normalizarSolicitacao(data)

    await registrarHistoricoSolicitacao({
      solicitacaoId: id,
      evento: 'INICIO_ANALISE',
      statusAnterior: atual.status,
      statusNovo: solicitacao.status,
      descricao: 'Análise da solicitação iniciada.',
      responsavelRe: analisadoPorRe,
      responsavelNome: analisadoPorNome
    })

    return solicitacao
  } catch (error) {
    tratarErro(error, 'Não foi possível iniciar a análise.')
  }
}

export async function cancelarSolicitacao({
  id,
  canceladoPorRe,
  canceladoPorNome = '',
  motivo = ''
}) {
  try {
    const atual = await obterSolicitacaoPorId(id)

    if (
      ![
        STATUS_SOLICITACAO.PENDENTE,
        STATUS_SOLICITACAO.EM_ANALISE
      ].includes(atual.status)
    ) {
      throw new Error(
        'Esta solicitação não pode mais ser cancelada.'
      )
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: STATUS_SOLICITACAO.CANCELADA,
        observacao_analise: texto(motivo) || null
      })
      .eq('id', id)
      .in('status', [
        STATUS_SOLICITACAO.PENDENTE,
        STATUS_SOLICITACAO.EM_ANALISE
      ])
      .select()
      .single()

    if (error) throw error

    const solicitacao = normalizarSolicitacao(data)

    await registrarHistoricoSolicitacao({
      solicitacaoId: id,
      evento: 'CANCELADA',
      statusAnterior: atual.status,
      statusNovo: solicitacao.status,
      descricao:
        texto(motivo) || 'Solicitação cancelada.',
      responsavelRe: canceladoPorRe,
      responsavelNome: canceladoPorNome
    })

    return solicitacao
  } catch (error) {
    tratarErro(error, 'Não foi possível cancelar a solicitação.')
  }
}

export async function registrarHistoricoSolicitacao({
  solicitacaoId,
  evento,
  statusAnterior = null,
  statusNovo = null,
  descricao = '',
  responsavelRe = '',
  responsavelNome = '',
  dados = {}
}) {
  try {
    if (!solicitacaoId) {
      throw new Error('Informe a solicitação do histórico.')
    }

    if (!texto(evento)) {
      throw new Error('Informe o evento do histórico.')
    }

    const payload = {
      solicitacao_id: solicitacaoId,
      evento: texto(evento).toUpperCase(),
      status_anterior:
        texto(statusAnterior).toUpperCase() || null,
      status_novo:
        texto(statusNovo).toUpperCase() || null,
      descricao: texto(descricao) || null,
      responsavel_re:
        normalizarRE(responsavelRe) || null,
      responsavel_nome:
        texto(responsavelNome) || null,
      dados: dados || {}
    }

    const { data, error } = await supabase
      .from(TABLE_HISTORICO)
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível registrar o histórico da solicitação.'
    )
  }
}

export async function listarHistoricoSolicitacao(solicitacaoId) {
  try {
    if (!solicitacaoId) return []

    const { data, error } = await supabase
      .from(TABLE_HISTORICO)
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return data || []
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível carregar o histórico da solicitação.'
    )
  }
}

export async function contarSolicitacoesPendentes() {
  try {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', {
        count: 'exact',
        head: true
      })
      .in('status', [
        STATUS_SOLICITACAO.PENDENTE,
        STATUS_SOLICITACAO.EM_ANALISE
      ])

    if (error) throw error

    return count || 0
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível contar as solicitações pendentes.'
    )
  }
}

export function assinarSolicitacoes(callback) {
  if (typeof callback !== 'function') {
    return () => {}
  }

  const channel = supabase
    .channel('sigmo-solicitacoes-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE
      },
      payload => {
        callback({
          eventType: payload.eventType,
          nova: normalizarSolicitacao(payload.new),
          anterior: normalizarSolicitacao(payload.old)
        })
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}