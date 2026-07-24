import {
  buscarPatrimonioPorId,
  registrarMovimentacao
} from '../../../services/patrimonioMovimentacaoService'

import {
  criarNotificacaoParaPerfil
} from '../../../services/notificacoesService'

import {
  registerAudit
} from '../../../services/auditoriaService'

import {
  GESTOR_PATRIMONIAL_PADRAO,
  GUARDIOES_PATRIMONIAIS,
  STATUS_PATRIMONIAL,
  TIPOS_MOVIMENTACAO_PATRIMONIAL,
  criarGuardiaoPatrimonial,
  guardiaoEhP4,
  normalizarCodigoPatrimonial
} from '../constants/patrimonioCore'

function texto(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null
  }

  const resultado =
    String(valor).trim()

  return resultado || null
}

function numeroPositivo(
  valor,
  fallback = 1
) {
  const numero = Number(valor)

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return fallback
  }

  return numero
}

function normalizarData(valor) {
  if (!valor) {
    return null
  }

  const data = new Date(valor)

  if (
    Number.isNaN(data.getTime())
  ) {
    throw new Error(
      'A data informada para a movimentação é inválida.'
    )
  }

  return data.toISOString()
}

function obterDadosPatrimonio(
  patrimonio
) {
  if (
    patrimonio?.dados &&
    typeof patrimonio.dados === 'object' &&
    !Array.isArray(patrimonio.dados)
  ) {
    return patrimonio.dados
  }

  return {}
}

function obterIdentificacao(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return (
    dados.patrimonio ||
    dados.numero_patrimonio ||
    dados.numero_serie ||
    dados.descricao ||
    dados.modelo ||
    patrimonio?.referencia_id ||
    patrimonio?.id ||
    'PATRIMÔNIO'
  )
}

function obterQuantidadeTotal(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return numeroPositivo(
    dados.quantidade ??
    patrimonio?.quantidade ??
    1
  )
}

function validarGuardiao(
  guardiao,
  campo
) {
  if (!guardiao) {
    throw new Error(
      `${campo} é obrigatório.`
    )
  }

  return criarGuardiaoPatrimonial(
    guardiao
  )
}

function definirStatusDestino({
  tipo,
  guardiaoDestino,
  statusNovo
}) {
  if (statusNovo) {
    return normalizarCodigoPatrimonial(
      statusNovo
    )
  }

  if (
    tipo ===
    TIPOS_MOVIMENTACAO_PATRIMONIAL.BAIXA
  ) {
    return STATUS_PATRIMONIAL.BAIXADO
  }

  if (
    tipo ===
    TIPOS_MOVIMENTACAO_PATRIMONIAL.MANUTENCAO
  ) {
    return STATUS_PATRIMONIAL.MANUTENCAO
  }

  if (
    tipo ===
    TIPOS_MOVIMENTACAO_PATRIMONIAL.CARGA_PERMANENTE
  ) {
    return STATUS_PATRIMONIAL.CARGA
  }

  if (
    tipo ===
      TIPOS_MOVIMENTACAO_PATRIMONIAL.CAUTELA_SERVICO ||
    guardiaoDestino?.codigo ===
      GUARDIOES_PATRIMONIAIS.SERVICO_DIA.codigo
  ) {
    return STATUS_PATRIMONIAL.EM_SERVICO
  }

  if (
    tipo ===
    TIPOS_MOVIMENTACAO_PATRIMONIAL.EMPRESTIMO
  ) {
    return STATUS_PATRIMONIAL.EMPRESTADO
  }

  if (
    guardiaoEhP4(
      guardiaoDestino
    )
  ) {
    return STATUS_PATRIMONIAL.RESERVA
  }

  return null
}

function montarDescricaoAuditoria({
  tipo,
  identificacao,
  quantidade,
  origem,
  destino
}) {
  return (
    `${tipo}: ${quantidade} unidade(s) de ` +
    `${identificacao}, de ${origem.nome} ` +
    `para ${destino.nome}.`
  )
}

