import { supabase } from './supabaseClient'

import {
  receberPatrimonioPorCodigo
} from './patrimonioEngineService'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

import {
  movimentarPatrimonio,
  distribuirParaServicoDia
} from '../features/patrimonio/engine'

import {
  GUARDIOES_PATRIMONIAIS,
  STATUS_PATRIMONIAL,
  TIPOS_MOVIMENTACAO_PATRIMONIAL,
  criarGuardiaoPolicial
} from '../features/patrimonio/constants/patrimonioCore'

const TABLE = 'sigmo_tonfas'
const PATRIMONIOS_TABLE = 'sigmo_patrimonios'

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(numero)
  )
}

function normalizarTonfa(item = {}) {
  const quantidade =
    numeroInteiro(
      item.quantidade
    )

  const quantidadeDisponivel =
    numeroInteiro(
      item.quantidade_disponivel
    )

  const quantidadeEmServico =
    numeroInteiro(
      item.quantidade_em_servico
    )

  let quantidadeP4 =
    numeroInteiro(
      item.quantidade_p4
    )

  const quantidadeSvdd =
    numeroInteiro(
      item.quantidade_svdd
    )

  /*
   * Compatibilidade com registros antigos:
   *
   * Antes da Engine Patrimonial, o estoque
   * inicial ficava em quantidade_disponivel,
   * com quantidade_p4 igual a zero.
   *
   * Na nova arquitetura, tudo que ainda não
   * foi distribuído permanece sob guarda do P4.
   */
  if (
    quantidadeP4 === 0 &&
    quantidadeSvdd === 0 &&
    quantidadeEmServico === 0 &&
    quantidadeDisponivel > 0
  ) {
    quantidadeP4 =
      quantidadeDisponivel
  }

  return {
    ...item,

    tipo:
      maiusculo(item.tipo) ||
      'TONFA',

    quantidade,

    quantidade_disponivel:
      quantidadeDisponivel,

    quantidade_em_servico:
      quantidadeEmServico,

    quantidade_p4:
      quantidadeP4,

    quantidade_svdd:
      quantidadeSvdd,

    unidade:
      maiusculo(item.unidade) ||
      null,

    status_operacional:
      maiusculo(
        item.status_operacional
      ) ||
      'RESERVA',

    local_atual:
      texto(item.local_atual) ||
      null,

    observacoes:
      texto(item.observacoes) ||
      null,

    qr_code:
      texto(item.qr_code) ||
      null,

    foto_url:
      texto(item.foto_url) ||
      null,

    ativo:
      item.ativo !== false
  }
}

function prepararPayloadCadastro(
  payload = {}
) {
  const item =
    normalizarTonfa(payload)

  return {
    tipo:
      item.tipo,

    quantidade:
      item.quantidade,

    /*
     * quantidade_disponivel representa o
     * estoque disponível para distribuição.
     *
     * No cadastro inicial, toda a quantidade
     * está fisicamente sob guarda do P4.
     */
    quantidade_disponivel:
      item.quantidade,

    quantidade_em_servico:
      0,

    quantidade_p4:
      item.quantidade,

    quantidade_svdd:
      0,

    unidade:
      item.unidade,

    status_operacional:
      STATUS_PATRIMONIAL.RESERVA,

    local_atual:
      item.local_atual ||
      'P4',

    observacoes:
      item.observacoes,

    qr_code:
      item.qr_code,

    foto_url:
      item.foto_url,

    ativo:
      item.ativo
  }
}

function prepararPayloadAtualizacao(
  payload = {}
) {
  const item =
    normalizarTonfa(payload)

  return {
    tipo:
      item.tipo,

    quantidade:
      item.quantidade,

    unidade:
      item.unidade,

    status_operacional:
      item.status_operacional,

    local_atual:
      item.local_atual ||
      'P4',

    observacoes:
      item.observacoes,

    qr_code:
      item.qr_code,

    foto_url:
      item.foto_url,

    ativo:
      item.ativo
  }
}

