import {
  adicionarItemMovimentacao,
  aprovarMovimentacao,
  buscarMovimentacaoPorId,
  cancelarMovimentacao,
  confirmarRecebimentoMovimentacao,
  criarMovimentacao
} from './movimentacoesService'

function obterIdMovimentacao(resultado) {
  if (!resultado) return null

  if (typeof resultado === 'string') {
    return resultado
  }

  if (Array.isArray(resultado)) {
    return (
      resultado[0]?.id ||
      resultado[0]?.movimentacao_id ||
      null
    )
  }

  return (
    resultado.id ||
    resultado.movimentacao_id ||
    null
  )
}

export async function iniciarMovimentacao({
  tipo,
  origemLocal,
  destinoLocal,
  solicitante,
  recebedor,
  observacoes = ''
}) {
  if (!tipo) {
    throw new Error(
      'Tipo de movimentação não informado.'
    )
  }

  if (!origemLocal) {
    throw new Error(
      'Local de origem não informado.'
    )
  }

  if (!destinoLocal) {
    throw new Error(
      'Local de destino não informado.'
    )
  }

  const resultado = await criarMovimentacao({
    tipo_movimentacao: tipo,
    origem_local: origemLocal,
    destino_local: destinoLocal,
    solicitante,
    recebedor,
    observacoes
  })

  const movimentacaoId =
    obterIdMovimentacao(resultado)

  if (!movimentacaoId) {
    throw new Error(
      'A movimentação foi criada, mas o identificador não foi retornado.'
    )
  }

  return {
    movimentacaoId,
    resultado
  }
}

export async function incluirItensMovimentacao({
  movimentacaoId,
  itens,
  usuario
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Movimentação não informada.'
    )
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error(
      'Nenhum item informado.'
    )
  }

  const resultados = []

  for (const item of itens) {
    const patrimonioId =
      item.patrimonio_id ||
      item.id

    if (!patrimonioId) {
      continue
    }

    const resultado =
      await adicionarItemMovimentacao({
        movimentacao_id:
          movimentacaoId,
        patrimonio_id:
          patrimonioId,
        quantidade:
          item.quantidade || 1,
        observacao:
          item.observacao || '',
        usuario
      })

    resultados.push(resultado)
  }

  return resultados
}

export async function criarMovimentacaoCompleta({
  tipo,
  origemLocal,
  destinoLocal,
  solicitante,
  recebedor,
  observacoes = '',
  itens = [],
  aprovarAutomaticamente = false,
  aprovador = null
}) {
  const { movimentacaoId, resultado } =
    await iniciarMovimentacao({
      tipo,
      origemLocal,
      destinoLocal,
      solicitante,
      recebedor,
      observacoes
    })

  await incluirItensMovimentacao({
    movimentacaoId,
    itens,
    usuario: solicitante
  })

  if (aprovarAutomaticamente) {
    await aprovarMovimentacao({
      movimentacao_id:
        movimentacaoId,
      aprovador:
        aprovador || solicitante,
      observacao:
        'MOVIMENTAÇÃO APROVADA AUTOMATICAMENTE PELO FLUXO OPERACIONAL.'
    })
  }

  return {
    movimentacaoId,
    resultado
  }
}

export async function obterMovimentacao(
  movimentacaoId
) {
  return buscarMovimentacaoPorId(
    movimentacaoId
  )
}

export async function finalizarMovimentacao({
  movimentacaoId,
  recebedor,
  observacao = ''
}) {
  return confirmarRecebimentoMovimentacao({
    movimentacao_id:
      movimentacaoId,
    recebedor,
    observacao
  })
}

export async function cancelarMovimentacaoEngine({
  movimentacaoId,
  usuario,
  observacao = ''
}) {
  return cancelarMovimentacao({
    movimentacao_id:
      movimentacaoId,
    usuario,
    observacao
  })
}