async function notificarComandante({
  patrimonio,
  tipo,
  quantidade,
  origem,
  destino,
  usuario,
  devolucaoPrevista,
  observacoes
}) {
  if (
    !guardiaoEhP4(origem) ||
    guardiaoEhP4(destino)
  ) {
    return null
  }

  const identificacao =
    obterIdentificacao(patrimonio)

  const prazoTexto =
    devolucaoPrevista
      ? new Intl.DateTimeFormat(
          'pt-BR',
          {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone:
              'America/Sao_Paulo'
          }
        ).format(
          new Date(
            devolucaoPrevista
          )
        )
      : 'SEM PRAZO'

  return criarNotificacaoParaPerfil({
    perfil:
      'COMANDANTE DE CIA',

    titulo:
      'MOVIMENTAÇÃO PATRIMONIAL — SAÍDA DO P4',

    mensagem:
      `${quantidade} unidade(s) de ${identificacao} ` +
      `foram movimentadas de ${origem.nome} ` +
      `para ${destino.nome}. ` +
      `Prazo: ${prazoTexto}.`,

    tipo:
      'INFORMATIVO',

    modulo:
      'PATRIMONIO',

    prioridade:
      devolucaoPrevista
        ? 'ALTA'
        : 'NORMAL',

    metadata: {
      patrimonio_id:
        patrimonio.id,

      referencia_id:
        patrimonio.referencia_id ||
        null,

      categoria:
        patrimonio.tipo ||
        null,

      tipo_movimentacao:
        tipo,

      quantidade,

      origem,

      destino,

      devolucao_prevista:
        devolucaoPrevista,

      realizado_por:
        usuario
          ? {
              id:
                usuario.id ||
                null,

              re:
                usuario.re ||
                null,

              nome:
                usuario.nome_guerra ||
                usuario.nome ||
                null
            }
          : null,

      observacoes:
        texto(observacoes)
    }
  })
}

export async function movimentarPatrimonio({
  patrimonioId,

  tipo,

  origem,

  destino,

  quantidade = 1,

  statusNovo = null,

  localDestino = null,

  companhiaDestino = null,

  devolucaoPrevista = null,

  motivo = null,

  observacoes = null,

  dados = {},

  usuario = null
}) {
  if (!patrimonioId) {
    throw new Error(
      'O patrimônio é obrigatório.'
    )
  }

  const tipoNormalizado =
    normalizarCodigoPatrimonial(tipo)

  if (!tipoNormalizado) {
    throw new Error(
      'O tipo da movimentação é obrigatório.'
    )
  }

  const guardiaoOrigem =
    validarGuardiao(
      origem,
      'O guardião de origem'
    )

  const guardiaoDestino =
    validarGuardiao(
      destino,
      'O guardião de destino'
    )

  if (
    guardiaoOrigem.codigo ===
    guardiaoDestino.codigo
  ) {
    throw new Error(
      'O guardião de origem e o guardião de destino não podem ser iguais.'
    )
  }

  const patrimonio =
    await buscarPatrimonioPorId(
      patrimonioId
    )

  const quantidadeNormalizada =
    numeroPositivo(
      quantidade
    )

  const quantidadeTotal =
    obterQuantidadeTotal(
      patrimonio
    )

  if (
    quantidadeNormalizada >
    quantidadeTotal
  ) {
    throw new Error(
      `A quantidade movimentada (${quantidadeNormalizada}) ` +
      `é maior que a quantidade total registrada (${quantidadeTotal}).`
    )
  }

  const prazoNormalizado =
    normalizarData(
      devolucaoPrevista
    )

  const statusDestino =
    definirStatusDestino({
      tipo:
        tipoNormalizado,

      guardiaoDestino,

      statusNovo
    })

  const dadosMovimentacao = {
    ...(dados &&
    typeof dados === 'object'
      ? dados
      : {}),

    engine:
      'PATRIMONIO_CORE_V1',

    gestor_patrimonial:
      GESTOR_PATRIMONIAL_PADRAO,

    guardiao_origem:
      guardiaoOrigem,

    guardiao_destino:
      guardiaoDestino,

    quantidade:
      quantidadeNormalizada,

    devolucao_prevista:
      prazoNormalizado,

    status_movimentacao:
      'CONCLUIDA'
  }

  const resultado =
    await registrarMovimentacao({
      patrimonioId,

      tipo:
        tipoNormalizado,

      statusNovo:
        statusDestino,

      localDestino:
        localDestino ||
        guardiaoDestino.nome,

      companhiaDestino:
        companhiaDestino ||
        guardiaoDestino.companhia ||
        null,

      recebedorRE:
        guardiaoDestino.re ||
        null,

      recebedorNome:
        guardiaoDestino.nome,

      motivo,

      observacao:
        observacoes,

      dados:
        dadosMovimentacao,

      user:
        usuario
    })

  const identificacao =
    obterIdentificacao(
      patrimonio
    )

  await registerAudit({
    action:
      `PATRIMONIO_${tipoNormalizado}`,

    description:
      montarDescricaoAuditoria({
        tipo:
          tipoNormalizado,

        identificacao,

        quantidade:
          quantidadeNormalizada,

        origem:
          guardiaoOrigem,

        destino:
          guardiaoDestino
      }),

    user:
      usuario,

    module:
      'Gestão Patrimonial',

    severity:
      tipoNormalizado ===
      TIPOS_MOVIMENTACAO_PATRIMONIAL.BAIXA
        ? 'Crítico'
        : 'Informativo'
  })

  await notificarComandante({
    patrimonio,

    tipo:
      tipoNormalizado,

    quantidade:
      quantidadeNormalizada,

    origem:
      guardiaoOrigem,

    destino:
      guardiaoDestino,

    usuario,

    devolucaoPrevista:
      prazoNormalizado,

    observacoes
  })

  return {
    patrimonio,
    movimentacao:
      resultado,

    gestorPatrimonial:
      GESTOR_PATRIMONIAL_PADRAO,

    guardiaoAnterior:
      guardiaoOrigem,

    guardiaoAtual:
      guardiaoDestino,

    quantidade:
      quantidadeNormalizada,

    status:
      statusDestino,

    devolucaoPrevista:
      prazoNormalizado
  }
}

