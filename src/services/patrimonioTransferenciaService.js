import { supabase } from './supabaseClient'

import {
  criarNotificacoes,
  obterHoraServidor,
  formatarDataHoraServidor
} from './notificacoesService'

import {
  normalizarUsuarioMovimentacao,
  registrarMovimentacao
} from './patrimonioMovimentacaoService'

import {
  registerPatrimonialAudit
} from './auditoriaService'

import { PERFIS } from '../constants/perfis'

const TABLE = 'sigmo_transferencias_patrimoniais'
const TONFAS_TABLE = 'sigmo_tonfas'
const ARMAS_TABLE = 'sigmo_armas'
const PATRIMONIOS_TABLE = 'sigmo_patrimonios'
const PATRIMONIO_ITENS_TABLE = 'sigmo_patrimonio_itens'

export const STATUS_TRANSFERENCIA = Object.freeze({
  PENDENTE: 'PENDENTE',
  ACEITA: 'ACEITA',
  RECUSADA: 'RECUSADA',
  CANCELADA: 'CANCELADA'
})

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor, fallback = '') {
  return texto(valor).toUpperCase() || fallback
}

function quantidadeInteira(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('A quantidade deve ser maior que zero.')
  }

  return Math.trunc(numero)
}

function usuarioNormalizado(user) {
  const usuario = normalizarUsuarioMovimentacao(user)

  return {
    id: usuario.id || null,
    re: usuario.re || null,
    nome: usuario.nome || 'USUÁRIO NÃO IDENTIFICADO',
    perfil: usuario.perfil || null
  }
}

function gerarProtocolo() {
  const agora = new Date()
  const data = agora.toISOString().slice(0, 10).replace(/-/g, '')
  const hora = agora.toTimeString().slice(0, 8).replace(/:/g, '')
  const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase()

  return `TRF-${data}-${hora}-${aleatorio}`
}

function descricaoMaterial(categoria, quantidade, metadata = {}) {
  const categoriaNormalizada = upper(categoria)

  if (categoriaNormalizada === 'ARMA') {
    const identificacao =
      texto(metadata?.descricao_arma) ||
      texto(metadata?.identificacao) ||
      texto(metadata?.patrimonio) ||
      texto(metadata?.numero_serie)

    return identificacao
      ? `a arma ${identificacao}`
      : '1 arma'
  }

  const nome =
    categoriaNormalizada === 'CASSETETE'
      ? 'cassetete(s)'
      : 'tonfa(s)'

  return `${quantidade} ${nome}`
}

function linkDoModulo(categoria, recebimento = false) {
  if (upper(categoria) === 'ARMA') {
    return '/armas'
  }

  return recebimento
    ? '/tonfas/receber-p4'
    : '/tonfas'
}


async function notificarPerfis(notificacoes) {
  try {
    return await criarNotificacoes(notificacoes)
  } catch (error) {
    console.error('Erro ao criar notificações da transferência:', error)
    return []
  }
}

async function auditar(payload) {
  try {
    return await registerPatrimonialAudit(payload)
  } catch (error) {
    console.error('Erro ao registrar auditoria da transferência:', error)
    return null
  }
}

async function buscarVinculosDaTonfa(
  tonfaId,
  categoria
) {
  if (!tonfaId) {
    throw new Error(
      'A Tonfa ou o Cassetete da transferência não foi informado.'
    )
  }

  const categoriaNormalizada = upper(categoria)

  const { data: tonfa, error: tonfaError } =
    await supabase
      .from(TONFAS_TABLE)
      .select('*')
      .eq('id', tonfaId)
      .maybeSingle()

  if (tonfaError) throw tonfaError

  if (!tonfa) {
    throw new Error(
      'O estoque de Tonfa ou Cassetete não foi encontrado.'
    )
  }

  const { data: patrimonio, error: patrimonioError } =
    await supabase
      .from(PATRIMONIOS_TABLE)
      .select('*')
      .eq('tipo', 'tonfa')
      .eq('referencia_id', tonfaId)
      .eq('ativo', true)
      .maybeSingle()

  if (patrimonioError) throw patrimonioError

  if (!patrimonio) {
    throw new Error(
      'O registro patrimonial desta Tonfa ou Cassetete não foi encontrado.'
    )
  }

  const { data: itemPatrimonial, error: itemError } =
    await supabase
      .from(PATRIMONIO_ITENS_TABLE)
      .select('*')
      .eq('categoria', categoriaNormalizada)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()

  if (itemError) throw itemError

  if (!itemPatrimonial) {
    throw new Error(
      `O item de catálogo ${categoriaNormalizada} não foi encontrado.`
    )
  }

  return {
    tonfa,
    patrimonio,
    itemPatrimonial
  }
}

