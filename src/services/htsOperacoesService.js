import { supabase } from './supabaseClient'
import {
  buscarPatrimonioPorReferencia,
  concluirMovimentacao,
  listarMovimentacoesPatrimoniais,
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

async function buscarHT(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) throw error
  return data
}

async function atualizarHT(id, alteracoes, user) {
  const { data, error } = await supabase.from(TABLE).update(alteracoes).eq('id', id).select().single()
  if (error) throw error

  await criarOuAtualizarPatrimonio({
    tipo: 'ht',
    referencia_id: data.id,
    dados: data,
    user,
    local_atual: data.local_atual || 'GUARDA DO P4',
    companhia_atual: data.unidade || ''
  })

  return data
}

function validarPolicial(policial) {
  if (!policial?.id || !texto(policial?.nome_completo || policial?.nome)) {
    throw new Error('Selecione um policial cadastrado.')
  }
}

async function registrarEntrega({ ht, tipo, policial, devolucaoPrevista, observacoes, user }) {
  const patrimonio = await buscarPatrimonioPorReferencia({ tipo: 'ht', referenciaId: ht.id })
  if (!patrimonio?.id) throw new Error('Patrimônio central do HT não encontrado.')

  const nome = texto(policial.nome_completo || policial.nome)
  const re = texto(policial.re)
  const statusNovo = tipo === 'CARGA' ? 'CARGA' : 'EM_SERVICO'
  const localDestino = tipo === 'CARGA' ? 'CARGA PERMANENTE' : 'CAUTELA INDIVIDUAL'

  const resultado = await registrarMovimentacao({
    patrimonioId: patrimonio.id,
    tipo: tipo === 'CARGA' ? TIPOS_MOVIMENTACAO.CARGA_PERMANENTE : TIPOS_MOVIMENTACAO.CAUTELA_SERVICO,
    statusNovo,
    localDestino,
    companhiaDestino: ht.unidade || '',
    recebedorRE: re || null,
    recebedorNome: nome,
    motivo: tipo === 'CARGA' ? 'PAGAMENTO_DE_CARGA' : 'PAGAMENTO_DE_CAUTELA',
    observacao: observacoes || null,
    dados: {
      modulo: 'HT',
      categoria: 'HT',
      ht_id: ht.id,
      referencia_id: ht.id,
      quantidade: 1,
      status_movimentacao: STATUS_MOVIMENTACAO.EM_ANDAMENTO,
      devolucao_prevista: devolucaoPrevista || null,
      policial_id: policial.id,
      policial_re: re || null,
      policial_nome: nome,
      local_origem: ht.local_atual || null,
      local_destino: localDestino,
      guardiao_destino: {
        tipo: 'POLICIAL',
        id: policial.id,
        codigo: re || policial.id,
        nome,
        re: re || null
      }
    },
    user
  })

  await atualizarHT(ht.id, {
    status_operacional: statusNovo,
    local_atual: localDestino,
    equipe_vinculada: nome,
    viatura_vinculada: null
  }, user)

  return resultado?.movimentacao
}

export async function pagarCargaHT({ htIds = [], policial, observacoes = null, user = null }) {
  validarPolicial(policial)
  if (!htIds.length) throw new Error('Selecione pelo menos um HT.')

  const resultados = []
  for (const id of htIds) {
    const ht = await buscarHT(id)
    if (!upper(ht.local_atual).includes('P4') && !upper(ht.local_atual).includes('DEPOSITO') && !upper(ht.local_atual).includes('GUARDA')) {
      throw new Error(`O HT ${ht.patrimonio || ht.numero_serie || ''} não está no P4.`)
    }
    if (['MANUTENCAO', 'BAIXADO', 'CARGA', 'EM_SERVICO'].includes(upper(ht.status_operacional))) {
      throw new Error(`O HT ${ht.patrimonio || ht.numero_serie || ''} não está disponível.`)
    }
    resultados.push(await registrarEntrega({ ht, tipo: 'CARGA', policial, observacoes, user }))
  }
  return resultados
}