function localPatrimonial(item) {
  if (item.local_atual) {
    return item.local_atual
  }

  if (
    item.quantidade_em_servico > 0
  ) {
    return 'MATERIAIS EM SERVIÇO'
  }

  if (
    item.quantidade_svdd > 0
  ) {
    return 'COFRE DO SVDD'
  }

  return 'P4'
}

function gerarQrCode(tipo) {
  if (tipo === 'CASSETETE') {
    return 'SIGMO-CASSETETE'
  }

  return 'SIGMO-TONFA'
}

function validarQuantidade(
  quantidade
) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade deve ser maior que zero.'
    )
  }

  return valor
}

function obterTotalSobGuarda(
  tonfa
) {
  return (
    numeroInteiro(
      tonfa.quantidade_p4
    ) +
    numeroInteiro(
      tonfa.quantidade_svdd
    ) +
    numeroInteiro(
      tonfa.quantidade_em_servico
    )
  )
}

function obterStatusEstoque({
  quantidadeP4,
  quantidadeSvdd,
  quantidadeEmServico
}) {
  if (
    quantidadeEmServico > 0
  ) {
    return STATUS_PATRIMONIAL.CARGA
  }

  if (
    quantidadeSvdd > 0
  ) {
    return STATUS_PATRIMONIAL.CARGA
  }

  if (
    quantidadeP4 > 0
  ) {
    return STATUS_PATRIMONIAL.RESERVA
  }

  return STATUS_PATRIMONIAL.RECOLHIDO
}

function obterLocalEstoque({
  quantidadeP4,
  quantidadeSvdd,
  quantidadeEmServico
}) {
  const locais = []

  if (quantidadeP4 > 0) {
    locais.push(
      `${quantidadeP4} no P4`
    )
  }

  if (quantidadeSvdd > 0) {
    locais.push(
      `${quantidadeSvdd} no Cofre do SVDD`
    )
  }

  if (
    quantidadeEmServico > 0
  ) {
    locais.push(
      `${quantidadeEmServico} em serviço`
    )
  }

  return (
    locais.join(' • ') ||
    'SEM LOCAL DEFINIDO'
  )
}

async function verificarTipoExistente(
  tipo,
  ignorarId = null
) {
  let query = supabase
    .from(TABLE)
    .select('id, tipo')
    .eq('tipo', tipo)
    .eq('ativo', true)

  if (ignorarId) {
    query = query.neq(
      'id',
      ignorarId
    )
  }

  const {
    data,
    error
  } = await query.limit(1)

  if (error) {
    throw error
  }

  return Boolean(
    data?.length
  )
}


async function buscarEstoqueAtivoPorTipo(tipo) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('tipo', tipo)
    .eq('ativo', true)
    .order('criado_em', { ascending: true })
    .limit(1)

  if (error) {
    throw error
  }

  return data?.[0]
    ? normalizarTonfa(data[0])
    : null
}

async function buscarPatrimonioDaTonfa(
  tonfaId
) {
  const {
    data,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')
    .eq('tipo', 'tonfa')
    .eq(
      'referencia_id',
      tonfaId
    )
    .eq('ativo', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'O registro patrimonial desta Tonfa ou Cassetete não foi encontrado.'
    )
  }

  return data
}

async function atualizarSaldosTonfa({
  id,
  quantidadeP4,
  quantidadeSvdd,
  quantidadeEmServico
}) {
  const p4 =
    numeroInteiro(
      quantidadeP4
    )

  const svdd =
    numeroInteiro(
      quantidadeSvdd
    )

  const emServico =
    numeroInteiro(
      quantidadeEmServico
    )

  const quantidadeDisponivel =
    p4

  const statusOperacional =
    obterStatusEstoque({
      quantidadeP4:
        p4,

      quantidadeSvdd:
        svdd,

      quantidadeEmServico:
        emServico
    })

  const localAtual =
    obterLocalEstoque({
      quantidadeP4:
        p4,

      quantidadeSvdd:
        svdd,

      quantidadeEmServico:
        emServico
    })

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      quantidade_p4:
        p4,

      quantidade_svdd:
        svdd,

      quantidade_em_servico:
        emServico,

      quantidade_disponivel:
        quantidadeDisponivel,

      status_operacional:
        statusOperacional,

      local_atual:
        localAtual
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return normalizarTonfa(
    data
  )
}

