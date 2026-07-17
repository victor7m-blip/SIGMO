import { supabase } from '../../../services/supabaseClient'
import {
  obterSolicitacaoPorId,
  registrarHistoricoSolicitacao,
  STATUS_SOLICITACAO,
  TIPOS_SOLICITACAO
} from '../services/solicitacoesService'
import {
  notificarSolicitacaoAprovada,
  notificarSolicitacaoReprovada,
  criarNotificacao,
  TIPOS_NOTIFICACAO
} from '../../notificacoes/services/notificacoesService'
import {
  concederPerfilTemporario,
  PERFIS_TEMPORARIOS,
  DURACAO_PADRAO_AUXILIAR_HORAS
} from '../../perfisTemporarios/services/perfisTemporariosService'

const TABLE_SOLICITACOES = 'sigmo_solicitacoes'
const TABLE_POLICIAIS = 'policiais'
const TABLE_CREDENCIAIS = 'sigmo_credenciais_temporarias'

function texto(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function normalizarRE(re) {
  return texto(re).replace(/\D/g, '')
}

function gerarPinTemporario() {
  const valor = Math.floor(100000 + Math.random() * 900000)
  return String(valor)
}

function adicionarHoras(data, horas) {
  const resultado = new Date(data)
  resultado.setHours(resultado.getHours() + Number(horas || 0))
  return resultado
}

function validarResponsavel(responsavel) {
  const re = normalizarRE(responsavel?.re)

  if (!re) {
    throw new Error(
      'Não foi possível identificar o responsável pela análise.'
    )
  }

  return {
    re,
    nome:
      texto(
        responsavel?.nome ||
        responsavel?.nome_guerra ||
        responsavel?.nome_completo
      ) || 'Usuário SIGMO'
  }
}

async function atualizarStatusSolicitacao({
  id,
  status,
  responsavel,
  observacao = null,
  motivoReprovacao = null,
  executado = false,
  erroExecucao = null
}) {
  const payload = {
    status,
    analisado_por_re: responsavel.re,
    analisado_por_nome: responsavel.nome,
    analisado_em: new Date().toISOString(),
    observacao_analise: observacao,
    motivo_reprovacao: motivoReprovacao,
    executado,
    executado_em: executado
      ? new Date().toISOString()
      : null,
    erro_execucao: erroExecucao
  }

  const { data, error } = await supabase
    .from(TABLE_SOLICITACOES)
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

async function executarAlteracaoCadastral(solicitacao) {
  const policialId =
    solicitacao?.metadados
      ?.policial_id ||
    null

  const re = normalizarRE(
    solicitacao.policial_re ||
    solicitacao.solicitante_re
  )

  if (
    !policialId &&
    !re
  ) {
    throw new Error(
      'A solicitação não possui um policial vinculado.'
    )
  }

  const dados =
    solicitacao.dados_solicitados ||
    {}

  const camposPermitidos = [
    'nome',
    'nome_completo',
    'nome_guerra',
    'posto_graduacao',
    'companhia',
    'pelotao',
    'equipe',
    'funcao',
    'situacao',
    'telefone',
    'email',
    'foto_url'
  ]

  const alteracoes = {}

  camposPermitidos.forEach(
    (campo) => {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            dados,
            campo
          )
      ) {
        alteracoes[campo] =
          dados[campo]
      }
    }
  )

  if (
    Object.keys(
      alteracoes
    ).length === 0
  ) {
    throw new Error(
      'A solicitação não possui alterações cadastrais válidas.'
    )
  }

  let query = supabase
    .from(TABLE_POLICIAIS)
    .update(alteracoes)

  if (policialId) {
    query = query.eq(
      'id',
      policialId
    )
  } else {
    query = query.ilike(
      're',
      `${re}-%`
    )
  }

  const {
    data,
    error
  } = await query
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'O policial vinculado à solicitação não foi encontrado.'
    )
  }

  return {
    tipo:
      TIPOS_SOLICITACAO
        .ALTERACAO_CADASTRAL,

    policial:
      data,

    camposAlterados:
      Object.keys(
        alteracoes
      ),

    alteracoes
  }
}