export async function distribuirParaServicoDia({
  patrimonioId,
  quantidade = 1,
  observacoes = null,
  usuario = null
}) {
  return movimentarPatrimonio({
    patrimonioId,

    tipo:
      TIPOS_MOVIMENTACAO_PATRIMONIAL.DISTRIBUICAO,

    origem:
      GUARDIOES_PATRIMONIAIS.P4,

    destino:
      GUARDIOES_PATRIMONIAIS.SERVICO_DIA,

    quantidade,

    statusNovo:
      STATUS_PATRIMONIAL.EM_SERVICO,

    observacoes,

    usuario
  })
}

export async function devolverAoP4({
  patrimonioId,
  origem,
  quantidade = 1,
  observacoes = null,
  usuario = null
}) {
  return movimentarPatrimonio({
    patrimonioId,

    tipo:
      TIPOS_MOVIMENTACAO_PATRIMONIAL.DEVOLUCAO,

    origem,

    destino:
      GUARDIOES_PATRIMONIAIS.P4,

    quantidade,

    statusNovo:
      STATUS_PATRIMONIAL.RESERVA,

    observacoes,

    usuario
  })
}

export async function enviarParaManutencao({
  patrimonioId,
  origem,
  quantidade = 1,
  devolucaoPrevista = null,
  motivo,
  observacoes = null,
  usuario = null
}) {
  return movimentarPatrimonio({
    patrimonioId,

    tipo:
      TIPOS_MOVIMENTACAO_PATRIMONIAL.MANUTENCAO,

    origem,

    destino:
      GUARDIOES_PATRIMONIAIS.MANUTENCAO,

    quantidade,

    statusNovo:
      STATUS_PATRIMONIAL.MANUTENCAO,

    devolucaoPrevista,

    motivo,

    observacoes,

    usuario
  })
}

export async function atribuirCargaPermanente({
  patrimonioId,
  policial,
  quantidade = 1,
  observacoes = null,
  usuario = null
}) {
  const guardiaoPolicial =
    criarGuardiaoPolicial(
      policial
    )

  return movimentarPatrimonio({
    patrimonioId,

    tipo:
      TIPOS_MOVIMENTACAO_PATRIMONIAL.CARGA_PERMANENTE,

    origem:
      GUARDIOES_PATRIMONIAIS.P4,

    destino:
      guardiaoPolicial,

    quantidade,

    statusNovo:
      STATUS_PATRIMONIAL.CARGA,

    observacoes,

    usuario
  })
}