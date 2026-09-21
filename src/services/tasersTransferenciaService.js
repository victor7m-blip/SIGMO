import { supabase } from './supabaseClient'
import {
  buscarPatrimonioPorReferencia,
  buscarMovimentacaoPorId,
  cancelarMovimentacao,
  concluirMovimentacao,
  listarMovimentacoesPendentes,
  registrarMovimentacao,
  STATUS_MOVIMENTACAO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'
import { criarOuAtualizarPatrimonio } from './patrimoniosService'

const TABLE = 'sigmo_tasers'
const TABLE_MOVIMENTACOES = 'sigmo_patrimonio_movimentacoes'

const STATUS_APROVACAO_CMT = Object.freeze({
  NAO_APLICAVEL: 'NAO_APLICAVEL',
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  DILIGENCIA: 'DILIGENCIA',
  REPROVADA: 'REPROVADA'
})

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
  ].includes(perfilUsuario(user))
}

function transferenciaExigeAprovacaoCmt(origem, destino) {
  const origemNormalizada = upper(origem)
  const destinoNormalizado = upper(destino)

  /*
   * Regra Taser:
   * 1) qualquer saída do P4 exige aprovação prévia do Cmt de Cia;
   * 2) retorno de Taser que está fora da Cia/fora dos cofres
   *    (Outra Cia, Batalhão, Outra Unidade etc.) para o P4
   *    também exige aprovação;
   * 3) SVDD -> P4 permanece como devolução interna e não exige
   *    aprovação do Comandante.
   */
  if (origemNormalizada === 'P4') {
    return true
  }

  if (
    destinoNormalizado === 'P4' &&
    origemNormalizada &&
    origemNormalizada !== 'SVDD' &&
    origemNormalizada !== 'P4'
  ) {
    return true
  }

  return false
}