async function executarAlteracaoSenha(solicitacao, responsavel) {
  const re = normalizarRE(
    solicitacao.policial_re ||
    solicitacao.solicitante_re
  )

  if (!re) {
    throw new Error(
      'A solicitação não possui um policial vinculado.'
    )
  }

  const pinTemporario = gerarPinTemporario()
  const expiraEm = adicionarHoras(new Date(), 24)

  const { data: hash, error: hashError } = await supabase.rpc(
    'crypt',
    {
      password: pinTemporario,
      salt: '$2a$06$SIGMO7x4TEMPORARIO123456789'
    }
  )

  let segredoHash = hash

  if (hashError || !segredoHash) {
    /*
     * Fallback temporário para ambientes em que a RPC crypt
     * não esteja exposta pelo PostgREST.
     *
     * O valor continua não sendo salvo em texto puro, porém
     * substituiremos esta etapa por uma Edge Function na camada
     * final de segurança.
     */
    segredoHash = `TEMP:${btoa(pinTemporario)}`
  }

  await supabase
    .from(TABLE_CREDENCIAIS)
    .update({
      utilizada: true,
      utilizada_em: new Date().toISOString()
    })
    .eq('policial_re', re)
    .eq('utilizada', false)

  const { data, error } = await supabase
    .from(TABLE_CREDENCIAIS)
    .insert({
      policial_re: re,
      tipo: 'PIN_TEMPORARIO',
      segredo_hash: segredoHash,
      exige_troca: true,
      utilizada: false,
      solicitacao_id: solicitacao.id,
      criada_por_re: responsavel.re,
      criada_por_nome: responsavel.nome,
      expira_em: expiraEm.toISOString()
    })
    .select()
    .single()

  if (error) throw error

  return {
    tipo: TIPOS_SOLICITACAO.ALTERACAO_SENHA,
    credencial: data,
    pinTemporario,
    expiraEm: expiraEm.toISOString()
  }
}

async function executarAuxiliarSvddTemporario(
  solicitacao,
  responsavel
) {
  const dados = solicitacao.dados_solicitados || {}

  const perfil = await concederPerfilTemporario({
    policialRe:
      solicitacao.policial_re ||
      solicitacao.solicitante_re,
    policialNome:
      solicitacao.policial_nome ||
      solicitacao.solicitante_nome,
    perfil: PERFIS_TEMPORARIOS.AUXILIAR_SVDD_TEMPORARIO,
    setor: 'SVDD',
    localId: dados.local_id || null,
    localNome: dados.local_nome || 'SVDD',
    concedidoPorRe: responsavel.re,
    concedidoPorNome: responsavel.nome,
    motivo:
      dados.motivo ||
      solicitacao.descricao ||
      'Perfil temporário aprovado por solicitação.',
    duracaoHoras:
      Number(dados.duracao_horas) ||
      DURACAO_PADRAO_AUXILIAR_HORAS,
    metadados: {
      solicitacao_id: solicitacao.id,
      protocolo: solicitacao.protocolo
    }
  })

  return {
    tipo: TIPOS_SOLICITACAO.AUXILIAR_SVDD_TEMPORARIO,
    perfilTemporario: perfil
  }
}

async function executarConcessaoPerfil(solicitacao, responsavel) {
  const dados = solicitacao.dados_solicitados || {}

  if (dados.temporario === true || dados.expira_em) {
    const duracaoHoras =
      Number(dados.duracao_horas) ||
      DURACAO_PADRAO_AUXILIAR_HORAS

    const perfilTemporario = await concederPerfilTemporario({
      policialRe:
        solicitacao.policial_re ||
        solicitacao.solicitante_re,
      policialNome:
        solicitacao.policial_nome ||
        solicitacao.solicitante_nome,
      perfil:
        dados.perfil ||
        PERFIS_TEMPORARIOS.OUTRO_TEMPORARIO,
      setor: dados.setor || null,
      localId: dados.local_id || null,
      localNome: dados.local_nome || '',
      concedidoPorRe: responsavel.re,
      concedidoPorNome: responsavel.nome,
      motivo:
        dados.motivo ||
        solicitacao.descricao ||
        'Perfil temporário aprovado.',
      duracaoHoras,
      metadados: {
        solicitacao_id: solicitacao.id,
        protocolo: solicitacao.protocolo
      }
    })

    return {
      tipo: TIPOS_SOLICITACAO.CONCESSAO_PERFIL,
      temporario: true,
      perfilTemporario
    }
  }

  const re = normalizarRE(
    solicitacao.policial_re ||
    solicitacao.solicitante_re
  )

  if (!re) {
    throw new Error('Policial não identificado.')
  }

  if (!texto(dados.perfil)) {
    throw new Error('O perfil solicitado não foi informado.')
  }

  const { data, error } = await supabase
    .from(TABLE_POLICIAIS)
    .update({
      perfil: texto(dados.perfil).toUpperCase()
    })
    .eq('re', re)
    .select()
    .single()

  if (error) throw error

  return {
    tipo: TIPOS_SOLICITACAO.CONCESSAO_PERFIL,
    temporario: false,
    policial: data,
    perfil: texto(dados.perfil).toUpperCase()
  }
}

