import { supabase } from './supabaseClient'
import { criarOuAtualizarPatrimonio } from './patrimoniosService'
import {
  buscarMovimentacaoPorId,
  cancelarMovimentacao,
  concluirMovimentacao,
  listarMovimentacoesPendentes,
  registrarMovimentacao,
  STATUS_MOVIMENTACAO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function numeroInteiro(valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.max(0, Math.trunc(numero))
}

function dadosMovimentacaoPatrimonial(movimentacao) {
  return (
    movimentacao?.dados ||
    movimentacao?.metadata?.dados_engine ||
    {}
  )
}

function origemMovimentacaoPatrimonial(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return maiusculo(
    movimentacao?.origem_guardiao_codigo ||
    movimentacao?.metadata?.guardiao_origem?.codigo ||
    dados?.guardiao_origem?.codigo ||
    dados?.origem_codigo ||
    ''
  )
}

function destinoMovimentacaoPatrimonial(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return maiusculo(
    movimentacao?.destino_guardiao_codigo ||
    movimentacao?.metadata?.guardiao_destino?.codigo ||
    dados?.guardiao_destino?.codigo ||
    dados?.destino_codigo ||
    ''
  )
}

function ehTransferenciaManutencaoTorniquete(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return (
    maiusculo(dados?.modulo || dados?.categoria) === 'TORNIQUETE' &&
    dados?.manutencao_em_transferencia === true &&
    origemMovimentacaoPatrimonial(movimentacao) === 'SVDD' &&
    destinoMovimentacaoPatrimonial(movimentacao) === 'P4'
  )
}

async function buscarTorniquete(torniqueteId) {
  if (!torniqueteId) {
    throw new Error('Torniquete não informado.')
  }

  const { data, error } = await supabase
    .from('sigmo_torniquetes')
    .select('*')
    .eq('id', torniqueteId)
    .eq('ativo', true)
    .maybeSingle()

  if (error) throw error

  if (!data?.id) {
    throw new Error('Controle de torniquetes não localizado.')
  }

  return data
}

async function buscarManutencaoTorniqueteAtiva(manutencaoId) {
  if (!manutencaoId) {
    throw new Error('Manutenção de torniquete não informada.')
  }

  const { data, error } = await supabase
    .from('sigmo_manutencoes')
    .select('*')
    .eq('id', manutencaoId)
    .maybeSingle()

  if (error) throw error

  if (!data?.id) {
    throw new Error('Manutenção de torniquete não localizada.')
  }

  if (maiusculo(data.modulo) !== 'TORNIQUETE') {
    throw new Error('O registro informado não pertence ao módulo de Torniquetes.')
  }

  if (maiusculo(data.status) !== 'EM_MANUTENCAO') {
    throw new Error('Somente manutenção ativa pode ser encaminhada ao P4.')
  }

  const origem = maiusculo(data.origem)

  if (
    !origem.includes('SVDD') &&
    !origem.includes('SERVICO DE DIA') &&
    !origem.includes('SERVIÇO DE DIA')
  ) {
    throw new Error('Esta manutenção não está atualmente sob responsabilidade do SVDD.')
  }

  return data
}

export async function criarTransferenciaManutencaoTorniquetePendente({
  manutencaoId,
  quantidade,
  observacoes = null,
  user = null
}) {
  const valor = numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error('Informe uma quantidade maior que zero.')
  }

  const manutencao = await buscarManutencaoTorniqueteAtiva(manutencaoId)
  const quantidadeManutencao = numeroInteiro(manutencao.quantidade)

  if (valor > quantidadeManutencao) {
    throw new Error(
      `A manutenção possui apenas ${quantidadeManutencao} unidade(s) sob responsabilidade do SVDD.`
    )
  }

  const torniqueteId = manutencao.referencia_id

  if (!torniqueteId) {
    throw new Error('A manutenção não possui referência do torniquete.')
  }

  const torniquete = await buscarTorniquete(torniqueteId)
  const pendentes = await listarMovimentacoesPendentes({ limite: 500 })

  const quantidadeJaPendente = (pendentes || [])
    .filter((item) => {
      const dados = dadosMovimentacaoPatrimonial(item)

      return (
        ehTransferenciaManutencaoTorniquete(item) &&
        String(dados?.manutencao_id || '') === String(manutencao.id)
      )
    })
    .reduce(
      (total, item) =>
        total + numeroInteiro(dadosMovimentacaoPatrimonial(item)?.quantidade),
      0
    )

  const quantidadeDisponivel = Math.max(
    0,
    quantidadeManutencao - quantidadeJaPendente
  )

  if (valor > quantidadeDisponivel) {
    throw new Error(
      `Existem apenas ${quantidadeDisponivel} unidade(s) desta manutenção disponíveis para encaminhamento ao P4.`
    )
  }

  const patrimonio = await criarOuAtualizarPatrimonio({
    tipo: 'torniquete',
    referencia_id: torniquete.id,
    dados: {
      ...torniquete,
      torniquete_id: torniquete.id,
      descricao: 'TORNIQUETE',
      tipo_registro: 'TORNIQUETE_QUANTIDADE',
      status_operacional: 'MANUTENCAO',
      local_atual: 'COFRE DO SVDD'
    },
    user,
    local_atual: 'COFRE DO SVDD',
    companhia_atual: ''
  })

  if (!patrimonio?.id) {
    throw new Error('Não foi possível vincular o torniquete à Engine patrimonial.')
  }

  const resultado = await registrarMovimentacao({
    patrimonioId: patrimonio.id,
    tipo: TIPOS_MOVIMENTACAO.TRANSFERENCIA,
    statusNovo: 'MANUTENCAO',
    localDestino: 'COFRE DO P4',
    companhiaDestino: '',
    motivo: 'ENCAMINHAMENTO_MANUTENCAO_SVDD_P4',
    observacao:
      texto(observacoes) ||
      `Encaminhamento de ${valor} torniquete(s) em manutenção: SVDD → P4.`,
    dados: {
      modulo: 'TORNIQUETE',
      categoria: 'TORNIQUETE',
      torniquete_id: torniquete.id,
      referencia_id: torniquete.id,
      manutencao_id: manutencao.id,
      quantidade: valor,
      status_movimentacao: STATUS_MOVIMENTACAO.PENDENTE,
      preservar_status_operacional: true,
      status_operacional_origem: 'MANUTENCAO',
      manutencao_em_transferencia: true,
      transferencia_manutencao_torniquete: true,
      guardiao_origem: {
        tipo: 'SETOR',
        codigo: 'SVDD',
        nome: 'COFRE DO SVDD'
      },
      guardiao_destino: {
        tipo: 'SETOR',
        codigo: 'P4',
        nome: 'COFRE DO P4'
      },
      local_origem: 'COFRE DO SVDD',
      local_destino: 'COFRE DO P4'
    },
    user
  })

  await criarOuAtualizarPatrimonio({
    tipo: 'torniquete',
    referencia_id: torniquete.id,
    dados: {
      ...torniquete,
      torniquete_id: torniquete.id,
      descricao: 'TORNIQUETE',
      tipo_registro: 'TORNIQUETE_QUANTIDADE',
      status_operacional: 'MANUTENCAO',
      local_atual: 'COFRE DO SVDD'
    },
    user,
    local_atual: 'COFRE DO SVDD',
    companhia_atual: ''
  })

  return {
    movimentacao: resultado?.movimentacao || null,
    manutencao,
    torniquete,
    quantidade: valor
  }
}

