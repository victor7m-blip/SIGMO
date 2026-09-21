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

const TABLE = 'sigmo_tasers'

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor) {
  return texto(valor).toUpperCase()
}

async function buscarTaser(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) throw error
  return data
}

async function atualizarTaserOperacional(id, alteracoes, user) {
  const { data, error } = await supabase.from(TABLE).update(alteracoes).eq('id', id).select().single()
  if (error) throw error

  await criarOuAtualizarPatrimonio({
    tipo: 'taser',
    referencia_id: data.id,
    dados: data,
    user,
    local_atual: data.local_atual || 'GUARDA DO P4',
    companhia_atual: data.unidade || ''
  })

  return data
}

function validarPolicial(policial) {
  if (!policial?.id || !texto(policial?.nome_guerra || policial?.nome_completo || policial?.nome)) {
    throw new Error('Selecione um policial cadastrado.')
  }
}

async function registrarEntrega({ taser, tipo, policial, devolucaoPrevista, observacoes, user }) {
  const patrimonio = await buscarPatrimonioPorReferencia({ tipo: 'taser', referenciaId: taser.id })
  if (!patrimonio?.id) throw new Error('Patrimônio central do Taser não encontrado.')

  const {
    data: patrimonioAntes,
    error: patrimonioAntesError
  } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('id', patrimonio.id)
    .single()

  if (patrimonioAntesError) throw patrimonioAntesError

  const nome = texto(policial.nome_guerra || policial.nome_completo || policial.nome)
  const re = texto(policial.re)
  const statusNovo = tipo === 'CARGA' ? 'CARGA' : 'EM_SERVICO'
  const localDestino = tipo === 'CARGA' ? 'CARGA PERMANENTE' : 'CAUTELA INDIVIDUAL'

  const resultado = await registrarMovimentacao({
    patrimonioId: patrimonio.id,
    tipo: tipo === 'CARGA' ? TIPOS_MOVIMENTACAO.CARGA_PERMANENTE : TIPOS_MOVIMENTACAO.CAUTELA_SERVICO,
    statusNovo,
    localDestino,
    companhiaDestino: taser.unidade || '',
    recebedorRE: re || null,
    recebedorNome: nome,
    motivo: tipo === 'CARGA' ? 'PAGAMENTO_DE_CARGA' : 'PAGAMENTO_DE_CAUTELA',
    observacao: observacoes || null,
    dados: {
      modulo: 'TASER',
      categoria: 'TASER',
      taser_id: taser.id,
      referencia_id: taser.id,
      quantidade: 1,

      // Toda saída do P4 aguarda decisão do Comandante da Cia.
      status_movimentacao: STATUS_MOVIMENTACAO.PENDENTE,
      exige_aprovacao_cmt: true,
      status_aprovacao_cmt: 'PENDENTE',
      solicitado_aprovacao_cmt_em: new Date().toISOString(),

      status_recebimento_usuario: 'AGUARDANDO_APROVACAO_CMT',
      aceite_usuario_em: null,
      aceite_usuario_por_id: null,
      aceite_usuario_por_nome: null,

      tipo_operacao_taser: tipo === 'CARGA' ? 'CARGA_PERMANENTE' : 'CAUTELA',
      status_pos_aprovacao: statusNovo,
      local_pos_aprovacao: localDestino,

      devolucao_prevista: devolucaoPrevista || null,
      policial_id: policial.id,
      policial_re: re || null,
      policial_nome: nome,
      local_origem: taser.local_atual || null,
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

  /*
   * registrarMovimentacao atualiza a Engine Patrimonial imediatamente.
   * Para CARGA/CAUTELA do Taser isso é cedo demais:
   *
   * P4 solicita -> Cmt aprova -> policial aceita -> só então efetiva.
   *
   * Portanto restauramos o patrimônio exatamente ao estado anterior
   * logo após criar a movimentação pendente.
   */
  const {
    error: restaurarError
  } = await supabase
    .from('sigmo_patrimonios')
    .update({
      status:
        patrimonioAntes.status ?? null,

      local_atual:
        patrimonioAntes.local_atual ?? null,

      companhia_atual:
        patrimonioAntes.companhia_atual ?? null,

      responsavel_atual_id:
        patrimonioAntes.responsavel_atual_id ?? null,

      responsavel_atual_nome:
        patrimonioAntes.responsavel_atual_nome ?? null,

      dados:
        patrimonioAntes.dados ?? {},

      atualizado_por:
        patrimonioAntes.atualizado_por ?? null,

      updated_at:
        new Date().toISOString()
    })
    .eq(
      'id',
      patrimonio.id
    )

  if (restaurarError) {
    throw restaurarError
  }

  return resultado?.movimentacao
}

export async function pagarCargaTaser({ taserIds = [], policial, observacoes = null, user = null }) {
  validarPolicial(policial)
  if (!taserIds.length) throw new Error('Selecione pelo menos um Taser.')

  const resultados = []
  for (const id of taserIds) {
    const taser = await buscarTaser(id)
    if (!upper(taser.local_atual).includes('P4') && !upper(taser.local_atual).includes('DEPOSITO') && !upper(taser.local_atual).includes('GUARDA')) {
      throw new Error(`O Taser ${taser.patrimonio || taser.numero_serie || ''} não está no P4.`)
    }
    if (['MANUTENCAO', 'BAIXADO', 'CARGA', 'EM_SERVICO'].includes(upper(taser.status_operacional))) {
      throw new Error(`O Taser ${taser.patrimonio || taser.numero_serie || ''} não está disponível.`)
    }
    resultados.push(await registrarEntrega({ taser, tipo: 'CARGA', policial, observacoes, user }))
  }
  return resultados
}

export async function pagarCautelaTaser({ taserIds = [], policial, devolucaoPrevista, observacoes = null, user = null }) {
  validarPolicial(policial)
  if (!taserIds.length) throw new Error('Selecione pelo menos um Taser.')
  if (!devolucaoPrevista) throw new Error('Informe a previsão de devolução.')

  const resultados = []
  for (const id of taserIds) {
    const taser = await buscarTaser(id)
    if (['MANUTENCAO', 'BAIXADO', 'CARGA', 'EM_SERVICO'].includes(upper(taser.status_operacional))) {
      throw new Error(`O Taser ${taser.patrimonio || taser.numero_serie || ''} não está disponível.`)
    }
    resultados.push(await registrarEntrega({ taser, tipo: 'CAUTELA', policial, devolucaoPrevista, observacoes, user }))
  }
  return resultados
}

export async function listarEntregasTaserAtivas() {
  const movimentacoes = await listarMovimentacoesPatrimoniais({
    statusMovimentacao: STATUS_MOVIMENTACAO.PENDENTE,
    limite: 500
  })

  return (movimentacoes || []).filter((item) => {
    const dados = item?.dados || item?.metadata?.dados_engine || {}
    const modulo = upper(dados.modulo || dados.categoria)
    const tipo = upper(item.tipo_movimentacao || item.tipo)
    return modulo === 'TASER' && ['CAUTELA', 'CAUTELA_SERVICO', 'CARGA_PERMANENTE'].includes(tipo)
  })
}

export async function receberDevolucaoTaser({ movimentacoes = [], destinoCodigo, observacoes = null, user = null }) {
  if (!movimentacoes.length) throw new Error('Selecione pelo menos uma devolução.')
  const destino = upper(destinoCodigo) === 'SVDD' ? 'COFRE DO SVDD' : 'GUARDA DO P4'

  const resultados = []
  for (const mov of movimentacoes) {
    const dados = mov?.dados || mov?.metadata?.dados_engine || {}
    const taserId = dados.taser_id || dados.referencia_id || mov?.metadata?.patrimonio?.referencia_id
    if (!taserId) continue

    await concluirMovimentacao({
      movimentacaoId: mov.id,
      observacao: observacoes || `Devolução recebida em ${destino}.`,
      user
    })

    resultados.push(await atualizarTaserOperacional(taserId, {
      status_operacional: 'RESERVA',
      local_atual: destino,
      equipe_vinculada: null,
      viatura_vinculada: null
    }, user))
  }
  return resultados
}

export async function regularizarCautelaTaser({ movimentacaoId, acao, novaPrevisao = null, observacoes, user = null }) {
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