function normalizarCodigoGuardiao(valor) {
  const codigo = upper(valor)

  if (
    codigo === 'P4' ||
    codigo.includes('COFRE DO P4') ||
    codigo.includes('COFRE P4') ||
    codigo.includes('GUARDA DO P4') ||
    codigo.includes('GUARDA P4') ||
    codigo.includes('DEPOSITO P4') ||
    codigo.includes('DEPÓSITO P4')
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

function ehMovimentacaoTaserPendenteOperacional(item) {
  const dados =
    item?.dados ||
    item?.metadata?.dados_engine ||
    {}

  if (
    upper(
      dados?.modulo ||
      dados?.categoria
    ) !== 'TASER'
  ) {
    return false
  }

  const tipoMovimentacao =
    upper(
      item?.tipo_movimentacao ||
      item?.tipo ||
      item?.metadata?.movimentacao?.tipo
    )

  const tipoOperacao =
    upper(
      dados?.tipo_operacao_taser
    )

  if (tipoMovimentacao === 'TRANSFERENCIA') {
    return true
  }

  if (
    ['CARGA_PERMANENTE', 'CAUTELA_SERVICO'].includes(
      tipoMovimentacao
    ) ||
    ['CARGA_PERMANENTE', 'CAUTELA'].includes(
      tipoOperacao
    )
  ) {
    return (
      dados?.exige_aprovacao_cmt === true &&
      [
        STATUS_APROVACAO_CMT.PENDENTE,
        STATUS_APROVACAO_CMT.DILIGENCIA
      ].includes(
        upper(
          dados?.status_aprovacao_cmt
        )
      )
    )
  }

  return false
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor) {
  return texto(valor).toUpperCase()
}

function obterTaserId(movimentacao) {
  return (
    movimentacao?.dados?.taser_id ||
    movimentacao?.metadata?.dados_engine?.taser_id ||
    movimentacao?.metadata?.patrimonio?.referencia_id ||
    null
  )
}

async function buscarTaser(id) {
  if (!id) throw new Error('Taser não informado.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

async function sincronizarTaser(taser, user) {
  return criarOuAtualizarPatrimonio({
    tipo: 'taser',
    referencia_id: taser.id,
    dados: taser,
    user,
    local_atual: taser.local_atual || 'COFRE DO P4',
    companhia_atual: taser.unidade || ''
  })
}

function normalizarLocalComparacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ºª°]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function localDoCodigo(codigo, nomePersonalizado = null) {
  const codigoNormalizado = upper(codigo)
  const nome = texto(nomePersonalizado)
  if (codigoNormalizado === 'SVDD') return 'COFRE DO SVDD'
  if (codigoNormalizado === 'P4') return 'COFRE DO P4'
  if (codigoNormalizado === 'OUTROS') return nome || 'OUTROS'
  return nome || codigoNormalizado
}


function destinoEfetivaAposAprovacaoCmt(destinoCodigo) {
  return [
    'P4',
    '1 CIA',
    '2 CIA',
    '3 CIA',
    '4 CIA',
    '5 CIA',
    '6 CIA',
    'BTL',
    'OUTROS'
  ].includes(
    upper(
      destinoCodigo
    )
  )
}

function ehCargaOuCautelaParaPolicial(movimentacao) {
  const dados =
    movimentacao?.dados ||
    movimentacao?.metadata?.dados_engine ||
    {}

  const tipoOperacao =
    upper(
      dados?.tipo_operacao_taser
    )

  const tipoMovimentacao =
    upper(
      movimentacao?.tipo_movimentacao ||
      movimentacao?.metadata?.movimentacao?.tipo
    )

  return (
    ['CARGA_PERMANENTE', 'CAUTELA'].includes(
      tipoOperacao
    ) ||
    ['CARGA_PERMANENTE', 'CAUTELA_SERVICO'].includes(
      tipoMovimentacao
    )
  )
}

async function liberarTaserParaAceiteDoUsuario({
  movimentacao,
  user = null
}) {
  const dadosAtuais =
    movimentacao?.dados ||
    movimentacao?.metadata?.dados_engine ||
    {}

  const metadataAtual =
    movimentacao?.metadata ||
    {}

  const agora =
    new Date().toISOString()

  const dadosAtualizados = {
    ...dadosAtuais,
    status_movimentacao:
      'AGUARDANDO_ACEITE',
    status_recebimento_usuario:
      'AGUARDANDO_ACEITE',
    liberado_para_aceite_em:
      agora,
    liberado_para_aceite_por_id:
      user?.id ||
      null,
    liberado_para_aceite_por_nome:
      user?.nome_guerra ||
      user?.nome ||
      user?.nome_completo ||
      user?.email ||
      'COMANDANTE DE CIA'
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
      status_movimentacao:
        'AGUARDANDO_ACEITE',
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

export async function criarTransferenciaTaserPendente({
  taserId,
  origemCodigo,
  destinoCodigo,
  destinoNome = null,
  recebedor = null,
  observacoes = null,
  user = null
}) {
  const taser = await buscarTaser(taserId)
  const origem = upper(origemCodigo)
  const destino = upper(destinoCodigo)

  const destinosPermitidos = ['P4', 'SVDD', '1 CIA', '2 CIA', '3 CIA', '4 CIA', '5 CIA', '6 CIA', 'FT', 'BTL', 'OUTROS']

  const origemInterna =
    ['P4', 'SVDD'].includes(
      origem
    )

  const retornoExternoAoP4 =
    !origemInterna &&
    Boolean(origem) &&
    destino === 'P4'

  if (
    !destinosPermitidos.includes(destino) ||
    (!origemInterna && !retornoExternoAoP4)
  ) {
    throw new Error('Origem ou destino patrimonial inválido.')
  }

  if (origem === 'SVDD' && destino !== 'P4') {
    throw new Error('O SVDD somente pode devolver o Taser ao P4.')
  }
  if (destino === 'OUTROS' && !texto(destinoNome)) {
    throw new Error('Informe o destino da transferência.')
  }
  if (origem === destino) {
    throw new Error('A origem e o destino não podem ser iguais.')
  }

  const localAtual = upper(taser.local_atual)

  const localAtualComparacao =
    normalizarLocalComparacao(
      taser.local_atual
    )

  const origemComparacao =
    normalizarLocalComparacao(
      origem
    )

  const estaNaOrigem =
    origem === 'P4'
      ? (
          localAtual.includes('P4') ||
          localAtual.includes('DEPOSITO') ||
          localAtual.includes('GUARDA')
        )
      : origem === 'SVDD'
        ? (
            localAtual.includes('SVDD') ||
            localAtual.includes('SERVICO DE DIA')
          )
        : (
            localAtualComparacao === origemComparacao ||
            localAtualComparacao.includes(origemComparacao) ||
            origemComparacao.includes(localAtualComparacao)
          )

  if (!estaNaOrigem) {
    throw new Error(
      `Este Taser não está atualmente no local de origem informado (${origem}).`
    )
  }

  const statusAtual = upper(taser.status_operacional)
  const transferenciaManutencaoSVDDP4 =
    origem === 'SVDD' &&
    destino === 'P4' &&
    statusAtual === 'MANUTENCAO'

  if (['BAIXADO', 'CAUTELADO', 'CARGA'].includes(statusAtual)) {
    throw new Error('Este Taser não está disponível para transferência.')
  }

  if (statusAtual === 'MANUTENCAO' && !transferenciaManutencaoSVDDP4) {
    throw new Error('Taser em manutenção somente pode ser transferido do SVDD para o P4.')
  }

  const pendentesExistentes = await listarMovimentacoesPendentes({
    limite: 500
  })

  const jaPossuiTransferenciaPendente = (pendentesExistentes || []).some((item) => {
    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    return (
      upper(dados?.modulo || dados?.categoria) === 'TASER' &&
      String(
        dados?.taser_id ||
        dados?.referencia_id ||
        item?.metadata?.patrimonio?.referencia_id ||
        ''
      ) === String(taser.id)
    )
  })

  if (jaPossuiTransferenciaPendente) {
    throw new Error('Este Taser já possui uma transferência pendente.')
  }

  const localDestino = localDoCodigo(destino, destinoNome)

  const patrimonio = await buscarPatrimonioPorReferencia({
    tipo: 'taser',
    referenciaId: taser.id
  })

  const resultado = await registrarMovimentacao({
    patrimonioId: patrimonio.id,
    tipo: TIPOS_MOVIMENTACAO.TRANSFERENCIA,
    statusNovo: taser.status_operacional || 'RESERVA',
    localDestino,
    companhiaDestino: destino === 'SVDD' || destino === 'P4' ? taser.unidade || '' : destino,
    motivo:
      origem === 'P4'
        ? 'DISTRIBUICAO_OPERACIONAL'
        : origem === 'SVDD'
          ? 'DEVOLUCAO_AO_P4'
          : 'RETORNO_EXTERNO_AO_P4',
    observacao:
      texto(observacoes) ||
      `Transferência do Taser ${taser.patrimonio || taser.numero_serie || taser.id}: ${origem} → ${destino}.`,
    dados: {
      modulo: 'TASER',
      categoria: 'TASER',
      taser_id: taser.id,
      referencia_id: taser.id,
      quantidade: 1,
      tipo_operacao_taser:
        retornoExternoAoP4
          ? 'RETORNO_EXTERNO_P4'
          : null,
      retorno_externo_p4:
        retornoExternoAoP4,
      status_movimentacao: STATUS_MOVIMENTACAO.PENDENTE,
      exige_aprovacao_cmt: transferenciaExigeAprovacaoCmt(origem, destino),
      status_aprovacao_cmt: transferenciaExigeAprovacaoCmt(origem, destino)
        ? STATUS_APROVACAO_CMT.PENDENTE
        : STATUS_APROVACAO_CMT.NAO_APLICAVEL,
      solicitado_aprovacao_cmt_em: transferenciaExigeAprovacaoCmt(origem, destino)
        ? new Date().toISOString()
        : null,
      preservar_status_operacional: transferenciaManutencaoSVDDP4,
      status_operacional_origem: statusAtual,
      manutencao_em_transferencia: transferenciaManutencaoSVDDP4,
      guardiao_origem: {
        tipo:
          retornoExternoAoP4
            ? 'DESTINO_EXTERNO'
            : 'SETOR',
        codigo: origem,
        nome:
          retornoExternoAoP4
            ? taser.local_atual || origem
            : localDoCodigo(origem)
      },
      guardiao_destino: {
        tipo: 'SETOR',
        codigo: destino,
        nome: localDestino
      },
      local_origem:
        retornoExternoAoP4
          ? taser.local_atual || origem
          : localDoCodigo(origem),
      local_destino: localDestino,
      patrimonio: taser.patrimonio || null,
      numero_serie: taser.numero_serie || null,
      marca: taser.marca || null,
      modelo: taser.modelo || null,
      destino_nome: localDestino,
      recebedor_id: recebedor?.id || null,
      recebedor_re: upper(recebedor?.re) || null,
      recebedor_nome: upper(recebedor?.nome_guerra || recebedor?.nome || recebedor?.nome_completo) || null,
      recebedor_perfil: upper(recebedor?.perfil) || null,
      recebedor_tipo: recebedor?.id ? 'USUARIO_EXTERNO' : null,
      observacoes_transferencia: texto(observacoes) || null
    },
    user
  })

  // A Engine registra a intenção e atualiza o patrimônio central. Enquanto estiver
  // pendente, o HT continua sob a guarda da origem; por isso restauramos a posição.
  await sincronizarTaser(taser, user)

  return resultado.movimentacao
}

export async function listarTransferenciasTaserPendentes({
  destinoCodigo,
  limite = 100
} = {}) {
  const pendentes = await listarMovimentacoesPendentes({
    guardiaoCodigo: upper(destinoCodigo),
    limite
  })

  return (pendentes || []).filter((item) => {
    const dados = item?.dados || item?.metadata?.dados_engine || {}

    if (upper(dados.modulo || dados.categoria) !== 'TASER') {
      return false
    }

    const exigeAprovacao = dados?.exige_aprovacao_cmt === true
    const statusAprovacao = upper(dados?.status_aprovacao_cmt)

    // Movimentações que realmente exigem aceite do destino
    // só ficam disponíveis depois da aprovação do Comandante da Cia.
    if (exigeAprovacao && statusAprovacao !== STATUS_APROVACAO_CMT.APROVADA) {
      return false
    }

    return true
  })
}

export async function aceitarTransferenciaTaser({
  movimentacaoId,
  user = null
}) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)

  if (!movimentacao) throw new Error('Movimentação não encontrada.')

  const taserId = obterTaserId(movimentacao)
  const taser = await buscarTaser(taserId)
  const destinoCodigo = upper(
    movimentacao.destino_guardiao_codigo ||
    movimentacao?.metadata?.guardiao_destino?.codigo
  )
  const dadosMovimentacao = movimentacao?.dados || movimentacao?.metadata?.dados_engine || {}

  if (
    dadosMovimentacao?.exige_aprovacao_cmt === true &&
    upper(dadosMovimentacao?.status_aprovacao_cmt) !== STATUS_APROVACAO_CMT.APROVADA
  ) {
    throw new Error('Esta transferência ainda não foi aprovada pelo Comandante da Cia.')
  }

  const localDestino = localDoCodigo(
    destinoCodigo,
    movimentacao.destino_guardiao_nome ||
      dadosMovimentacao?.guardiao_destino?.nome ||
      dadosMovimentacao?.destino_nome
  )

  const preservarStatusOperacional =
    dadosMovimentacao?.preservar_status_operacional === true ||
    dadosMovimentacao?.manutencao_em_transferencia === true

  const statusDestino = preservarStatusOperacional
    ? upper(dadosMovimentacao?.status_operacional_origem || taser.status_operacional) || 'MANUTENCAO'
    : 'RESERVA'

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status_operacional: statusDestino,
      local_atual: localDestino,
      equipe_vinculada: null,
      viatura_vinculada: null
    })
    .eq('id', taser.id)
    .select()
    .single()

  if (error) throw error

  try {
    await sincronizarTaser(data, user)
    await concluirMovimentacao({
      movimentacaoId,
      observacao: `Recebimento confirmado em ${localDestino}.`,
      user
    })
  } catch (error) {
    await supabase.from(TABLE).update({
      status_operacional: taser.status_operacional,
      local_atual: taser.local_atual,
      equipe_vinculada: taser.equipe_vinculada,
      viatura_vinculada: taser.viatura_vinculada
    }).eq('id', taser.id)
    await sincronizarTaser(taser, user)
    throw error
  }

  return data
}

export async function listarTransferenciasTaserCriadasPendentes({
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
            Number(limite) || 200,
            500
          )
        )
    })

  return (pendentes || []).filter(
    (item) => {
      if (
        !ehMovimentacaoTaserPendenteOperacional(
          item
        )
      ) {
        return false
      }

      const dados =
        item?.dados ||
        item?.metadata?.dados_engine ||
        {}

      const origemItem =
        normalizarCodigoGuardiao(
          item?.origem_guardiao_codigo ||
          item?.metadata?.guardiao_origem?.codigo ||
          dados?.guardiao_origem?.codigo ||
          item?.local_origem ||
          dados?.local_origem
        )

      return (
        origemItem === origem
      )
    }
  )
}