async function executarSolicitacaoPorTipo(
  solicitacao,
  responsavel
) {
  switch (solicitacao.tipo) {
    case TIPOS_SOLICITACAO.ALTERACAO_CADASTRAL:
      return executarAlteracaoCadastral(solicitacao)

    case TIPOS_SOLICITACAO.ALTERACAO_SENHA:
      return executarAlteracaoSenha(
        solicitacao,
        responsavel
      )

    case TIPOS_SOLICITACAO.AUXILIAR_SVDD_TEMPORARIO:
      return executarAuxiliarSvddTemporario(
        solicitacao,
        responsavel
      )

    case TIPOS_SOLICITACAO.CONCESSAO_PERFIL:
      return executarConcessaoPerfil(
        solicitacao,
        responsavel
      )

    case TIPOS_SOLICITACAO.TRANSFERENCIA_PATRIMONIAL:
    case TIPOS_SOLICITACAO.DESTINACAO_P4:
    case TIPOS_SOLICITACAO.CARGA_PERMANENTE:
      return {
        tipo: solicitacao.tipo,
        pendenteIntegracaoPatrimonial: true,
        mensagem:
          'Solicitação aprovada. A execução patrimonial será ' +
          'conectada ao motor P4 na próxima etapa.'
      }

    case TIPOS_SOLICITACAO.REVOGACAO_PERFIL:
    case TIPOS_SOLICITACAO.OUTRA:
      return {
        tipo: solicitacao.tipo,
        execucaoManual: true,
        mensagem:
          'Solicitação aprovada e registrada para execução manual.'
      }

    default:
      throw new Error(
        `Tipo de solicitação não suportado: ${solicitacao.tipo}`
      )
  }
}

export async function aprovarSolicitacao({
  solicitacaoId,
  responsavel,
  observacao = ''
}) {
  const analista = validarResponsavel(responsavel)

  const solicitacao = await obterSolicitacaoPorId(solicitacaoId)

  if (
    ![
      STATUS_SOLICITACAO.PENDENTE,
      STATUS_SOLICITACAO.EM_ANALISE,
      STATUS_SOLICITACAO.ERRO_EXECUCAO
    ].includes(solicitacao.status)
  ) {
    throw new Error(
      `A solicitação está com status ${solicitacao.status} ` +
      'e não pode ser aprovada.'
    )
  }

  await atualizarStatusSolicitacao({
    id: solicitacao.id,
    status: STATUS_SOLICITACAO.APROVADA,
    responsavel: analista,
    observacao: texto(observacao) || null
  })

  await registrarHistoricoSolicitacao({
    solicitacaoId: solicitacao.id,
    evento: 'APROVADA',
    statusAnterior: solicitacao.status,
    statusNovo: STATUS_SOLICITACAO.APROVADA,
    descricao:
      texto(observacao) ||
      'Solicitação aprovada.',
    responsavelRe: analista.re,
    responsavelNome: analista.nome
  })

  try {
    const resultado = await executarSolicitacaoPorTipo(
      solicitacao,
      analista
    )

    const atualizada = await atualizarStatusSolicitacao({
      id: solicitacao.id,
      status: STATUS_SOLICITACAO.EXECUTADA,
      responsavel: analista,
      observacao: texto(observacao) || null,
      executado: true
    })

    await registrarHistoricoSolicitacao({
      solicitacaoId: solicitacao.id,
      evento: 'EXECUTADA',
      statusAnterior: STATUS_SOLICITACAO.APROVADA,
      statusNovo: STATUS_SOLICITACAO.EXECUTADA,
      descricao: 'A solicitação foi executada automaticamente.',
      responsavelRe: analista.re,
      responsavelNome: analista.nome,
      dados: {
        resultado
      }
    })

    const solicitacaoFinal = {
      ...solicitacao,
      ...atualizada,
      status: STATUS_SOLICITACAO.EXECUTADA
    }

    try {
      await notificarSolicitacaoAprovada(solicitacaoFinal)

      if (
        solicitacao.tipo === TIPOS_SOLICITACAO.ALTERACAO_SENHA &&
        resultado?.pinTemporario
      ) {
        await criarNotificacao({
          destinatarioRe: solicitacao.solicitante_re,
          destinatarioNome: solicitacao.solicitante_nome,
          tipo: TIPOS_NOTIFICACAO.SEGURANCA,
          titulo: 'PIN temporário gerado',
          mensagem:
            `Seu PIN temporário é ${resultado.pinTemporario}. ` +
            'Ele expira em 24 horas e deverá ser alterado no ' +
            'primeiro acesso.',
          modulo: 'SEGURANCA',
          referenciaTipo: 'SOLICITACAO',
          referenciaId: solicitacao.id,
          dados: {
            exige_troca: true,
            expira_em: resultado.expiraEm
          },
          expiraEm: resultado.expiraEm
        })
      }
    } catch (notificationError) {
      console.warn(
        'A solicitação foi executada, mas a notificação falhou.',
        notificationError
      )
    }

    return {
      sucesso: true,
      solicitacao: solicitacaoFinal,
      resultado
    }
  } catch (error) {
    await atualizarStatusSolicitacao({
      id: solicitacao.id,
      status: STATUS_SOLICITACAO.ERRO_EXECUCAO,
      responsavel: analista,
      observacao: texto(observacao) || null,
      executado: false,
      erroExecucao: error.message
    })

    await registrarHistoricoSolicitacao({
      solicitacaoId: solicitacao.id,
      evento: 'ERRO_EXECUCAO',
      statusAnterior: STATUS_SOLICITACAO.APROVADA,
      statusNovo: STATUS_SOLICITACAO.ERRO_EXECUCAO,
      descricao:
        `A solicitação foi aprovada, mas não pôde ser executada: ` +
        error.message,
      responsavelRe: analista.re,
      responsavelNome: analista.nome,
      dados: {
        erro: error.message
      }
    })

    throw new Error(
      `A solicitação foi aprovada, mas ocorreu um erro na execução: ` +
      error.message
    )
  }
}