async function sincronizarPatrimonioTonfa(
  tonfa,
  user = null
) {
  return criarOuAtualizarPatrimonio({
    tipo:
      'tonfa',

    referencia_id:
      tonfa.id,

    dados:
      tonfa,

    user,

    local_atual:
      localPatrimonial(
        tonfa
      ),

    companhia_atual:
      tonfa.unidade || ''
  })
}

async function executarMovimentacaoComRollback({
  tonfaAtual,
  novosSaldos,
  movimentacao,
  user
}) {
  let tonfaAtualizada = null

  try {
    tonfaAtualizada =
      await atualizarSaldosTonfa({
        id:
          tonfaAtual.id,

        quantidadeP4:
          novosSaldos.quantidade_p4,

        quantidadeSvdd:
          novosSaldos.quantidade_svdd,

        quantidadeEmServico:
          novosSaldos.quantidade_em_servico
      })

    await sincronizarPatrimonioTonfa(
      tonfaAtualizada,
      user
    )

    const resultadoMovimentacao =
      await movimentacao()

    return {
      tonfa:
        tonfaAtualizada,

      movimentacao:
        resultadoMovimentacao
    }
  } catch (error) {
    /*
     * Se a Engine falhar depois da alteração
     * dos saldos, restaura o estoque anterior.
     */
    if (tonfaAtualizada) {
      try {
        const restaurada =
          await atualizarSaldosTonfa({
            id:
              tonfaAtual.id,

            quantidadeP4:
              tonfaAtual.quantidade_p4,

            quantidadeSvdd:
              tonfaAtual.quantidade_svdd,

            quantidadeEmServico:
              tonfaAtual.quantidade_em_servico
          })

        await sincronizarPatrimonioTonfa(
          restaurada,
          user
        )
      } catch (
        rollbackError
      ) {
        console.error(
          'Erro ao restaurar os saldos da Tonfa:',
          rollbackError
        )
      }
    }

    throw error
  }
}

export async function listarTonfas({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'criado_em',
  sortDirection = 'desc'
} = {}) {
  const inicio =
    (pagina - 1) * limite

  const fim =
    inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', {
      count:
        'exact'
    })
    .order(sortBy, {
      ascending:
        sortDirection ===
        'asc',

      nullsFirst:
        false
    })
    .range(
      inicio,
      fim
    )

  const pesquisa =
    texto(
      filtros.pesquisa
    ).replace(
      /[%(),]/g,
      ''
    )

  if (pesquisa) {
    query = query.or(
      [
        `tipo.ilike.%${pesquisa}%`,
        `unidade.ilike.%${pesquisa}%`,
        `local_atual.ilike.%${pesquisa}%`,
        `qr_code.ilike.%${pesquisa}%`,
        `observacoes.ilike.%${pesquisa}%`
      ].join(',')
    )
  }

  if (filtros.tipo) {
    query = query.eq(
      'tipo',
      maiusculo(
        filtros.tipo
      )
    )
  }

  if (
    filtros.status_operacional
  ) {
    query = query.eq(
      'status_operacional',
      maiusculo(
        filtros.status_operacional
      )
    )
  }

  if (filtros.unidade) {
    query = query.eq(
      'unidade',
      maiusculo(
        filtros.unidade
      )
    )
  }

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    throw error
  }

  return {
    data:
      (data || []).map(
        normalizarTonfa
      ),

    total:
      count || 0
  }
}

export async function buscarTonfaPorId(
  id
) {
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

  return normalizarTonfa(
    data
  )
}