export async function listarTransferenciasTaserAguardandoAprovacao({
  limite = 200
} = {}) {
  const pendentes = await listarMovimentacoesPendentes({
    limite: Math.max(1, Math.min(Number(limite) || 200, 500))
  })

  return (pendentes || []).filter((item) => {
    const dados = item?.dados || item?.metadata?.dados_engine || {}

    return (
      upper(dados?.modulo || dados?.categoria) === 'TASER' &&
      dados?.exige_aprovacao_cmt === true &&
      [STATUS_APROVACAO_CMT.PENDENTE, STATUS_APROVACAO_CMT.DILIGENCIA]
        .includes(upper(dados?.status_aprovacao_cmt))
    )
  })
}

async function atualizarAprovacaoMovimentacao({
  movimentacao,
  statusAprovacao,
  observacoes = '',
  user = null
}) {
  const metadataAtual = movimentacao?.metadata || {}
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

  const agora = new Date().toISOString()

  const dadosAtualizados = {
    ...dadosAtuais,
    status_aprovacao_cmt: statusAprovacao,
    aprovado_por_id:
      statusAprovacao === STATUS_APROVACAO_CMT.APROVADA
        ? user?.id || null
        : dadosAtuais?.aprovado_por_id || null,
    aprovado_por_nome:
      statusAprovacao === STATUS_APROVACAO_CMT.APROVADA
        ? usuarioNome
        : dadosAtuais?.aprovado_por_nome || null,
    aprovado_em:
      statusAprovacao === STATUS_APROVACAO_CMT.APROVADA
        ? agora
        : dadosAtuais?.aprovado_em || null,
    decisao_cmt_por_id: user?.id || null,
    decisao_cmt_por_nome: usuarioNome,
    decisao_cmt_em: agora,
    observacoes_decisao_cmt: texto(observacoes) || null
  }

  const metadataAtualizada = {
    ...metadataAtual,
    dados_engine: dadosAtualizados
  }

  const { data, error } = await supabase
    .from(TABLE_MOVIMENTACOES)
    .update({
      dados: dadosAtualizados,
      metadata: metadataAtualizada,
      updated_at: agora
    })
    .eq('id', movimentacao.id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function decidirTransferenciaTaserCmt({
  movimentacaoId,
  decisao,
  observacoes = '',
  user = null
}) {
  if (!podeDecidirComoComandante(user)) {
    throw new Error('Somente o Comandante da Cia pode decidir esta transferência.')
  }

  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)

  if (!movimentacao) {
    throw new Error('Transferência não encontrada.')
  }

  const dados = movimentacao?.dados || movimentacao?.metadata?.dados_engine || {}

  if (upper(dados?.modulo || dados?.categoria) !== 'TASER') {
    throw new Error('A movimentação informada não pertence ao módulo Taser.')
  }

  if (dados?.exige_aprovacao_cmt !== true) {
    throw new Error('Esta transferência não exige aprovação do Comandante da Cia.')
  }

  const decisaoNormalizada = upper(decisao)

  if (!['APROVAR', 'DILIGENCIA', 'REPROVAR'].includes(decisaoNormalizada)) {
    throw new Error('Decisão inválida.')
  }

  if (decisaoNormalizada === 'APROVAR') {
    const movimentacaoAprovada =
      await atualizarAprovacaoMovimentacao({
        movimentacao,
        statusAprovacao:
          STATUS_APROVACAO_CMT.APROVADA,
        observacoes,
        user
      })

    /*
     * CARGA / CAUTELA:
     * Cmt apenas libera para o policial.
     * A Taser só sai do P4 quando o policial confirmar no Receber Material.
     */
    if (
      ehCargaOuCautelaParaPolicial(
        movimentacaoAprovada
      )
    ) {
      return liberarTaserParaAceiteDoUsuario({
        movimentacao:
          movimentacaoAprovada,
        user
      })
    }

    const dadosAprovados =
      movimentacaoAprovada?.dados ||
      movimentacaoAprovada?.metadata?.dados_engine ||
      {}

    const destinoCodigo =
      upper(
        movimentacaoAprovada?.destino_guardiao_codigo ||
        movimentacaoAprovada?.metadata?.guardiao_destino?.codigo ||
        dadosAprovados?.guardiao_destino?.codigo
      )

    /*
     * OUTRAS CIAS / BATALHÃO / OUTRA UNIDADE e RETORNO EXTERNO -> P4:
     * não existe segundo recebedor autenticado no SIGMO.
     * Após a aprovação do Cmt, a movimentação é efetivada imediatamente.
     */
    if (
      destinoEfetivaAposAprovacaoCmt(
        destinoCodigo
      )
    ) {
      return aceitarTransferenciaTaser({
        movimentacaoId:
          movimentacaoAprovada.id,
        user
      })
    }

    /*
     * P4 -> SVDD:
     * permanece PENDENTE aguardando o SVDD confirmar o recebimento.
     */
    return movimentacaoAprovada
  }

  if (decisaoNormalizada === 'DILIGENCIA') {
    if (!texto(observacoes)) {
      throw new Error('Informe a diligência solicitada.')
    }

    return atualizarAprovacaoMovimentacao({
      movimentacao,
      statusAprovacao: STATUS_APROVACAO_CMT.DILIGENCIA,
      observacoes,
      user
    })
  }

  if (!texto(observacoes)) {
    throw new Error('Informe o motivo da reprovação.')
  }

  await atualizarAprovacaoMovimentacao({
    movimentacao,
    statusAprovacao: STATUS_APROVACAO_CMT.REPROVADA,
    observacoes,
    user
  })

  const taserId = obterTaserId(movimentacao)
  const taser = await buscarTaser(taserId)

  await cancelarMovimentacao({
    movimentacaoId,
    motivo: `TRANSFERÊNCIA REPROVADA PELO CMT DE CIA: ${texto(observacoes)}`,
    user
  })

  await sincronizarTaser(taser, user)

  return true
}

export async function cancelarTransferenciaTaser({ movimentacaoId, motivo, origemCodigo, user = null }) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)
  if (!movimentacao) throw new Error('Transferência não encontrada.')
  const dados = movimentacao?.dados || movimentacao?.metadata?.dados_engine || {}
  const origemMovimentacao =
    normalizarCodigoGuardiao(
      movimentacao?.origem_guardiao_codigo ||
      movimentacao?.metadata?.guardiao_origem?.codigo ||
      dados?.guardiao_origem?.codigo ||
      movimentacao?.local_origem ||
      dados?.local_origem
    )

  const origemSolicitada =
    normalizarCodigoGuardiao(
      origemCodigo
    )

  if (
    origemSolicitada &&
    origemMovimentacao !== origemSolicitada
  ) {
    throw new Error(
      'Esta movimentação não foi criada pelo setor atual.'
    )
  }
  const taserId = obterTaserId(movimentacao)
  const taser = await buscarTaser(taserId)
  await cancelarMovimentacao({
    movimentacaoId,
    motivo: texto(motivo) || 'TRANSFERÊNCIA CANCELADA PELO SETOR DE ORIGEM',
    user
  })
  await sincronizarTaser(taser, user)
  return true
}

export async function recusarTransferenciaTaser({
  movimentacaoId,
  motivo,
  user = null
}) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)
  if (!movimentacao) throw new Error('Transferência não encontrada.')

  const taserId = obterTaserId(movimentacao)
  const taser = await buscarTaser(taserId)

  await cancelarMovimentacao({
    movimentacaoId,
    motivo: texto(motivo) || 'TRANSFERÊNCIA RECUSADA PELO DESTINO',
    user
  })

  await sincronizarTaser(taser, user)
  return true
}