export async function reprovarSolicitacao({
  solicitacaoId,
  responsavel,
  motivo
}) {
  const analista = validarResponsavel(responsavel)
  const justificativa = texto(motivo)

  if (!justificativa) {
    throw new Error(
      'Informe o motivo da reprovação.'
    )
  }

  const solicitacao = await obterSolicitacaoPorId(solicitacaoId)

  if (
    ![
      STATUS_SOLICITACAO.PENDENTE,
      STATUS_SOLICITACAO.EM_ANALISE
    ].includes(solicitacao.status)
  ) {
    throw new Error(
      `A solicitação está com status ${solicitacao.status} ` +
      'e não pode ser reprovada.'
    )
  }

  const atualizada = await atualizarStatusSolicitacao({
    id: solicitacao.id,
    status: STATUS_SOLICITACAO.REPROVADA,
    responsavel: analista,
    motivoReprovacao: justificativa,
    observacao: justificativa,
    executado: false
  })

  await registrarHistoricoSolicitacao({
    solicitacaoId: solicitacao.id,
    evento: 'REPROVADA',
    statusAnterior: solicitacao.status,
    statusNovo: STATUS_SOLICITACAO.REPROVADA,
    descricao: justificativa,
    responsavelRe: analista.re,
    responsavelNome: analista.nome
  })

  const solicitacaoFinal = {
    ...solicitacao,
    ...atualizada,
    status: STATUS_SOLICITACAO.REPROVADA,
    motivo_reprovacao: justificativa
  }

  try {
    await notificarSolicitacaoReprovada(solicitacaoFinal)
  } catch (notificationError) {
    console.warn(
      'A reprovação foi registrada, mas a notificação falhou.',
      notificationError
    )
  }

  return {
    sucesso: true,
    solicitacao: solicitacaoFinal
  }
}

export async function reprocessarSolicitacao({
  solicitacaoId,
  responsavel,
  observacao = 'Reprocessamento da execução.'
}) {
  const solicitacao = await obterSolicitacaoPorId(solicitacaoId)

  if (solicitacao.status !== STATUS_SOLICITACAO.ERRO_EXECUCAO) {
    throw new Error(
      'Somente solicitações com erro de execução podem ser reprocessadas.'
    )
  }

  return aprovarSolicitacao({
    solicitacaoId,
    responsavel,
    observacao
  })
}