export async function cadastrarTonfa(
  payload,
  user = null
) {
  const dados = prepararPayloadCadastro(payload)
  const quantidadeRecebida = validarQuantidade(dados.quantidade)

  dados.qr_code = gerarQrCode(dados.tipo)

  const estoqueExistente =
    await buscarEstoqueAtivoPorTipo(dados.tipo)

  let salvo = null
  let patrimonioLegado = null
  let cadastroNovo = false
  let estoqueAnterior = null

  try {
    if (estoqueExistente) {
      estoqueAnterior = { ...estoqueExistente }

      const quantidadeP4Atual =
        numeroInteiro(estoqueExistente.quantidade_p4)

      const quantidadeSvddAtual =
        numeroInteiro(estoqueExistente.quantidade_svdd)

      const quantidadeEmServicoAtual =
        numeroInteiro(estoqueExistente.quantidade_em_servico)

      const novaQuantidadeTotal =
        numeroInteiro(estoqueExistente.quantidade) +
        quantidadeRecebida

      const novaQuantidadeP4 =
        quantidadeP4Atual + quantidadeRecebida

      const { data, error } = await supabase
        .from(TABLE)
        .update({
          quantidade: novaQuantidadeTotal,
          quantidade_disponivel: novaQuantidadeP4,
          quantidade_p4: novaQuantidadeP4,
          quantidade_svdd: quantidadeSvddAtual,
          quantidade_em_servico: quantidadeEmServicoAtual,
          unidade: dados.unidade || estoqueExistente.unidade,
          status_operacional: obterStatusEstoque({
            quantidadeP4: novaQuantidadeP4,
            quantidadeSvdd: quantidadeSvddAtual,
            quantidadeEmServico: quantidadeEmServicoAtual
          }),
          local_atual: obterLocalEstoque({
            quantidadeP4: novaQuantidadeP4,
            quantidadeSvdd: quantidadeSvddAtual,
            quantidadeEmServico: quantidadeEmServicoAtual
          }),
          observacoes: dados.observacoes || estoqueExistente.observacoes,
          foto_url: dados.foto_url || estoqueExistente.foto_url,
          qr_code: estoqueExistente.qr_code || dados.qr_code
        })
        .eq('id', estoqueExistente.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      salvo = normalizarTonfa(data)
    } else {
      cadastroNovo = true

      const { data, error } = await supabase
        .from(TABLE)
        .insert(dados)
        .select()
        .single()

      if (error) {
        throw error
      }

      salvo = normalizarTonfa(data)
    }

    patrimonioLegado =
      await sincronizarPatrimonioTonfa(salvo, user)

    const unidade =
      salvo.unidade || '27º BPM/M - 5ª CIA'

    const codigoItem =
      salvo.tipo === 'CASSETETE'
        ? 'CASSETETE-PADRAO'
        : 'TONFA-PADRAO'

    const recebimentoEngine =
      await receberPatrimonioPorCodigo({
        codigoItem,
        quantidade: quantidadeRecebida,
        natureza: maiusculo(payload?.natureza) || 'PROPRIO',
        proprietario: {
          tipo: 'PMESP',
          id: 'PMESP',
          nome: 'PMESP'
        },
        gestor: {
          tipo: 'P4',
          id: unidade,
          nome: `P4 - ${unidade}`
        },
        guardiao: {
          tipo: 'P4',
          id: unidade,
          nome: `P4 - ${unidade}`
        },
        local: {
          tipo: 'SETOR',
          id: 'P4',
          nome: salvo.local_atual || 'P4'
        },
        origem: {
          tipo: maiusculo(payload?.origem_tipo) || 'RECEBIMENTO',
          id: texto(payload?.origem_id) || salvo.id,
          nome: texto(payload?.origem_nome) || unidade
        },
        observacoes: salvo.observacoes,
        metadata: {
          modulo: 'TONFAS',
          sigmo_tonfa_id: salvo.id,
          sigmo_patrimonio_legado_id: patrimonioLegado?.id || null,
          tipo: salvo.tipo,
          qr_code: salvo.qr_code,
          unidade,
          quantidade_recebida: quantidadeRecebida,
          saldo_anterior: estoqueAnterior?.quantidade || 0,
          saldo_posterior: salvo.quantidade,
          operacao: cadastroNovo ? 'CADASTRO_INICIAL' : 'NOVO_LOTE'
        },
        user
      })

    return {
      ...salvo,
      quantidade_recebida: quantidadeRecebida,
      patrimonio_engine: recebimentoEngine
    }
  } catch (error) {
    try {
      if (cadastroNovo && salvo?.id) {
        if (patrimonioLegado?.id) {
          await desativarPatrimonioPorReferencia({
            tipo: 'tonfa',
            referencia_id: salvo.id,
            user,
            motivo: 'Rollback: falha ao registrar o recebimento na Patrimônio Engine.'
          })
        }

        await supabase
          .from(TABLE)
          .delete()
          .eq('id', salvo.id)
      } else if (estoqueAnterior?.id) {
        await supabase
          .from(TABLE)
          .update({
            quantidade: estoqueAnterior.quantidade,
            quantidade_disponivel: estoqueAnterior.quantidade_disponivel,
            quantidade_em_servico: estoqueAnterior.quantidade_em_servico,
            quantidade_p4: estoqueAnterior.quantidade_p4,
            quantidade_svdd: estoqueAnterior.quantidade_svdd,
            unidade: estoqueAnterior.unidade,
            status_operacional: estoqueAnterior.status_operacional,
            local_atual: estoqueAnterior.local_atual,
            observacoes: estoqueAnterior.observacoes,
            qr_code: estoqueAnterior.qr_code,
            foto_url: estoqueAnterior.foto_url,
            ativo: estoqueAnterior.ativo
          })
          .eq('id', estoqueAnterior.id)

        await sincronizarPatrimonioTonfa(estoqueAnterior, user)
      }
    } catch (rollbackError) {
      console.error('Erro ao desfazer o recebimento de lote:', rollbackError)
    }

    throw error
  }
}

export async function atualizarTonfa(
  id,
  payload,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID da Tonfa não informado.'
    )
  }

  const dados =
    prepararPayloadAtualizacao(
      payload
    )

  const tipoJaExiste =
    await verificarTipoExistente(
      dados.tipo,
      id
    )

  if (tipoJaExiste) {
    throw new Error(
      dados.tipo ===
      'CASSETETE'
        ? 'Já existe outro estoque ativo de Cassetete.'
        : 'Já existe outro estoque ativo de Tonfa.'
    )
  }

  const atual =
    await buscarTonfaPorId(
      id
    )

  const foraDoP4 =
    atual.quantidade_svdd +
    atual.quantidade_em_servico

  if (
    dados.quantidade <
    foraDoP4
  ) {
    throw new Error(
      `A quantidade total não pode ser menor que ${foraDoP4}, pois essa quantidade está fora do P4.`
    )
  }

  const novaQuantidadeP4 =
    dados.quantidade -
    foraDoP4

  dados.quantidade_p4 =
    novaQuantidadeP4

  dados.quantidade_disponivel =
    novaQuantidadeP4

  dados.quantidade_svdd =
    atual.quantidade_svdd

  dados.quantidade_em_servico =
    atual.quantidade_em_servico

  dados.status_operacional =
    obterStatusEstoque({
      quantidadeP4:
        novaQuantidadeP4,

      quantidadeSvdd:
        atual.quantidade_svdd,

      quantidadeEmServico:
        atual.quantidade_em_servico
    })

  dados.local_atual =
    obterLocalEstoque({
      quantidadeP4:
        novaQuantidadeP4,

      quantidadeSvdd:
        atual.quantidade_svdd,

      quantidadeEmServico:
        atual.quantidade_em_servico
    })

  dados.qr_code =
    gerarQrCode(
      dados.tipo
    )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update(dados)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  const salvo =
    normalizarTonfa(
      data
    )

  await sincronizarPatrimonioTonfa(
    salvo,
    user
  )

  return salvo
}

