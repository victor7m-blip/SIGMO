import { supabase } from './supabaseClient'

import {
  buscarMovimentacaoPorId,
  buscarPatrimonioPorReferencia,
  cancelarMovimentacao,
  concluirMovimentacao,
  listarMovimentacoesPendentes,
  registrarMovimentacao,
  STATUS_MOVIMENTACAO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

import {
  criarOuAtualizarPatrimonio
} from './patrimoniosService'

const TABLE = 'sigmo_cops'
const TABLE_MOVIMENTACOES =
  'sigmo_patrimonio_movimentacoes'

const STATUS_APROVACAO_CMT = Object.freeze({
  NAO_APLICAVEL: 'NAO_APLICAVEL',
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  DILIGENCIA: 'DILIGENCIA',
  REPROVADA: 'REPROVADA'
})


function texto(valor) {
  return String(valor ?? '').trim()
}


function upper(valor) {
  return texto(valor).toUpperCase()
}


function perfilUsuario(user) {
  return upper(
    user?.perfil ||
    user?.role ||
    user?.tipo_usuario ||
    user?.tipo_perfil ||
    user?.perfil_nome ||
    user?.user_metadata?.perfil ||
    ''
  )
}


function podeDecidirComoComandante(user) {
  return [
    'ADMINISTRADOR',
    'ADMIN',
    'COMANDANTE DE CIA',
    'COMANDANTE DA CIA',
    'COMANDANTE',
    'CMT DE CIA',
    'CMT CIA'
  ].includes(
    perfilUsuario(user)
  )
}


function normalizarCodigoGuardiao(valor) {
  const codigo = upper(valor)

  if (
    codigo === 'P4' ||
    codigo.includes('COFRE DO P4') ||
    codigo.includes('COFRE P4') ||
    codigo.includes('GUARDA DO P4') ||
    codigo.includes('GUARDA P4') ||
    codigo.includes('DEPOSITO DO P4') ||
    codigo.includes('DEPOSITO P4')
  ) {
    return 'P4'
  }

  if (
    codigo === 'SVDD' ||
    codigo.includes('COFRE DO SVDD') ||
    codigo.includes('COFRE SVDD') ||
    codigo.includes('SERVICO DE DIA') ||
    codigo.includes('SERVIÇO DE DIA')
  ) {
    return 'SVDD'
  }

  return codigo
}


function localDoCodigo(codigo) {
  const normalizado =
    normalizarCodigoGuardiao(
      codigo
    )

  if (normalizado === 'P4') {
    return 'COFRE DO P4'
  }

  if (normalizado === 'SVDD') {
    return 'COFRE DO SVDD'
  }

  return normalizado
}


function transferenciaExigeAprovacaoCmt(
  origem,
  destino
) {
  return (
    normalizarCodigoGuardiao(origem) ===
      'P4' &&
    normalizarCodigoGuardiao(destino) ===
      'SVDD'
  )
}


function obterCopId(movimentacao) {
  return (
    movimentacao?.dados?.cop_id ||
    movimentacao
      ?.metadata
      ?.dados_engine
      ?.cop_id ||
    movimentacao
      ?.metadata
      ?.patrimonio
      ?.referencia_id ||
    null
  )
}


function ehMovimentacaoCOP(
  movimentacao
) {
  const dados =
    movimentacao?.dados ||
    movimentacao
      ?.metadata
      ?.dados_engine ||
    {}

  return (
    upper(
      dados?.modulo ||
      dados?.categoria
    ) === 'COP'
  )
}


async function buscarCOP(id) {
  if (!id) {
    throw new Error(
      'COP não informada.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return data
}


async function sincronizarCOP(
  cop,
  user = null
) {
  return criarOuAtualizarPatrimonio({
    tipo: 'cop',
    referencia_id:
      cop.id,
    dados:
      cop,
    user,
    local_atual:
      cop.local_atual ||
      'COFRE DO SVDD',
    companhia_atual: ''
  })
}


function copEstaNoSetor(
  cop,
  setor
) {
  const local =
    upper(
      cop?.local_atual
    )

  const codigo =
    normalizarCodigoGuardiao(
      setor
    )

  if (codigo === 'P4') {
    return (
      local.includes('P4') ||
      local.includes('DEPOSITO') ||
      local.includes('GUARDA')
    )
  }

  if (codigo === 'SVDD') {
    return (
      local.includes('SVDD') ||
      local.includes('SERVICO DE DIA') ||
      local.includes('SERVIÇO DE DIA')
    )
  }

  return false
}


async function atualizarAprovacaoMovimentacao({
  movimentacao,
  statusAprovacao,
  observacoes = '',
  user = null
}) {
  const metadataAtual =
    movimentacao?.metadata ||
    {}

  const dadosAtuais =
    movimentacao?.dados ||
    metadataAtual?.dados_engine ||
    {}

  const usuarioNome =
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.email ||
    'COMANDANTE DA CIA'

  const agora =
    new Date().toISOString()

  const dadosAtualizados = {
    ...dadosAtuais,

    status_aprovacao_cmt:
      statusAprovacao,

    aprovado_por_id:
      statusAprovacao ===
      STATUS_APROVACAO_CMT.APROVADA
        ? user?.id || null
        : dadosAtuais
            ?.aprovado_por_id ||
          null,

    aprovado_por_nome:
      statusAprovacao ===
      STATUS_APROVACAO_CMT.APROVADA
        ? usuarioNome
        : dadosAtuais
            ?.aprovado_por_nome ||
          null,

    aprovado_em:
      statusAprovacao ===
      STATUS_APROVACAO_CMT.APROVADA
        ? agora
        : dadosAtuais
            ?.aprovado_em ||
          null,

    decisao_cmt_por_id:
      user?.id ||
      null,

    decisao_cmt_por_nome:
      usuarioNome,

    decisao_cmt_em:
      agora,

    observacoes_decisao_cmt:
      texto(observacoes) ||
      null
  }

  const metadataAtualizada = {
    ...metadataAtual,
    dados_engine:
      dadosAtualizados
  }

  const {
    data,
    error
  } = await supabase
    .from(
      TABLE_MOVIMENTACOES
    )
    .update({
      dados:
        dadosAtualizados,
      metadata:
        metadataAtualizada,
      updated_at:
        agora
    })
    .eq(
      'id',
      movimentacao.id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}


export async function criarTransferenciaCOPPendente({
  copId,
  origemCodigo,
  destinoCodigo,
  observacoes = null,
  user = null
}) {
  const origem =
    normalizarCodigoGuardiao(
      origemCodigo
    )

  const destino =
    normalizarCodigoGuardiao(
      destinoCodigo
    )

  if (
    !['P4', 'SVDD'].includes(
      origem
    ) ||
    !['P4', 'SVDD'].includes(
      destino
    )
  ) {
    throw new Error(
      'A COP somente pode ser transferida entre P4 e SVDD.'
    )
  }

  if (origem === destino) {
    throw new Error(
      'A origem e o destino não podem ser iguais.'
    )
  }

  if (
    origem === 'P4' &&
    destino !== 'SVDD'
  ) {
    throw new Error(
      'O P4 somente pode transferir COP para o SVDD.'
    )
  }

  if (
    origem === 'SVDD' &&
    destino !== 'P4'
  ) {
    throw new Error(
      'O SVDD somente pode devolver COP ao P4.'
    )
  }

  const cop =
    await buscarCOP(
      copId
    )

  if (
    cop?.ativo === false
  ) {
    throw new Error(
      'Uma COP inativa não pode ser transferida.'
    )
  }

  const status =
    upper(
      cop?.status_operacional
    )

  if (
    [
      'BAIXADA',
      'BAIXADO',
      'MANUTENCAO',
      'EM_SERVICO',
      'CAUTELADO'
    ].includes(
      status
    )
  ) {
    throw new Error(
      'Esta COP não está disponível para transferência.'
    )
  }

  if (
    !copEstaNoSetor(
      cop,
      origem
    )
  ) {
    throw new Error(
      `Esta COP não está atualmente no ${origem}.`
    )
  }

  const pendentes =
    await listarMovimentacoesPendentes({
      limite: 500
    })

  const jaPossuiPendente =
    (pendentes || [])
      .some(
        (movimentacao) => {
          if (
            !ehMovimentacaoCOP(
              movimentacao
            )
          ) {
            return false
          }

          return (
            String(
              obterCopId(
                movimentacao
              ) ||
              ''
            ) ===
            String(
              cop.id
            )
          )
        }
      )

  if (jaPossuiPendente) {
    throw new Error(
      'Esta COP já possui uma transferência pendente.'
    )
  }

  const patrimonio =
    await buscarPatrimonioPorReferencia({
      tipo:
        'cop',
      referenciaId:
        cop.id
    })

  if (!patrimonio?.id) {
    throw new Error(
      'Patrimônio central da COP não localizado.'
    )
  }

  const localOrigem =
    localDoCodigo(
      origem
    )

  const localDestino =
    localDoCodigo(
      destino
    )

  const exigeAprovacao =
    transferenciaExigeAprovacaoCmt(
      origem,
      destino
    )

  const resultado =
    await registrarMovimentacao({
      patrimonioId:
        patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO
          .TRANSFERENCIA,

      statusNovo:
        'RESERVA',

      localDestino,

      companhiaDestino:
        '',

      motivo:
        origem === 'P4'
          ? 'DISTRIBUICAO_OPERACIONAL'
          : 'DEVOLUCAO_AO_P4',

      observacao:
        texto(observacoes) ||
        `Transferência da COP ${
          cop.numero ||
          cop.identificacao_equipamento ||
          cop.id
        }: ${origem} → ${destino}.`,

      dados: {
        modulo:
          'COP',

        categoria:
          'COP',

        cop_id:
          cop.id,

        referencia_id:
          cop.id,

        quantidade:
          1,

        status_movimentacao:
          STATUS_MOVIMENTACAO
            .PENDENTE,

        exige_aprovacao_cmt:
          exigeAprovacao,

        status_aprovacao_cmt:
          exigeAprovacao
            ? STATUS_APROVACAO_CMT
                .PENDENTE
            : STATUS_APROVACAO_CMT
                .NAO_APLICAVEL,

        solicitado_aprovacao_cmt_em:
          exigeAprovacao
            ? new Date()
                .toISOString()
            : null,

        guardiao_origem: {
          tipo:
            'SETOR',
          codigo:
            origem,
          nome:
            localOrigem
        },

        guardiao_destino: {
          tipo:
            'SETOR',
          codigo:
            destino,
          nome:
            localDestino
        },

        local_origem:
          localOrigem,

        local_destino:
          localDestino,

        numero:
          cop.numero ||
          null,

        identificacao_equipamento:
          cop
            .identificacao_equipamento ||
          null,

        marca:
          cop.marca ||
          null,

        destino_nome:
          localDestino,

        observacoes_transferencia:
          texto(observacoes) ||
          null
      },

      user
    })

  /*
   * registrarMovimentacao atualiza o patrimônio central imediatamente.
   * Como a transferência ainda está pendente, restauramos o guardião
   * de origem. O local só muda de fato quando o destino recebe.
   */
  await sincronizarCOP(
    cop,
    user
  )

  return (
    resultado?.movimentacao ||
    resultado
  )
}


export async function listarTransferenciasCOPPendentes({
  destinoCodigo,
  limite = 100
} = {}) {
  const destino =
    normalizarCodigoGuardiao(
      destinoCodigo
    )

  const pendentes =
    await listarMovimentacoesPendentes({
      guardiaoCodigo:
        destino,
      limite
    })

  return (
    pendentes ||
    []
  ).filter(
    (movimentacao) => {
      if (
        !ehMovimentacaoCOP(
          movimentacao
        )
      ) {
        return false
      }

      const dados =
        movimentacao?.dados ||
        movimentacao
          ?.metadata
          ?.dados_engine ||
        {}

      if (
        dados
          ?.exige_aprovacao_cmt ===
          true &&
        upper(
          dados
            ?.status_aprovacao_cmt
        ) !==
          STATUS_APROVACAO_CMT
            .APROVADA
      ) {
        return false
      }

      return true
    }
  )
}


export async function listarTransferenciasCOPCriadasPendentes({
  origemCodigo,
  limite = 200
} = {}) {
  const origem =
    normalizarCodigoGuardiao(
      origemCodigo
    )

  const pendentes =
    await listarMovimentacoesPendentes({
      limite:
        Math.max(
          1,
          Math.min(
            Number(limite) ||
              200,
            500
          )
        )
    })

  return (
    pendentes ||
    []
  ).filter(
    (movimentacao) => {
      if (
        !ehMovimentacaoCOP(
          movimentacao
        )
      ) {
        return false
      }

      const dados =
        movimentacao?.dados ||
        movimentacao
          ?.metadata
          ?.dados_engine ||
        {}

      const origemMovimentacao =
        normalizarCodigoGuardiao(
          movimentacao
            ?.origem_guardiao_codigo ||
          movimentacao
            ?.metadata
            ?.guardiao_origem
            ?.codigo ||
          dados
            ?.guardiao_origem
            ?.codigo ||
          movimentacao
            ?.local_origem ||
          dados
            ?.local_origem
        )

      return (
        origemMovimentacao ===
        origem
      )
    }
  )
}


export async function listarTransferenciasCOPAguardandoAprovacao({
  limite = 200
} = {}) {
  const pendentes =
    await listarMovimentacoesPendentes({
      limite:
        Math.max(
          1,
          Math.min(
            Number(limite) ||
              200,
            500
          )
        )
    })

  return (
    pendentes ||
    []
  ).filter(
    (movimentacao) => {
      if (
        !ehMovimentacaoCOP(
          movimentacao
        )
      ) {
        return false
      }

      const dados =
        movimentacao?.dados ||
        movimentacao
          ?.metadata
          ?.dados_engine ||
        {}

      return (
        dados
          ?.exige_aprovacao_cmt ===
          true &&
        [
          STATUS_APROVACAO_CMT
            .PENDENTE,
          STATUS_APROVACAO_CMT
            .DILIGENCIA
        ].includes(
          upper(
            dados
              ?.status_aprovacao_cmt
          )
        )
      )
    }
  )
}


export async function aceitarTransferenciaCOP({
  movimentacaoId,
  user = null
}) {
  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacao) {
    throw new Error(
      'Transferência de COP não encontrada.'
    )
  }

  if (
    !ehMovimentacaoCOP(
      movimentacao
    )
  ) {
    throw new Error(
      'A movimentação informada não pertence ao módulo COP.'
    )
  }

  const dados =
    movimentacao?.dados ||
    movimentacao
      ?.metadata
      ?.dados_engine ||
    {}

  if (
    dados
      ?.exige_aprovacao_cmt ===
      true &&
    upper(
      dados
        ?.status_aprovacao_cmt
    ) !==
      STATUS_APROVACAO_CMT
        .APROVADA
  ) {
    throw new Error(
      'Esta transferência ainda não foi aprovada pelo Comandante da Cia.'
    )
  }

  const copId =
    obterCopId(
      movimentacao
    )

  const cop =
    await buscarCOP(
      copId
    )

  const destinoCodigo =
    normalizarCodigoGuardiao(
      movimentacao
        ?.destino_guardiao_codigo ||
      movimentacao
        ?.metadata
        ?.guardiao_destino
        ?.codigo ||
      dados
        ?.guardiao_destino
        ?.codigo
    )

  if (
    !['P4', 'SVDD'].includes(
      destinoCodigo
    )
  ) {
    throw new Error(
      'Destino da transferência de COP inválido.'
    )
  }

  const localDestino =
    localDoCodigo(
      destinoCodigo
    )

  const {
    data: atualizada,
    error
  } = await supabase
    .from(TABLE)
    .update({
      status_operacional:
        'RESERVA',
      local_atual:
        localDestino
    })
    .eq(
      'id',
      cop.id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  try {
    await sincronizarCOP(
      atualizada,
      user
    )

    await concluirMovimentacao({
      movimentacaoId,
      observacao:
        `Recebimento da COP confirmado em ${localDestino}.`,
      user
    })
  } catch (error) {
    await supabase
      .from(TABLE)
      .update({
        status_operacional:
          cop.status_operacional,
        local_atual:
          cop.local_atual
      })
      .eq(
        'id',
        cop.id
      )

    await sincronizarCOP(
      cop,
      user
    )

    throw error
  }

  return atualizada
}


export async function decidirTransferenciaCOPCmt({
  movimentacaoId,
  decisao,
  observacoes = '',
  user = null
}) {
  if (
    !podeDecidirComoComandante(
      user
    )
  ) {
    throw new Error(
      'Somente o Comandante da Cia pode decidir esta transferência.'
    )
  }

  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacao) {
    throw new Error(
      'Transferência de COP não encontrada.'
    )
  }

  if (
    !ehMovimentacaoCOP(
      movimentacao
    )
  ) {
    throw new Error(
      'A movimentação informada não pertence ao módulo COP.'
    )
  }

  const dados =
    movimentacao?.dados ||
    movimentacao
      ?.metadata
      ?.dados_engine ||
    {}

  if (
    dados
      ?.exige_aprovacao_cmt !==
      true
  ) {
    throw new Error(
      'Esta transferência não exige aprovação do Comandante da Cia.'
    )
  }

  const decisaoNormalizada =
    upper(
      decisao
    )

  if (
    ![
      'APROVAR',
      'DILIGENCIA',
      'REPROVAR'
    ].includes(
      decisaoNormalizada
    )
  ) {
    throw new Error(
      'Decisão inválida.'
    )
  }

  if (
    decisaoNormalizada ===
    'APROVAR'
  ) {
    /*
     * P4 -> SVDD:
     * o Cmt apenas autoriza a saída do P4.
     * A COP continua no P4 até o SVDD confirmar o recebimento.
     */
    return atualizarAprovacaoMovimentacao({
      movimentacao,
      statusAprovacao:
        STATUS_APROVACAO_CMT
          .APROVADA,
      observacoes,
      user
    })
  }

  if (
    decisaoNormalizada ===
    'DILIGENCIA'
  ) {
    if (!texto(observacoes)) {
      throw new Error(
        'Informe a diligência solicitada.'
      )
    }

    return atualizarAprovacaoMovimentacao({
      movimentacao,
      statusAprovacao:
        STATUS_APROVACAO_CMT
          .DILIGENCIA,
      observacoes,
      user
    })
  }

  if (!texto(observacoes)) {
    throw new Error(
      'Informe o motivo da reprovação.'
    )
  }

  await atualizarAprovacaoMovimentacao({
    movimentacao,
    statusAprovacao:
      STATUS_APROVACAO_CMT
        .REPROVADA,
    observacoes,
    user
  })

  const cop =
    await buscarCOP(
      obterCopId(
        movimentacao
      )
    )

  await cancelarMovimentacao({
    movimentacaoId,
    motivo:
      `TRANSFERÊNCIA DE COP REPROVADA PELO CMT DE CIA: ${texto(observacoes)}`,
    user
  })

  await sincronizarCOP(
    cop,
    user
  )

  return true
}


export async function cancelarTransferenciaCOP({
  movimentacaoId,
  motivo,
  origemCodigo,
  user = null
}) {
  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacao) {
    throw new Error(
      'Transferência de COP não encontrada.'
    )
  }

  if (
    !ehMovimentacaoCOP(
      movimentacao
    )
  ) {
    throw new Error(
      'A movimentação informada não pertence ao módulo COP.'
    )
  }

  const dados =
    movimentacao?.dados ||
    movimentacao
      ?.metadata
      ?.dados_engine ||
    {}

  const origemMovimentacao =
    normalizarCodigoGuardiao(
      movimentacao
        ?.origem_guardiao_codigo ||
      movimentacao
        ?.metadata
        ?.guardiao_origem
        ?.codigo ||
      dados
        ?.guardiao_origem
        ?.codigo ||
      movimentacao
        ?.local_origem ||
      dados
        ?.local_origem
    )

  const origemSolicitada =
    normalizarCodigoGuardiao(
      origemCodigo
    )

  if (
    origemSolicitada &&
    origemMovimentacao !==
      origemSolicitada
  ) {
    throw new Error(
      'Esta movimentação não foi criada pelo setor atual.'
    )
  }

  const cop =
    await buscarCOP(
      obterCopId(
        movimentacao
      )
    )

  await cancelarMovimentacao({
    movimentacaoId,
    motivo:
      texto(motivo) ||
      'TRANSFERÊNCIA DE COP CANCELADA PELO SETOR DE ORIGEM',
    user
  })

  await sincronizarCOP(
    cop,
    user
  )

  return true
}


export async function recusarTransferenciaCOP({
  movimentacaoId,
  motivo,
  user = null
}) {
  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacao) {
    throw new Error(
      'Transferência de COP não encontrada.'
    )
  }

  if (
    !ehMovimentacaoCOP(
      movimentacao
    )
  ) {
    throw new Error(
      'A movimentação informada não pertence ao módulo COP.'
    )
  }

  const cop =
    await buscarCOP(
      obterCopId(
        movimentacao
      )
    )

  await cancelarMovimentacao({
    movimentacaoId,
    motivo:
      texto(motivo) ||
      'TRANSFERÊNCIA DE COP RECUSADA PELO DESTINO',
    user
  })

  await sincronizarCOP(
    cop,
    user
  )

  return true
}