export async function listarTransferenciasManutencaoTorniquetePendentes({
  destinoCodigo = 'P4',
  limite = 200
} = {}) {
  const pendentes = await listarMovimentacoesPendentes({
    guardiaoCodigo: maiusculo(destinoCodigo),
    limite: Math.max(1, Math.min(Number(limite) || 200, 500))
  })

  return (pendentes || []).filter(ehTransferenciaManutencaoTorniquete)
}

export async function aceitarTransferenciaManutencaoTorniquete({
  movimentacaoId,
  user = null
}) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)

  if (
    !movimentacao ||
    !ehTransferenciaManutencaoTorniquete(movimentacao)
  ) {
    throw new Error('Transferência de manutenção de torniquete não encontrada.')
  }

  const dados = dadosMovimentacaoPatrimonial(movimentacao)
  const quantidade = numeroInteiro(
    dados?.quantidade || movimentacao?.quantidade
  )

  if (quantidade <= 0) {
    throw new Error('A transferência não possui quantidade válida.')
  }

  const manutencao = await buscarManutencaoTorniqueteAtiva(
    dados?.manutencao_id
  )

  const quantidadeOrigem = numeroInteiro(manutencao.quantidade)

  if (quantidade > quantidadeOrigem) {
    throw new Error(
      'A manutenção do SVDD não possui mais quantidade suficiente para concluir esta transferência.'
    )
  }

  const agora = new Date().toISOString()
  let manutencaoDestino = null
  let manutencaoOrigemAlterada = false

  try {
    if (quantidade === quantidadeOrigem) {
      const { data, error } = await supabase
        .from('sigmo_manutencoes')
        .update({
          origem: 'COFRE DO P4',
          atualizado_em: agora,
          observacoes: [
            texto(manutencao.observacoes),
            `RECEBIDA PELO P4 VIA TRANSFERÊNCIA ${movimentacaoId}`
          ]
            .filter(Boolean)
            .join(' | ')
        })
        .eq('id', manutencao.id)
        .eq('quantidade', quantidadeOrigem)
        .select('*')
        .maybeSingle()

      if (error) throw error

      if (!data?.id) {
        throw new Error(
          'A manutenção foi alterada por outra operação. Atualize e tente novamente.'
        )
      }

      manutencaoDestino = data
      manutencaoOrigemAlterada = true
    } else {
      const { data: origemAtualizada, error: erroOrigem } = await supabase
        .from('sigmo_manutencoes')
        .update({
          quantidade: quantidadeOrigem - quantidade,
          atualizado_em: agora
        })
        .eq('id', manutencao.id)
        .eq('quantidade', quantidadeOrigem)
        .select('*')
        .maybeSingle()

      if (erroOrigem) throw erroOrigem

      if (!origemAtualizada?.id) {
        throw new Error(
          'A manutenção foi alterada por outra operação. Atualize e tente novamente.'
        )
      }

      manutencaoOrigemAlterada = true

      const novaManutencao = {
        ...manutencao,
        id: undefined,
        quantidade,
        origem: 'COFRE DO P4',
        criado_em: agora,
        atualizado_em: agora,
        observacoes: [
          texto(manutencao.observacoes),
          `RECEBIDA PELO P4 VIA TRANSFERÊNCIA ${movimentacaoId}`,
          `MANUTENÇÃO DE ORIGEM: ${manutencao.id}`
        ]
          .filter(Boolean)
          .join(' | ')
      }

      delete novaManutencao.created_at
      delete novaManutencao.updated_at

      const { data: destinoCriado, error: erroDestino } = await supabase
        .from('sigmo_manutencoes')
        .insert(novaManutencao)
        .select('*')
        .single()

      if (erroDestino) throw erroDestino

      manutencaoDestino = destinoCriado
    }

    await concluirMovimentacao({
      movimentacaoId,
      observacao: `P4 recebeu ${quantidade} torniquete(s) em manutenção do SVDD.`,
      user
    })

    const torniquete = await buscarTorniquete(
      dados?.torniquete_id || manutencao.referencia_id
    )

    await criarOuAtualizarPatrimonio({
      tipo: 'torniquete',
      referencia_id: torniquete.id,
      dados: {
        ...torniquete,
        torniquete_id: torniquete.id,
        descricao: 'TORNIQUETE',
        tipo_registro: 'TORNIQUETE_QUANTIDADE',
        status_operacional: 'MANUTENCAO',
        local_atual: 'COFRE DO P4'
      },
      user,
      local_atual: 'COFRE DO P4',
      companhia_atual: ''
    })

    return {
      manutencao: manutencaoDestino,
      quantidade,
      movimentacao_id: movimentacaoId
    }
  } catch (error) {
    if (
      manutencaoDestino?.id &&
      String(manutencaoDestino.id) !== String(manutencao.id)
    ) {
      try {
        await supabase
          .from('sigmo_manutencoes')
          .delete()
          .eq('id', manutencaoDestino.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao remover manutenção de torniquete criada no rollback:',
          rollbackError
        )
      }
    }

    if (manutencaoOrigemAlterada) {
      try {
        await supabase
          .from('sigmo_manutencoes')
          .update({
            quantidade: quantidadeOrigem,
            origem: manutencao.origem,
            observacoes: manutencao.observacoes,
            atualizado_em: manutencao.atualizado_em
          })
          .eq('id', manutencao.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar manutenção de torniquete após erro no aceite:',
          rollbackError
        )
      }
    }

    throw error
  }
}

export async function recusarTransferenciaManutencaoTorniquete({
  movimentacaoId,
  motivo,
  user = null
}) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)

  if (
    !movimentacao ||
    !ehTransferenciaManutencaoTorniquete(movimentacao)
  ) {
    throw new Error('Transferência de manutenção de torniquete não encontrada.')
  }

  await cancelarMovimentacao({
    movimentacaoId,
    motivo:
      texto(motivo) ||
      'TRANSFERÊNCIA DE MANUTENÇÃO DE TORNIQUETE RECUSADA PELO P4',
    user
  })

  return true
}