async function buscarItemCatalogo(categoria) {
  const categoriaNormalizada = upper(categoria)
  const categoriasAceitas =
    categoriaNormalizada === 'ARMA'
      ? ['ARMA', 'ARMAS']
      : [categoriaNormalizada]

  const { data, error } = await supabase
    .from(PATRIMONIO_ITENS_TABLE)
    .select('*')
    .in('categoria', categoriasAceitas)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    throw new Error(
      `O item de catálogo ${categoriaNormalizada} não foi encontrado.`
    )
  }

  return data
}

async function buscarVinculosDaArma(armaId) {
  if (!armaId) {
    throw new Error('A arma da transferência não foi informada.')
  }

  const { data: arma, error: armaError } = await supabase
    .from(ARMAS_TABLE)
    .select('*')
    .eq('id', armaId)
    .maybeSingle()

  if (armaError) throw armaError

  if (!arma) {
    throw new Error('A arma selecionada não foi encontrada.')
  }

  const { data: patrimonio, error: patrimonioError } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')
    .eq('tipo', 'arma')
    .eq('referencia_id', armaId)
    .eq('ativo', true)
    .maybeSingle()

  if (patrimonioError) throw patrimonioError

  if (!patrimonio) {
    throw new Error(
      'O registro patrimonial desta arma não foi encontrado. Sincronize o cadastro e tente novamente.'
    )
  }

  let itemPatrimonial = null

  if (patrimonio.item_id) {
    const { data: itemVinculado, error: itemVinculadoError } = await supabase
      .from(PATRIMONIO_ITENS_TABLE)
      .select('*')
      .eq('id', patrimonio.item_id)
      .eq('ativo', true)
      .maybeSingle()

    if (itemVinculadoError) throw itemVinculadoError
    itemPatrimonial = itemVinculado
  }

  if (!itemPatrimonial) {
    itemPatrimonial = await buscarItemCatalogo('ARMA')
  }

  return {
    arma,
    patrimonio,
    itemPatrimonial
  }
}

function montarDescricaoArma(arma) {
  const modelo = [arma?.especie, arma?.marca, arma?.modelo]
    .map(texto)
    .filter(Boolean)
    .join(' ')

  const identificador =
    texto(arma?.patrimonio) ||
    texto(arma?.numero_serie)

  if (modelo && identificador) {
    return `${modelo} - ${identificador}`
  }

  return modelo || identificador || 'arma não identificada'
}


