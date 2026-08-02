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

const TABLE = 'sigmo_hts'

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor) {
  return texto(valor).toUpperCase()
}

function obterHTId(movimentacao) {
  return (
    movimentacao?.dados?.ht_id ||
    movimentacao?.metadata?.dados_engine?.ht_id ||
    movimentacao?.metadata?.patrimonio?.referencia_id ||
    null
  )
}

async function buscarHT(id) {
  if (!id) throw new Error('HT não informado.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

async function sincronizarHT(ht, user) {
  return criarOuAtualizarPatrimonio({
    tipo: 'ht',
    referencia_id: ht.id,
    dados: ht,
    user,
    local_atual: ht.local_atual || 'GUARDA DO P4',
    companhia_atual: ht.unidade || ''
  })
}

function localDoCodigo(codigo, nomePersonalizado = null) {
  const codigoNormalizado = upper(codigo)
  const nome = texto(nomePersonalizado)
  if (codigoNormalizado === 'SVDD') return 'COFRE DO SVDD'
  if (codigoNormalizado === 'P4') return 'GUARDA DO P4'
  if (codigoNormalizado === 'OUTROS') return nome || 'OUTROS'
  return nome || codigoNormalizado
}

export async function criarTransferenciaHTPendente({
  htId,
  origemCodigo,
  destinoCodigo,
  destinoNome = null,
  user = null
}) {
  const ht = await buscarHT(htId)
  const origem = upper(origemCodigo)
  const destino = upper(destinoCodigo)

  const destinosPermitidos = ['P4', 'SVDD', '1 CIA', '2 CIA', '3 CIA', '4 CIA', '5 CIA', '6 CIA', 'FT', 'BTL', 'OUTROS']
  if (!['P4', 'SVDD'].includes(origem) || !destinosPermitidos.includes(destino)) {
    throw new Error('Origem ou destino patrimonial inválido.')
  }
  if (origem === 'SVDD' && destino !== 'P4') {
    throw new Error('O SVDD somente pode devolver o HT ao P4.')
  }
  if (destino === 'OUTROS' && !texto(destinoNome)) {
    throw new Error('Informe o destino da transferência.')
  }

  if (origem === destino) {
    throw new Error('A origem e o destino não podem ser iguais.')
  }

  const localAtual = upper(ht.local_atual)
  const estaNaOrigem = origem === 'P4'
    ? localAtual.includes('P4') || localAtual.includes('DEPOSITO') || localAtual.includes('GUARDA')
    : localAtual.includes('SVDD') || localAtual.includes('SERVICO DE DIA')

  if (!estaNaOrigem) {
    throw new Error(`Este HT não está atualmente no ${origem}.`)
  }

  if (['MANUTENCAO', 'BAIXADO', 'CAUTELADO', 'CARGA'].includes(upper(ht.status_operacional))) {
    throw new Error('Este HT não está disponível para transferência.')
  }

  const localDestino = localDoCodigo(destino, destinoNome)

  const patrimonio = await buscarPatrimonioPorReferencia({
    tipo: 'ht',
    referenciaId: ht.id
  })

  const resultado = await registrarMovimentacao({
    patrimonioId: patrimonio.id,
    tipo: TIPOS_MOVIMENTACAO.TRANSFERENCIA,
    statusNovo: ht.status_operacional || 'RESERVA',
    localDestino,
    companhiaDestino: destino === 'SVDD' || destino === 'P4' ? ht.unidade || '' : destino,
    motivo: origem === 'P4' ? 'DISTRIBUICAO_OPERACIONAL' : 'DEVOLUCAO_AO_P4',
    observacao: `Transferência do HT ${ht.patrimonio || ht.numero_serie || ht.id}: ${origem} → ${destino}.`,
    dados: {
      modulo: 'HT',
      categoria: 'HT',
      ht_id: ht.id,
      referencia_id: ht.id,
      quantidade: 1,
      status_movimentacao: STATUS_MOVIMENTACAO.PENDENTE,
      guardiao_origem: {
        tipo: 'SETOR',
        codigo: origem,
        nome: localDoCodigo(origem)
      },
      guardiao_destino: {
        tipo: 'SETOR',
        codigo: destino,
        nome: localDestino
      },
      local_origem: localDoCodigo(origem),
      local_destino: localDestino,
      patrimonio: ht.patrimonio || null,
      numero_serie: ht.numero_serie || null,
      marca: ht.marca || null,
      modelo: ht.modelo || null,
      destino_nome: localDestino
    },
    user
  })

  // A Engine registra a intenção e atualiza o patrimônio central. Enquanto estiver
  // pendente, o HT continua sob a guarda da origem; por isso restauramos a posição.
  await sincronizarHT(ht, user)

  return resultado.movimentacao
}

export async function listarTransferenciasHTPendentes({
  destinoCodigo,
  limite = 100
} = {}) {
  const pendentes = await listarMovimentacoesPendentes({
    guardiaoCodigo: upper(destinoCodigo),
    limite
  })

  return (pendentes || []).filter((item) => {
    const dados = item?.dados || item?.metadata?.dados_engine || {}
    return upper(dados.modulo || dados.categoria) === 'HT'
  })
}

export async function aceitarTransferenciaHT({
  movimentacaoId,
  user = null
}) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)

  if (!movimentacao) throw new Error('Transferência não encontrada.')

  const htId = obterHTId(movimentacao)
  const ht = await buscarHT(htId)
  const destinoCodigo = upper(
    movimentacao.destino_guardiao_codigo ||
    movimentacao?.metadata?.guardiao_destino?.codigo
  )
  const dadosMovimentacao = movimentacao?.dados || movimentacao?.metadata?.dados_engine || {}
  const localDestino = localDoCodigo(
    destinoCodigo,
    movimentacao.destino_guardiao_nome ||
      dadosMovimentacao?.guardiao_destino?.nome ||
      dadosMovimentacao?.destino_nome
  )

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status_operacional: 'RESERVA',
      local_atual: localDestino,
      equipe_vinculada: null,
      viatura_vinculada: null
    })
    .eq('id', ht.id)
    .select()
    .single()

  if (error) throw error

  try {
    await sincronizarHT(data, user)
    await concluirMovimentacao({
      movimentacaoId,
      observacao: `Recebimento confirmado em ${localDestino}.`,
      user
    })
  } catch (error) {
    await supabase.from(TABLE).update({
      status_operacional: ht.status_operacional,
      local_atual: ht.local_atual,
      equipe_vinculada: ht.equipe_vinculada,
      viatura_vinculada: ht.viatura_vinculada
    }).eq('id', ht.id)
    await sincronizarHT(ht, user)
    throw error
  }

  return data
}