export async function pagarCautelaHT({ htIds = [], policial, devolucaoPrevista, observacoes = null, user = null }) {
  validarPolicial(policial)
  if (!htIds.length) throw new Error('Selecione pelo menos um HT.')
  if (!devolucaoPrevista) throw new Error('Informe a previsão de devolução.')

  const resultados = []
  for (const id of htIds) {
    const ht = await buscarHT(id)
    if (['MANUTENCAO', 'BAIXADO', 'CARGA', 'EM_SERVICO'].includes(upper(ht.status_operacional))) {
      throw new Error(`O HT ${ht.patrimonio || ht.numero_serie || ''} não está disponível.`)
    }
    resultados.push(await registrarEntrega({ ht, tipo: 'CAUTELA', policial, devolucaoPrevista, observacoes, user }))
  }
  return resultados
}

export async function listarEntregasHTAtivas() {
  const movimentacoes = await listarMovimentacoesPatrimoniais({
    statusMovimentacao: STATUS_MOVIMENTACAO.EM_ANDAMENTO,
    limite: 500
  })

  return (movimentacoes || []).filter((item) => {
    const dados = item?.dados || item?.metadata?.dados_engine || {}
    const modulo = upper(dados.modulo || dados.categoria)
    const tipo = upper(item.tipo_movimentacao || item.tipo)
    return modulo === 'HT' && ['CAUTELA', 'CAUTELA_SERVICO', 'CARGA_PERMANENTE'].includes(tipo)
  })
}

export async function receberDevolucaoHT({ movimentacoes = [], destinoCodigo, observacoes = null, user = null }) {
  if (!movimentacoes.length) throw new Error('Selecione pelo menos uma devolução.')
  const destino = upper(destinoCodigo) === 'SVDD' ? 'COFRE DO SVDD' : 'GUARDA DO P4'

  const resultados = []
  for (const mov of movimentacoes) {
    const dados = mov?.dados || mov?.metadata?.dados_engine || {}
    const htId = dados.ht_id || dados.referencia_id || mov?.metadata?.patrimonio?.referencia_id
    if (!htId) continue

    await concluirMovimentacao({
      movimentacaoId: mov.id,
      observacao: observacoes || `Devolução recebida em ${destino}.`,
      user
    })

    resultados.push(await atualizarHT(htId, {
      status_operacional: 'RESERVA',
      local_atual: destino,
      equipe_vinculada: null,
      viatura_vinculada: null
    }, user))
  }
  return resultados
}

export async function regularizarCautelaHT({ movimentacaoId, acao, novaPrevisao = null, observacoes, user = null }) {
  if (!movimentacaoId) throw new Error('Cautela não informada.')
  if (!texto(observacoes)) throw new Error('Informe as observações da regularização.')
  if (acao === 'ESTENDER' && !novaPrevisao) throw new Error('Informe a nova previsão de devolução.')

  const { data: atual, error: buscaError } = await supabase
    .from('sigmo_patrimonio_movimentacoes')
    .select('*')
    .eq('id', movimentacaoId)
    .single()
  if (buscaError) throw buscaError

  const dados = { ...(atual.dados || {}) }
  const historico = Array.isArray(dados.regularizacoes) ? dados.regularizacoes : []
  const registro = {
    acao,
    observacoes: texto(observacoes),
    nova_previsao: novaPrevisao || null,
    realizada_em: new Date().toISOString(),
    realizada_por: user?.nome || user?.nome_completo || user?.email || 'SIGMO'
  }

  dados.regularizacoes = [...historico, registro]
  dados.providencia_solicitada = acao === 'SOLICITAR_P4' ? 'P4' : acao === 'SOLICITAR_COMANDANTE' ? 'COMANDANTE' : null
  if (acao === 'ESTENDER') dados.devolucao_prevista = novaPrevisao

  const metadata = {
    ...(atual.metadata || {}),
    regularizacao: registro,
    dados_engine: {
      ...((atual.metadata || {}).dados_engine || {}),
      devolucao_prevista: dados.devolucao_prevista || null,
      providencia_solicitada: dados.providencia_solicitada || null
    }
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonio_movimentacoes')
    .update({ dados, metadata, observacao: texto(observacoes), updated_at: new Date().toISOString() })
    .eq('id', movimentacaoId)
    .select()
    .single()
  if (error) throw error
  return data
}
