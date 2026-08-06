import { supabase } from './supabaseClient'

import {
  buscarMovimentacaoPorId,
  confirmarRecebimentoMovimentacao,
  listarMinhaCautela,
  listarMovimentacoes
} from './movimentacoesService'

import {
  criarMovimentacaoCompleta
} from './movimentacaoEngine'

import {
  cautelarTonfaParaPolicial,
  devolverTonfaDoPolicialAoSvdd
} from './tonfasService'

function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}


function obterRePolicial(user) {
  return String(
    user?.re ||
    user?.policial_re ||
    user?.matricula ||
    ''
  )
    .replace(/\D/g, '')
    .slice(0, 6)
}

function obterPolicialId(user) {
  return (
    user?.policial_id ||
    user?.id_policial ||
    user?.id ||
    null
  )
}

function ehCautela(movimentacao) {
  return normalizar(
    movimentacao?.tipo_movimentacao ||
    movimentacao?.tipo
  ) === 'cautela'
}

function ehDevolucao(movimentacao) {
  return normalizar(
    movimentacao?.tipo_movimentacao ||
    movimentacao?.tipo
  ) === 'devolucao'
}

function statusEh(movimentacao, ...status) {
  const atual = normalizar(
    movimentacao?.status
  ).replace(/\s+/g, '_')

  return status
    .map((item) =>
      normalizar(item)
        .replace(/\s+/g, '_')
    )
    .includes(atual)
}

async function carregarDetalhes(movimentacoes) {
  const resultados = []

  for (const movimentacao of movimentacoes) {
    try {
      const detalhe =
        await buscarMovimentacaoPorId(
          movimentacao.id
        )

      resultados.push(
        detalhe || movimentacao
      )
    } catch (error) {
      console.warn(
        'Não foi possível carregar os itens da cautela:',
        error
      )

      resultados.push(movimentacao)
    }
  }

  return resultados
}

export async function listarCautelasAguardandoUsuario(
  user
) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  const {
    data: movimentacoes,
    error
  } = await supabase
    .from('sigmo_movimentacoes')
    .select('*')
    .eq('recebedor_id', policialId)
    .eq('tipo_movimentacao', 'CAUTELA')
    .eq('status', 'aguardando_recebimento')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return carregarDetalhes(movimentacoes || [])
}

export async function listarMateriaisEmServicoUsuario(
  user
) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  return listarMinhaCautela(policialId)
}

export async function listarDevolucoesPendentesUsuario(
  user
) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    return []
  }

  const movimentacoes =
    await listarMovimentacoes({
      solicitante_id: policialId
    })

  return carregarDetalhes(
    movimentacoes.filter(
      (movimentacao) =>
        ehDevolucao(movimentacao) &&
        statusEh(
          movimentacao,
          'aguardando_aprovacao',
          'aguardando_recebimento',
          'em_andamento'
        )
    )
  )
}