export async function listarTransferenciasHTCriadasPendentes({ origemCodigo, limite = 200 } = {}) {
  const origem = upper(origemCodigo)
  const pendentes = await listarMovimentacoesPendentes({
    limite: Math.max(1, Math.min(Number(limite) || 200, 500))
  })
  return (pendentes || []).filter((item) => {
    const dados = item?.dados || item?.metadata?.dados_engine || {}
    const modulo = upper(dados.modulo || dados.categoria)
    const origemItem = upper(item?.origem_guardiao_codigo || item?.metadata?.guardiao_origem?.codigo || dados?.guardiao_origem?.codigo)
    return modulo === 'HT' && origemItem === origem
  })
}

export async function cancelarTransferenciaHT({ movimentacaoId, motivo, origemCodigo, user = null }) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)
  if (!movimentacao) throw new Error('Transferência não encontrada.')
  const dados = movimentacao?.dados || movimentacao?.metadata?.dados_engine || {}
  const origemMovimentacao = upper(movimentacao?.origem_guardiao_codigo || movimentacao?.metadata?.guardiao_origem?.codigo || dados?.guardiao_origem?.codigo)
  if (upper(origemCodigo) && origemMovimentacao !== upper(origemCodigo)) {
    throw new Error('Esta transferência não foi criada pelo setor atual.')
  }
  const htId = obterHTId(movimentacao)
  const ht = await buscarHT(htId)
  await cancelarMovimentacao({
    movimentacaoId,
    motivo: texto(motivo) || 'TRANSFERÊNCIA CANCELADA PELO SETOR DE ORIGEM',
    user
  })
  await sincronizarHT(ht, user)
  return true
}

export async function recusarTransferenciaHT({
  movimentacaoId,
  motivo,
  user = null
}) {
  const movimentacao = await buscarMovimentacaoPorId(movimentacaoId)
  if (!movimentacao) throw new Error('Transferência não encontrada.')

  const htId = obterHTId(movimentacao)
  const ht = await buscarHT(htId)

  await cancelarMovimentacao({
    movimentacaoId,
    motivo: texto(motivo) || 'TRANSFERÊNCIA RECUSADA PELO DESTINO',
    user
  })

  await sincronizarHT(ht, user)
  return true
}