export async function criarTransferenciaPendente({
  patrimonioId = null,
  itemId = null,
  tonfaId = null,
  armaId = null,
  categoria,
  quantidade = 1,
  origemTipo = 'SETOR',
  origemCodigo = 'P4',
  origemNome = 'GUARDA DO P4',
  destinoTipo = 'SETOR',
  destinoCodigo = 'SVDD',
  destinoNome = 'COFRE DO SVDD',
  motivo = 'DISTRIBUICAO_OPERACIONAL',
  observacoes = null,
  metadata = {},
  user = null
}) {
  const ator = usuarioNormalizado(user)
  const categoriaNormalizada = upper(categoria)

  if (!['TONFA', 'CASSETETE', 'ARMA'].includes(categoriaNormalizada)) {
    throw new Error('Categoria patrimonial inválida para esta transferência.')
  }

  const individual = categoriaNormalizada === 'ARMA'
  const quantidadeNormalizada = individual
    ? 1
    : quantidadeInteira(quantidade)

  let vinculos

  if (individual) {
    vinculos = await buscarVinculosDaArma(
      armaId || metadata?.arma_id
    )
  } else {
    vinculos = await buscarVinculosDaTonfa(
      tonfaId,
      categoriaNormalizada
    )
  }

  const origemCodigoNormalizado = upper(origemCodigo, 'P4')
  const destinoCodigoNormalizado = upper(destinoCodigo, 'SVDD')

  const patrimonioIdResolvido =
    patrimonioId ||
    vinculos.patrimonio.id

  if (individual) {
    const { data: pendenteExistente, error: pendenteError } = await supabase
      .from(TABLE)
      .select('id, protocolo')
      .eq('patrimonio_id', patrimonioIdResolvido)
      .eq('status', STATUS_TRANSFERENCIA.PENDENTE)
      .limit(1)
      .maybeSingle()

    if (pendenteError) throw pendenteError

    if (pendenteExistente) {
      throw new Error(
        `Esta arma já possui a transferência ${pendenteExistente.protocolo} pendente de recebimento.`
      )
    }
  }

  const itemIdResolvido =
    itemId ||
    vinculos.itemPatrimonial.id

  const metadataNormalizada = {
    ...(metadata && typeof metadata === 'object' ? metadata : {}),
    tonfa_id: individual
      ? null
      : tonfaId || metadata?.tonfa_id || null,
    arma_id: individual
      ? vinculos.arma.id
      : metadata?.arma_id || null,
    descricao_arma: individual
      ? montarDescricaoArma(vinculos.arma)
      : metadata?.descricao_arma || null,
    patrimonio_arma: individual
      ? vinculos.arma.patrimonio || null
      : metadata?.patrimonio_arma || null,
    numero_serie_arma: individual
      ? vinculos.arma.numero_serie || null
      : metadata?.numero_serie_arma || null,
    item_individual: individual,
    criado_por_perfil: ator.perfil
  }

  const horaServidor = await obterHoraServidor()
  const protocolo = gerarProtocolo()

  const payload = {
    protocolo,
    patrimonio_id: patrimonioIdResolvido,
    item_id: itemIdResolvido,
    categoria: categoriaNormalizada,
    quantidade: quantidadeNormalizada,
    origem_tipo: upper(origemTipo, 'SETOR'),
    origem_codigo: origemCodigoNormalizado || null,
    origem_nome: upper(origemNome, 'GUARDA DO P4'),
    destino_tipo: upper(destinoTipo, 'SETOR'),
    destino_codigo: destinoCodigoNormalizado || null,
    destino_nome: upper(destinoNome, 'COFRE DO SVDD'),
    status: STATUS_TRANSFERENCIA.PENDENTE,
    motivo: upper(motivo) || null,
    observacoes: texto(observacoes) || null,
    enviado_por_id: ator.id,
    enviado_por_re: ator.re,
    enviado_por_nome: ator.nome,
    enviado_em: horaServidor,
    metadata: metadataNormalizada,
    updated_at: horaServidor
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error

  const material = descricaoMaterial(
    categoriaNormalizada,
    quantidadeNormalizada,
    metadataNormalizada
  )
  const dataHora = formatarDataHoraServidor(horaServidor)
  const mensagem =
    `O ${origemCodigoNormalizado} enviou ${material} ao ${destinoCodigoNormalizado}. ` +
    `A transferência ${protocolo} está pendente de recebimento. ` +
    `Enviado por ${ator.nome}${ator.re ? `, RE ${ator.re}` : ''}, em ${dataHora}.`

  const perfilDestino = destinoCodigoNormalizado === 'P4'
    ? PERFIS.P4
    : PERFIS.ENCARREGADO_SVDD

  await notificarPerfis([
    {
      titulo: `Material pendente de recebimento no ${destinoCodigoNormalizado}`,
      mensagem,
      tipo: 'PATRIMONIO',
      modulo: 'PATRIMONIO',
      prioridade: 'ALTA',
      destinatario_perfil: perfilDestino,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: data.id,
      link: linkDoModulo(categoriaNormalizada, true),
      metadata: {
        protocolo,
        categoria: categoriaNormalizada,
        status: STATUS_TRANSFERENCIA.PENDENTE
      }
    },
    {
      titulo: `${origemCodigoNormalizado} enviou material ao ${destinoCodigoNormalizado}`,
      mensagem,
      tipo: 'PATRIMONIO',
      modulo: 'PATRIMONIO',
      prioridade: 'NORMAL',
      destinatario_perfil: PERFIS.COMANDANTE_CIA,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: data.id,
      link: linkDoModulo(categoriaNormalizada),
      metadata: {
        protocolo,
        categoria: categoriaNormalizada,
        status: STATUS_TRANSFERENCIA.PENDENTE
      }
    }
  ])

  await auditar({
    tipo: 'TRANSFERENCIA_PATRIMONIAL_ENVIADA',
    descricao:
      `Criou a transferência ${protocolo}: ${material} do ${origemCodigoNormalizado} para o ${destinoCodigoNormalizado}, ` +
      `aguardando aceite do ${destinoCodigoNormalizado}.`,
    usuario: user,
    modulo: 'Patrimônio',
    severidade: 'Informativo'
  })

  return data
}


export async function listarTransferenciasPendentes({
  destinoCodigo = 'SVDD',
  categoria = null,
  limite = 100
} = {}) {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('status', STATUS_TRANSFERENCIA.PENDENTE)
    .eq('destino_codigo', upper(destinoCodigo, 'SVDD'))
    .order('enviado_em', { ascending: true })
    .limit(Math.max(1, Math.min(Number(limite) || 100, 500)))

  if (categoria) {
    query = query.eq('categoria', upper(categoria))
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function buscarTransferenciaPorId(id) {
  if (!id) throw new Error('Transferência não informada.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Transferência patrimonial não encontrada.')
  return data
}

async function buscarEstoqueDaTransferencia(transferencia) {
  const tonfaId = transferencia?.metadata?.tonfa_id

  if (!tonfaId) {
    throw new Error('A transferência não possui vínculo com o estoque de Tonfas/Cassetetes.')
  }

  const { data, error } = await supabase
    .from(TONFAS_TABLE)
    .select('*')
    .eq('id', tonfaId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Estoque patrimonial não encontrado.')
  return data
}

async function aceitarTransferenciaDeArma({
  transferencia,
  ator,
  horaServidor,
  user
}) {
  const armaId = transferencia?.metadata?.arma_id

  if (!armaId) {
    throw new Error('A transferência não possui vínculo com a arma.')
  }

  const { data: armaAnterior, error: armaBuscaError } = await supabase
    .from(ARMAS_TABLE)
    .select('*')
    .eq('id', armaId)
    .maybeSingle()

  if (armaBuscaError) throw armaBuscaError
  if (!armaAnterior) throw new Error('A arma da transferência não foi encontrada.')

  let movimentacao = null

  try {
    movimentacao = await registrarMovimentacao({
      patrimonioId: transferencia.patrimonio_id,
      tipo: 'TRANSFERENCIA',
      localDestino: transferencia.destino_nome,
      motivo: transferencia.motivo,
      observacao: transferencia.observacoes,
      dados: {
        transferencia_id: transferencia.id,
        protocolo_transferencia: transferencia.protocolo,
        quantidade: 1,
        categoria: 'ARMA',
        item_individual: true,
        arma_id: armaId,
        origem_codigo: transferencia.origem_codigo,
        origem_nome: transferencia.origem_nome,
        destino_codigo: transferencia.destino_codigo,
        destino_nome: transferencia.destino_nome,
        guardiao_origem: {
          tipo: 'SETOR',
          codigo: transferencia.origem_codigo,
          nome: transferencia.origem_nome
        },
        guardiao_destino: {
          tipo: 'SETOR',
          codigo: transferencia.destino_codigo,
          nome: transferencia.destino_nome
        }
      },
      user
    })

    const { data: armaAtualizada, error: armaError } = await supabase
      .from(ARMAS_TABLE)
      .update({
        local_atual: transferencia.destino_nome
      })
      .eq('id', armaId)
      .select('*')
      .maybeSingle()

    if (armaError) throw armaError
    if (!armaAtualizada) {
      throw new Error('Não foi possível atualizar a localização da arma.')
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: STATUS_TRANSFERENCIA.ACEITA,
        recebido_por_id: ator.id,
        recebido_por_re: ator.re,
        recebido_por_nome: ator.nome,
        recebido_em: horaServidor,
        movimentacao_id: movimentacao?.id || movimentacao?.movimentacao?.id || null,
        updated_at: horaServidor
      })
      .eq('id', transferencia.id)
      .eq('status', STATUS_TRANSFERENCIA.PENDENTE)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('A transferência foi alterada por outro usuário.')

    return {
      transferencia: data,
      estoque: armaAtualizada,
      arma: armaAtualizada,
      movimentacao
    }
  } catch (error) {
    await supabase
      .from(ARMAS_TABLE)
      .update({
        local_atual: armaAnterior.local_atual ?? null
      })
      .eq('id', armaId)

    throw error
  }
}


export async function aceitarTransferencia({
  transferenciaId,
  user = null
}) {
  const ator = usuarioNormalizado(user)
  const transferencia = await buscarTransferenciaPorId(transferenciaId)

  if (transferencia.status !== STATUS_TRANSFERENCIA.PENDENTE) {
    throw new Error(`Esta transferência já está ${transferencia.status.toLowerCase()}.`)
  }

  const horaServidor = await obterHoraServidor()
  const categoria = upper(transferencia.categoria)
  const origemCodigo = upper(transferencia.origem_codigo)
  const destinoCodigo = upper(transferencia.destino_codigo)

  if (
    !(
      (origemCodigo === 'P4' && destinoCodigo === 'SVDD') ||
      (origemCodigo === 'SVDD' && destinoCodigo === 'P4')
    )
  ) {
    throw new Error(
      `Fluxo patrimonial não suportado: ${origemCodigo || 'SEM ORIGEM'} → ${destinoCodigo || 'SEM DESTINO'}.`
    )
  }

  let resultado

  if (categoria === 'ARMA') {
    resultado = await aceitarTransferenciaDeArma({
      transferencia,
      ator,
      horaServidor,
      user
    })
  } else {
    const estoque = await buscarEstoqueDaTransferencia(transferencia)
    const quantidade = quantidadeInteira(transferencia.quantidade)
    const saldoP4 = Number(estoque.quantidade_p4 || 0)
    const saldoSvdd = Number(estoque.quantidade_svdd || 0)

    let novoSaldoP4 = saldoP4
    let novoSaldoSvdd = saldoSvdd
    let campoConferencia = ''
    let saldoConferencia = 0

    if (origemCodigo === 'P4' && destinoCodigo === 'SVDD') {
      if (saldoP4 < quantidade) {
        throw new Error(
          `Saldo insuficiente no P4. Disponível: ${saldoP4}; solicitado: ${quantidade}.`
        )
      }

      novoSaldoP4 = saldoP4 - quantidade
      novoSaldoSvdd = saldoSvdd + quantidade
      campoConferencia = 'quantidade_p4'
      saldoConferencia = saldoP4
    } else {
      if (saldoSvdd < quantidade) {
        throw new Error(
          `Saldo insuficiente no SVDD. Disponível: ${saldoSvdd}; solicitado: ${quantidade}.`
        )
      }

      novoSaldoP4 = saldoP4 + quantidade
      novoSaldoSvdd = saldoSvdd - quantidade
      campoConferencia = 'quantidade_svdd'
      saldoConferencia = saldoSvdd
    }

    let atualizacaoEstoque = supabase
      .from(TONFAS_TABLE)
      .update({
        quantidade_p4: novoSaldoP4,
        quantidade_svdd: novoSaldoSvdd
      })
      .eq('id', estoque.id)
      .eq(campoConferencia, saldoConferencia)

    const { data: estoqueAtualizado, error: estoqueError } =
      await atualizacaoEstoque
        .select('*')
        .maybeSingle()

    if (estoqueError) throw estoqueError
    if (!estoqueAtualizado) {
      throw new Error('O saldo foi alterado por outro usuário. Atualize a tela e tente novamente.')
    }

    let movimentacao = null

    try {
      movimentacao = await registrarMovimentacao({
        patrimonioId: transferencia.patrimonio_id,
        tipo: 'TRANSFERENCIA',
        localDestino: transferencia.destino_nome,
        motivo: transferencia.motivo,
        observacao: transferencia.observacoes,
        dados: {
          transferencia_id: transferencia.id,
          protocolo_transferencia: transferencia.protocolo,
          quantidade,
          categoria: transferencia.categoria,
          origem_codigo: transferencia.origem_codigo,
          origem_nome: transferencia.origem_nome,
          destino_codigo: transferencia.destino_codigo,
          destino_nome: transferencia.destino_nome
        },
        user
      })

      const { data, error } = await supabase
        .from(TABLE)
        .update({
          status: STATUS_TRANSFERENCIA.ACEITA,
          recebido_por_id: ator.id,
          recebido_por_re: ator.re,
          recebido_por_nome: ator.nome,
          recebido_em: horaServidor,
          movimentacao_id: movimentacao?.id || movimentacao?.movimentacao?.id || null,
          updated_at: horaServidor
        })
        .eq('id', transferencia.id)
        .eq('status', STATUS_TRANSFERENCIA.PENDENTE)
        .select('*')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('A transferência foi alterada por outro usuário.')

      resultado = {
        transferencia: data,
        estoque: estoqueAtualizado,
        movimentacao
      }
    } catch (error) {
      await supabase
        .from(TONFAS_TABLE)
        .update({
          quantidade_p4: saldoP4,
          quantidade_svdd: saldoSvdd
        })
        .eq('id', estoque.id)

      throw error
    }
  }

  const quantidade = categoria === 'ARMA'
    ? 1
    : quantidadeInteira(transferencia.quantidade)
  const material = descricaoMaterial(
    categoria,
    quantidade,
    transferencia.metadata || {}
  )
  const setorDestino = destinoCodigo === 'P4' ? 'P4' : 'SVDD'
  const setorOrigem = origemCodigo === 'SVDD' ? 'SVDD' : 'P4'
  const mensagem =
    `O ${setorDestino} confirmou o recebimento de ${material}. ` +
    `Transferência ${transferencia.protocolo} concluída por ${ator.nome}` +
    `${ator.re ? `, RE ${ator.re}` : ''}, em ${formatarDataHoraServidor(horaServidor)}.`

  await notificarPerfis([
    {
      titulo: `Transferência recebida pelo ${setorDestino}`,
      mensagem,
      tipo: 'SUCESSO',
      modulo: 'PATRIMONIO',
      prioridade: 'NORMAL',
      destinatario_perfil:
        setorOrigem === 'P4' ? PERFIS.P4 : PERFIS.ENCARREGADO_SVDD,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: transferencia.id,
      link: linkDoModulo(categoria),
      metadata: {
        protocolo: transferencia.protocolo,
        categoria,
        status: STATUS_TRANSFERENCIA.ACEITA
      }
    },
    {
      titulo: `${setorDestino} confirmou recebimento`,
      mensagem,
      tipo: 'SUCESSO',
      modulo: 'PATRIMONIO',
      prioridade: 'NORMAL',
      destinatario_perfil: PERFIS.COMANDANTE_CIA,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: transferencia.id,
      link: linkDoModulo(categoria),
      metadata: {
        protocolo: transferencia.protocolo,
        categoria,
        status: STATUS_TRANSFERENCIA.ACEITA
      }
    }
  ])

  await auditar({
    tipo: 'TRANSFERENCIA_PATRIMONIAL_ACEITA',
    descricao: `Aceitou a transferência ${transferencia.protocolo}: ${material} recebido(s) pelo ${setorDestino}.`,
    usuario: user,
    modulo: 'Patrimônio',
    severidade: 'Informativo'
  })

  return resultado
}


export async function recusarTransferencia({
  transferenciaId,
  motivoRecusa,
  user = null
}) {
  const motivo = texto(motivoRecusa)
  if (!motivo) throw new Error('Informe o motivo da recusa.')

  const ator = usuarioNormalizado(user)
  const transferencia = await buscarTransferenciaPorId(transferenciaId)

  if (transferencia.status !== STATUS_TRANSFERENCIA.PENDENTE) {
    throw new Error(`Esta transferência já está ${transferencia.status.toLowerCase()}.`)
  }

  const horaServidor = await obterHoraServidor()
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: STATUS_TRANSFERENCIA.RECUSADA,
      recusado_por_id: ator.id,
      recusado_por_re: ator.re,
      recusado_por_nome: ator.nome,
      motivo_recusa: motivo,
      recusado_em: horaServidor,
      updated_at: horaServidor
    })
    .eq('id', transferencia.id)
    .eq('status', STATUS_TRANSFERENCIA.PENDENTE)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('A transferência foi alterada por outro usuário.')

  const material = descricaoMaterial(transferencia.categoria, transferencia.quantidade, transferencia.metadata || {})
  const mensagem =
    `O ${upper(transferencia.destino_codigo)} recusou ${material} da transferência ${transferencia.protocolo}. ` +
    `Motivo: ${motivo}. Responsável: ${ator.nome}.`

  await notificarPerfis([
    {
      titulo: `Transferência recusada pelo ${upper(transferencia.destino_codigo)}`,
      mensagem,
      tipo: 'ALERTA',
      modulo: 'PATRIMONIO',
      prioridade: 'ALTA',
      destinatario_perfil: upper(transferencia.origem_codigo) === 'P4' ? PERFIS.P4 : PERFIS.ENCARREGADO_SVDD,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: transferencia.id,
      link: linkDoModulo(transferencia.categoria),
      metadata: { protocolo: transferencia.protocolo, status: STATUS_TRANSFERENCIA.RECUSADA }
    },
    {
      titulo: 'SVDD recusou transferência',
      mensagem,
      tipo: 'ALERTA',
      modulo: 'PATRIMONIO',
      prioridade: 'NORMAL',
      destinatario_perfil: PERFIS.COMANDANTE_CIA,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: transferencia.id,
      link: linkDoModulo(transferencia.categoria),
      metadata: { protocolo: transferencia.protocolo, status: STATUS_TRANSFERENCIA.RECUSADA }
    }
  ])

  await auditar({
    tipo: 'TRANSFERENCIA_PATRIMONIAL_RECUSADA',
    descricao: `Recusou a transferência ${transferencia.protocolo}. Motivo: ${motivo}.`,
    usuario: user,
    modulo: 'Patrimônio',
    severidade: 'Alerta'
  })

  return data
}

export async function cancelarTransferencia({
  transferenciaId,
  motivoCancelamento = null,
  user = null
}) {
  const ator = usuarioNormalizado(user)
  const transferencia = await buscarTransferenciaPorId(transferenciaId)

  if (transferencia.status !== STATUS_TRANSFERENCIA.PENDENTE) {
    throw new Error('Somente transferências pendentes podem ser canceladas.')
  }

  const horaServidor = await obterHoraServidor()
  const motivo = texto(motivoCancelamento) || 'Cancelada pelo setor de origem.'

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: STATUS_TRANSFERENCIA.CANCELADA,
      motivo,
      cancelado_em: horaServidor,
      updated_at: horaServidor,
      metadata: {
        ...(transferencia.metadata || {}),
        cancelado_por_id: ator.id,
        cancelado_por_re: ator.re,
        cancelado_por_nome: ator.nome
      }
    })
    .eq('id', transferencia.id)
    .eq('status', STATUS_TRANSFERENCIA.PENDENTE)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('A transferência foi alterada por outro usuário.')

  const mensagem =
    `O ${upper(transferencia.origem_codigo)} cancelou a transferência ${transferencia.protocolo}. Motivo: ${motivo}.`

  await notificarPerfis([
    {
      titulo: `Transferência cancelada pelo ${upper(transferencia.origem_codigo)}`,
      mensagem,
      tipo: 'ALERTA',
      modulo: 'PATRIMONIO',
      prioridade: 'NORMAL',
      destinatario_perfil: upper(transferencia.destino_codigo) === 'P4' ? PERFIS.P4 : PERFIS.ENCARREGADO_SVDD,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: transferencia.id,
      link: linkDoModulo(transferencia.categoria, true),
      metadata: { protocolo: transferencia.protocolo, status: STATUS_TRANSFERENCIA.CANCELADA }
    },
    {
      titulo: 'P4 cancelou transferência',
      mensagem,
      tipo: 'ALERTA',
      modulo: 'PATRIMONIO',
      prioridade: 'NORMAL',
      destinatario_perfil: PERFIS.COMANDANTE_CIA,
      referencia_tipo: 'TRANSFERENCIA_PATRIMONIAL',
      referencia_id: transferencia.id,
      link: linkDoModulo(transferencia.categoria),
      metadata: { protocolo: transferencia.protocolo, status: STATUS_TRANSFERENCIA.CANCELADA }
    }
  ])

  await auditar({
    tipo: 'TRANSFERENCIA_PATRIMONIAL_CANCELADA',
    descricao: `Cancelou a transferência ${transferencia.protocolo}. Motivo: ${motivo}.`,
    usuario: user,
    modulo: 'Patrimônio',
    severidade: 'Alerta'
  })

  return data
}