export async function excluirTonfa(
  id,
  user = null
) {
  if (!id) {
    throw new Error(
      'ID da Tonfa não informado.'
    )
  }

  const atual =
    await buscarTonfaPorId(
      id
    )

  const foraDoP4 =
    atual.quantidade_svdd +
    atual.quantidade_em_servico

  if (foraDoP4 > 0) {
    throw new Error(
      'Não é possível excluir um estoque com materiais fora da guarda direta do P4.'
    )
  }

  await desativarPatrimonioPorReferencia({
    tipo:
      'tonfa',

    referencia_id:
      id,

    user,

    motivo:
      'Estoque de Tonfa ou Cassetete excluído.'
  })

  const {
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}

/*
 * =====================================================
 * MOVIMENTAÇÕES PATRIMONIAIS
 * =====================================================
 */

export async function distribuirTonfaParaSvdd({
  tonfaId,
  quantidade,
  observacoes = null,
  user = null
}) {
  const valor =
    validarQuantidade(
      quantidade
    )

  const tonfa =
    await buscarTonfaPorId(
      tonfaId
    )

  if (
    valor >
    tonfa.quantidade_p4
  ) {
    throw new Error(
      `O P4 possui apenas ${tonfa.quantidade_p4} unidade(s) disponível(is).`
    )
  }

  const patrimonio =
    await buscarPatrimonioDaTonfa(
      tonfaId
    )

  return executarMovimentacaoComRollback({
    tonfaAtual:
      tonfa,

    novosSaldos: {
      quantidade_p4:
        tonfa.quantidade_p4 -
        valor,

      quantidade_svdd:
        tonfa.quantidade_svdd +
        valor,

      quantidade_em_servico:
        tonfa.quantidade_em_servico
    },

    user,

   movimentacao: () =>
  movimentarPatrimonio({
    patrimonioId:
      patrimonio.id,

    tipo:
      TIPOS_MOVIMENTACAO_PATRIMONIAL.TRANSFERENCIA,

    origem:
      GUARDIOES_PATRIMONIAIS.P4,

    destino:
      GUARDIOES_PATRIMONIAIS.SVDD,

    quantidade:
      valor,

    statusNovo:
      STATUS_PATRIMONIAL.CARGA,

    observacoes,

    dados: {
      categoria:
        tonfa.tipo,

      tonfa_id:
        tonfa.id
    },

    usuario:
      user
  })
  })
}

export async function cautelarTonfaParaPolicial({
  tonfaId,
  policial,
  quantidade = 1,
  devolucaoPrevista = null,
  observacoes = null,
  user = null
}) {
  const valor =
    validarQuantidade(
      quantidade
    )

  const tonfa =
    await buscarTonfaPorId(
      tonfaId
    )

  if (
    valor >
    tonfa.quantidade_svdd
  ) {
    throw new Error(
      `O Serviço de Dia possui apenas ${tonfa.quantidade_svdd} unidade(s) disponível(is).`
    )
  }

  const patrimonio =
    await buscarPatrimonioDaTonfa(
      tonfaId
    )

  const guardiaoPolicial =
    criarGuardiaoPolicial(
      policial
    )

  return executarMovimentacaoComRollback({
    tonfaAtual:
      tonfa,

    novosSaldos: {
      quantidade_p4:
        tonfa.quantidade_p4,

      quantidade_svdd:
        tonfa.quantidade_svdd -
        valor,

      quantidade_em_servico:
        tonfa.quantidade_em_servico +
        valor
    },

    user,

    movimentacao: () =>
      movimentarPatrimonio({
        patrimonioId:
          patrimonio.id,

        tipo:
          TIPOS_MOVIMENTACAO_PATRIMONIAL.CAUTELA_SERVICO,

        origem:
          GUARDIOES_PATRIMONIAIS.SERVICO_DIA,

        destino:
          guardiaoPolicial,

        quantidade:
          valor,

        statusNovo:
          STATUS_PATRIMONIAL.EM_SERVICO,

        devolucaoPrevista,

        observacoes,

        dados: {
          categoria:
            tonfa.tipo,

          tonfa_id:
            tonfa.id,

          policial_id:
            policial.id ||
            null,

          policial_re:
            policial.re ||
            null,

          policial_nome:
            policial.nome_guerra ||
            policial.nome ||
            null
        },

        usuario:
          user
      })
  })
}

export async function devolverTonfaDoPolicialAoSvdd({
  tonfaId,
  policial,
  quantidade = 1,
  observacoes = null,
  user = null
}) {
  const valor =
    validarQuantidade(
      quantidade
    )

  const tonfa =
    await buscarTonfaPorId(
      tonfaId
    )

  if (
    valor >
    tonfa.quantidade_em_servico
  ) {
    throw new Error(
      `Existem apenas ${tonfa.quantidade_em_servico} unidade(s) registradas em serviço.`
    )
  }

  const patrimonio =
    await buscarPatrimonioDaTonfa(
      tonfaId
    )

  const guardiaoPolicial =
    criarGuardiaoPolicial(
      policial
    )

  return executarMovimentacaoComRollback({
    tonfaAtual:
      tonfa,

    novosSaldos: {
      quantidade_p4:
        tonfa.quantidade_p4,

      quantidade_svdd:
        tonfa.quantidade_svdd +
        valor,

      quantidade_em_servico:
        tonfa.quantidade_em_servico -
        valor
    },

    user,

    movimentacao: () =>
      movimentarPatrimonio({
        patrimonioId:
          patrimonio.id,

        tipo:
          TIPOS_MOVIMENTACAO_PATRIMONIAL.DEVOLUCAO,

        origem:
          guardiaoPolicial,

        destino:
          GUARDIOES_PATRIMONIAIS.SERVICO_DIA,

        quantidade:
          valor,

        statusNovo:
          STATUS_PATRIMONIAL.EM_SERVICO,

        observacoes,

        dados: {
          categoria:
            tonfa.tipo,

          tonfa_id:
            tonfa.id,

          policial_id:
            policial.id ||
            null,

          policial_re:
            policial.re ||
            null,

          policial_nome:
            policial.nome_guerra ||
            policial.nome ||
            null
        },

        usuario:
          user
      })
  })
}

export async function devolverTonfaDoSvddAoP4({
  tonfaId,
  quantidade,
  observacoes = null,
  user = null
}) {
  const valor =
    validarQuantidade(
      quantidade
    )

  const tonfa =
    await buscarTonfaPorId(
      tonfaId
    )

  if (
    valor >
    tonfa.quantidade_svdd
  ) {
    throw new Error(
      `O Serviço de Dia possui apenas ${tonfa.quantidade_svdd} unidade(s).`
    )
  }

  const patrimonio =
    await buscarPatrimonioDaTonfa(
      tonfaId
    )

  return executarMovimentacaoComRollback({
    tonfaAtual:
      tonfa,

    novosSaldos: {
      quantidade_p4:
        tonfa.quantidade_p4 +
        valor,

      quantidade_svdd:
        tonfa.quantidade_svdd -
        valor,

      quantidade_em_servico:
        tonfa.quantidade_em_servico
    },

    user,

    movimentacao: () =>
      movimentarPatrimonio({
        patrimonioId:
          patrimonio.id,

        tipo:
          TIPOS_MOVIMENTACAO_PATRIMONIAL.DEVOLUCAO,

        origem:
          GUARDIOES_PATRIMONIAIS.SERVICO_DIA,

        destino:
          GUARDIOES_PATRIMONIAIS.P4,

        quantidade:
          valor,

        statusNovo:
          STATUS_PATRIMONIAL.RESERVA,

        observacoes,

        dados: {
          categoria:
            tonfa.tipo,

          tonfa_id:
            tonfa.id
        },

        usuario:
          user
      })
  })
}

export async function conferirSaldoTonfa(
  tonfaId
) {
  const tonfa =
    await buscarTonfaPorId(
      tonfaId
    )

  const totalSobGuarda =
    obterTotalSobGuarda(
      tonfa
    )

  return {
    tonfa,

    quantidade_total:
      tonfa.quantidade,

    quantidade_p4:
      tonfa.quantidade_p4,

    quantidade_svdd:
      tonfa.quantidade_svdd,

    quantidade_em_servico:
      tonfa.quantidade_em_servico,

    total_sob_guarda:
      totalSobGuarda,

    divergencia:
      totalSobGuarda !==
      tonfa.quantidade,

    diferenca:
      tonfa.quantidade -
      totalSobGuarda
  }
}