export async function confirmarRecebimentoCautela({
  movimentacaoId,
  itens = [],
  user
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Cautela não informada.'
    )
  }

  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacao) {
    throw new Error(
      'Movimentação não encontrada.'
    )
  }

  const selecoesPorItem = new Map(
    (Array.isArray(itens) ? itens : [])
      .filter((item) => item?.itemId)
      .map((item) => [
        String(item.itemId),
        item
      ])
  )

  const patrimonioIds = [
    ...new Set(
      (movimentacao.itens || [])
        .map((item) => item?.patrimonio_id)
        .filter(Boolean)
    )
  ]

  let patrimoniosPorId = new Map()

  if (patrimonioIds.length > 0) {
    const {
      data: patrimonios,
      error: patrimoniosError
    } = await supabase
      .from('sigmo_patrimonios')
      .select('id, tipo, referencia_id, descricao')
      .in('id', patrimonioIds)

    if (patrimoniosError) {
      throw patrimoniosError
    }

    patrimoniosPorId = new Map(
      (patrimonios || []).map(
        (patrimonio) => [
          String(patrimonio.id),
          patrimonio
        ]
      )
    )
  }

  const itensQuantitativos = []

  for (const item of movimentacao.itens || []) {
    const patrimonio =
      patrimoniosPorId.get(
        String(item?.patrimonio_id)
      )

    let observacao = {}

    try {
      observacao = item?.observacao
        ? JSON.parse(item.observacao)
        : {}
    } catch {
      observacao = {}
    }

    const ehTonfa =
      normalizar(patrimonio?.tipo) === 'tonfa' ||
      normalizar(item?.tipo_patrimonio) === 'tonfa' ||
      normalizar(observacao?.tipo_registro) ===
        'tonfa_quantidade'

    if (!ehTonfa) {
      continue
    }

    const tonfaId =
      observacao?.tonfa_id ||
      patrimonio?.referencia_id ||
      null

    if (!tonfaId) {
      throw new Error(
        `Não foi possível identificar o estoque quantitativo de ${
          item?.descricao ||
          patrimonio?.descricao ||
          'Tonfa/Cassetete'
        }.`
      )
    }

    const quantidadeEnviada =
      Math.max(
        1,
        Number(item?.quantidade || 1) || 1
      )

    const selecao =
      selecoesPorItem.get(
        String(item?.id)
      )

    const quantidadeReceber =
      Math.max(
        1,
        Math.min(
          Number(
            selecao?.quantidadeReceber ??
            quantidadeEnviada
          ) || 1,
          quantidadeEnviada
        )
      )

    itensQuantitativos.push({
      item,
      patrimonio,
      tonfaId,
      quantidadeEnviada,
      quantidadeReceber,
      saldoNaoRecebido:
        quantidadeEnviada -
        quantidadeReceber,
      observacaoOriginal:
        item?.observacao || ''
    })
  }

  const policialRe = obterRePolicial(user)

  if (policialRe.length !== 6) {
    throw new Error(
      'O usuário deve possuir RE funcional com 6 dígitos.'
    )
  }

  const policial = {
    ...user,
    id: policialId,
    policial_id: policialId,
    re: policialRe,
    policial_re: policialRe
  }

  const processados = []
  const itensMovimentacaoAlterados = []

  try {
    for (const registro of itensQuantitativos) {
      const observacaoAtualizada = {
        tipo_registro:
          'TONFA_QUANTIDADE',
        tonfa_id:
          registro.tonfaId,
        quantidade_enviada:
          registro.quantidadeEnviada,
        quantidade_recebida:
          registro.quantidadeReceber,
        saldo_nao_recebido:
          registro.saldoNaoRecebido,
        recebimento_parcial:
          registro.saldoNaoRecebido > 0
      }

      const {
        error: atualizarItemError
      } = await supabase
        .from('sigmo_movimentacao_itens')
        .update({
          quantidade:
            registro.quantidadeReceber,
          observacao:
            JSON.stringify(
              observacaoAtualizada
            )
        })
        .eq('id', registro.item.id)

      if (atualizarItemError) {
        throw atualizarItemError
      }

      itensMovimentacaoAlterados.push(
        registro
      )

      await cautelarTonfaParaPolicial({
        tonfaId:
          registro.tonfaId,
        policial,
        quantidade:
          registro.quantidadeReceber,
        observacoes:
          registro.saldoNaoRecebido > 0
            ? `RECEBIMENTO PARCIAL PELO USUÁRIO. ENVIADO: ${registro.quantidadeEnviada}. RECEBIDO: ${registro.quantidadeReceber}. SALDO MANTIDO NO SVDD: ${registro.saldoNaoRecebido}.`
            : 'CARRINHO RECEBIDO INTEGRALMENTE PELO USUÁRIO.',
        user
      })

      processados.push(registro)
    }

    const houveRecebimentoParcial =
      itensQuantitativos.some(
        (item) =>
          item.saldoNaoRecebido > 0
      )

    await confirmarRecebimentoMovimentacao({
      movimentacao_id:
        movimentacaoId,
      recebedor:
        policial,
      observacao:
        houveRecebimentoParcial
          ? 'CARRINHO RECEBIDO COM AJUSTE DE QUANTIDADE. O SALDO NÃO ACEITO PERMANECEU NO COFRE DO SVDD.'
          : 'CARRINHO RECEBIDO INTEGRALMENTE PELO USUÁRIO.'
    })

    const totalQuantitativoRecebido =
      itensQuantitativos.reduce(
        (total, item) =>
          total +
          item.quantidadeReceber,
        0
      )

    const totalMantidoSvdd =
      itensQuantitativos.reduce(
        (total, item) =>
          total +
          item.saldoNaoRecebido,
        0
      )

    return {
      sucesso: true,
      recebimento_parcial:
        totalMantidoSvdd > 0,
      total_quantitativo_recebido:
        totalQuantitativoRecebido,
      total_mantido_svdd:
        totalMantidoSvdd,
      mensagem:
        totalMantidoSvdd > 0
          ? `Recebimento parcial concluído. ${totalQuantitativoRecebido} unidade(s) recebida(s) e ${totalMantidoSvdd} unidade(s) mantida(s) no Cofre do SVDD.`
          : 'Cautela recebida com sucesso. Os materiais já estão sob sua responsabilidade.'
    }
  } catch (error) {
    for (const registro of [...processados].reverse()) {
      try {
        await devolverTonfaDoPolicialAoSvdd({
          tonfaId:
            registro.tonfaId,
          policial,
          quantidade:
            registro.quantidadeReceber,
          observacoes:
            'ROLLBACK AUTOMÁTICO: FALHA AO FINALIZAR O CARRINHO.',
          user
        })
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar saldo quantitativo após erro no recebimento:',
          rollbackError
        )
      }
    }

    for (const registro of [...itensMovimentacaoAlterados].reverse()) {
      try {
        await supabase
          .from('sigmo_movimentacao_itens')
          .update({
            quantidade:
              registro.quantidadeEnviada,
            observacao:
              registro.observacaoOriginal
          })
          .eq('id', registro.item.id)
      } catch (rollbackItemError) {
        console.error(
          'Falha ao restaurar o item quantitativo da movimentação:',
          rollbackItemError
        )
      }
    }

    throw error
  }
}

export async function solicitarDevolucaoCautela({
  user,
  itens = []
}) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error(
      'Nenhum material em serviço foi localizado para devolução.'
    )
  }

  const itensMovimentacao = itens
    .map((item) => ({
      id: item?.id,
      patrimonio_id:
        item?.patrimonio_id ||
        item?.id,
      quantidade:
        Number(item?.quantidade || 1) || 1
    }))
    .filter((item) => item.patrimonio_id)

  if (itensMovimentacao.length === 0) {
    throw new Error(
      'Os materiais não possuem identificação patrimonial válida.'
    )
  }

  return criarMovimentacaoCompleta({
    tipo: 'DEVOLUCAO',
    origemLocal: 'CAUTELA INDIVIDUAL',
    destinoLocal: 'COFRE DO SVDD',
    solicitante: {
      ...user,
      id: policialId
    },
    recebedor: null,
    observacoes:
      'DEVOLUÇÃO INTEGRAL SOLICITADA PELO USUÁRIO.',
    itens: itensMovimentacao,
    aprovarAutomaticamente: false
  })
}
