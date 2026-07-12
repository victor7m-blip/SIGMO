import { supabase } from './supabaseClient'
import {
  registerPatrimonialAudit
} from './auditoriaService'

export const TIPOS_EVENTO_PATRIMONIAL = Object.freeze({
  CADASTRO: 'CADASTRO',
  EDICAO: 'EDIÇÃO',
  STATUS: 'STATUS',
  LOCAL: 'LOCAL',
  FOTO_ADICIONADA: 'FOTO_ADICIONADA',
  FOTO_REMOVIDA: 'FOTO_REMOVIDA',
  FOTO_PRINCIPAL: 'FOTO_PRINCIPAL',
  FOTO_BAIXADA: 'FOTO_BAIXADA',
  QRCODE_GERADO: 'QRCODE_GERADO',
  ETIQUETA_IMPRESSA: 'ETIQUETA_IMPRESSA',
  MOVIMENTACAO: 'MOVIMENTAÇÃO',
  CAUTELA: 'CAUTELA',
  DEVOLUCAO: 'DEVOLUÇÃO',
  TRANSFERENCIA: 'TRANSFERÊNCIA',
  BAIXA: 'BAIXA',
  EXCLUSAO: 'EXCLUSÃO'
})

function normalizarPayload(payload = {}) {
  const novoPayload = {}

  Object.entries(payload).forEach(([chave, valor]) => {
    novoPayload[chave] =
      typeof valor === 'string'
        ? valor.trim().toUpperCase()
        : valor
  })

  return novoPayload
}

export function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.name ||
    user?.email ||
    'SIGMO'
  )
}

function formatarNomeCampo(campo) {
  const nomes = {
    patrimonio: 'PATRIMÔNIO',
    descricao: 'DESCRIÇÃO',
    categoria: 'CATEGORIA',
    marca: 'MARCA',
    modelo: 'MODELO',
    numero_serie: 'NÚMERO DE SÉRIE',
    especie: 'ESPÉCIE',
    calibre: 'CALIBRE',
    status: 'STATUS',
    local_atual: 'LOCAL',
    unidade: 'UNIDADE',
    observacoes: 'OBSERVAÇÕES'
  }

  return nomes[campo] || campo.replaceAll('_', ' ').toUpperCase()
}

function valorParaTexto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return '-'
  }

  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor)
    } catch {
      return String(valor)
    }
  }

  return String(valor)
}

function normalizarTipoEvento(tipo) {
  return String(
    tipo || TIPOS_EVENTO_PATRIMONIAL.MOVIMENTACAO
  ).toUpperCase()
}

function criarDescricaoPadrao({
  tipo,
  usuario
}) {
  const nomeUsuario = obterNomeUsuario(usuario)

  const descricoes = {
    CADASTRO:
      `${nomeUsuario} cadastrou o patrimônio.`,

    'EDIÇÃO':
      `${nomeUsuario} atualizou o patrimônio.`,

    STATUS:
      `${nomeUsuario} alterou o status.`,

    LOCAL:
      `${nomeUsuario} alterou o local.`,

    FOTO_ADICIONADA:
      `${nomeUsuario} adicionou uma foto.`,

    FOTO_REMOVIDA:
      `${nomeUsuario} removeu uma foto.`,

    FOTO_PRINCIPAL:
      `${nomeUsuario} definiu a foto principal.`,

    FOTO_BAIXADA:
      `${nomeUsuario} baixou uma foto.`,

    QRCODE_GERADO:
      `${nomeUsuario} gerou o QR Code.`,

    ETIQUETA_IMPRESSA:
      `${nomeUsuario} imprimiu uma etiqueta.`,

    'MOVIMENTAÇÃO':
      `${nomeUsuario} registrou uma movimentação.`,

    CAUTELA:
      `${nomeUsuario} realizou uma cautela.`,

    'DEVOLUÇÃO':
      `${nomeUsuario} registrou uma devolução.`,

    'TRANSFERÊNCIA':
      `${nomeUsuario} realizou uma transferência.`,

    BAIXA:
      `${nomeUsuario} realizou a baixa do patrimônio.`,

    'EXCLUSÃO':
      `${nomeUsuario} excluiu o patrimônio.`
  }

  return (
    descricoes[tipo] ||
    `${nomeUsuario} registrou um evento patrimonial.`
  )
}

function obterSeveridadeEvento(tipo) {
  if (
    tipo === TIPOS_EVENTO_PATRIMONIAL.EXCLUSAO ||
    tipo === TIPOS_EVENTO_PATRIMONIAL.BAIXA
  ) {
    return 'Atenção'
  }

  return 'Informativo'
}

export async function registrarEventoPatrimonial({
  tipo,
  patrimonioId,
  usuario = null,
  descricao = null,
  movimentacaoId = null,
  metadata = null
}) {
  if (!patrimonioId) {
    console.warn(
      'Evento patrimonial não registrado: patrimônio não informado.'
    )

    return null
  }

  const tipoNormalizado = normalizarTipoEvento(tipo)

  const descricaoEvento =
    descricao ||
    criarDescricaoPadrao({
      tipo: tipoNormalizado,
      usuario
    })

  const registro = {
    patrimonio_id: patrimonioId,
    movimentacao_id: movimentacaoId,
    tipo_evento: tipoNormalizado,
    descricao: descricaoEvento,
    created_by: usuario?.id || null,
    created_by_nome: obterNomeUsuario(usuario)
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert([registro])
    .select()
    .single()

  if (error) {
    console.warn(
      'Erro ao registrar evento patrimonial:',
      {
        error,
        tipo: tipoNormalizado,
        patrimonioId,
        metadata
      }
    )

    return null
  }

  try {
    await registerPatrimonialAudit({
      tipo: tipoNormalizado,
      descricao: descricaoEvento,
      usuario,
      modulo: 'Patrimônio',
      severidade: obterSeveridadeEvento(
        tipoNormalizado
      )
    })
  } catch (auditError) {
    console.warn(
      'Histórico registrado, mas houve erro na auditoria:',
      auditError
    )
  }

  return data
}

export async function registrarHistoricoPatrimonio({
  patrimonio_id,
  tipo_evento,
  descricao,
  user = null,
  movimentacao_id = null
}) {
  return registrarEventoPatrimonial({
    tipo: tipo_evento,
    patrimonioId: patrimonio_id,
    usuario: user,
    descricao,
    movimentacaoId: movimentacao_id
  })
}

function listarAlteracoes(antes = {}, depois = {}) {
  const ignorar = [
    'id',
    'created_at',
    'updated_at'
  ]

  return Object.keys(depois)
    .filter((chave) => !ignorar.includes(chave))
    .filter(
      (chave) =>
        valorParaTexto(antes?.[chave]) !==
        valorParaTexto(depois?.[chave])
    )
    .map((chave) => ({
      campo: chave,
      anterior: valorParaTexto(antes?.[chave]),
      novo: valorParaTexto(depois?.[chave])
    }))
}

async function registrarAlteracoes({
  patrimonioId,
  antes,
  depois,
  usuario
}) {
  const alteracoes = listarAlteracoes(antes, depois)

  if (alteracoes.length === 0) {
    await registrarEventoPatrimonial({
      tipo: TIPOS_EVENTO_PATRIMONIAL.EDICAO,
      patrimonioId,
      usuario,
      descricao:
        `${obterNomeUsuario(usuario)} atualizou o registro.`
    })

    return
  }

  for (const alteracao of alteracoes) {
    const nomeCampo =
      formatarNomeCampo(alteracao.campo)

    let tipoEvento =
      TIPOS_EVENTO_PATRIMONIAL.EDICAO

    if (alteracao.campo === 'status') {
      tipoEvento =
        TIPOS_EVENTO_PATRIMONIAL.STATUS
    }

    if (alteracao.campo === 'local_atual') {
      tipoEvento =
        TIPOS_EVENTO_PATRIMONIAL.LOCAL
    }

    await registrarEventoPatrimonial({
      tipo: tipoEvento,
      patrimonioId,
      usuario,
      descricao:
        `${obterNomeUsuario(usuario)} alterou ` +
        `${nomeCampo}: ${alteracao.anterior} → ${alteracao.novo}.`,
      metadata: {
        campo: alteracao.campo,
        valorAnterior: alteracao.anterior,
        valorNovo: alteracao.novo
      }
    })
  }
}

export async function listarPatrimoniosEngine(config) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .order('created_at', {
      ascending: false
    })

  if (error) throw error

  return data || []
}

export async function buscarPatrimonioEnginePorId(
  config,
  id
) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

export async function cadastrarPatrimonioEngine(
  config,
  payload,
  user = null
) {
  const payloadNormalizado =
    normalizarPayload(payload)

  const { data, error } = await supabase
    .from(config.tabela)
    .insert([payloadNormalizado])
    .select()
    .single()

  if (error) throw error

  await registrarEventoPatrimonial({
    tipo: TIPOS_EVENTO_PATRIMONIAL.CADASTRO,
    patrimonioId: data.id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} cadastrou o patrimônio.`,
    metadata: {
      tabela: config.tabela
    }
  })

  return data
}

export async function atualizarPatrimonioEngine(
  config,
  id,
  payload,
  user = null
) {
  const antes =
    await buscarPatrimonioEnginePorId(config, id)

  const payloadNormalizado =
    normalizarPayload(payload)

  const { data, error } = await supabase
    .from(config.tabela)
    .update(payloadNormalizado)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await registrarAlteracoes({
    patrimonioId: id,
    antes,
    depois: data,
    usuario: user
  })

  return data
}

export async function excluirPatrimonioEngine(
  config,
  id,
  user = null
) {
  const antes =
    await buscarPatrimonioEnginePorId(config, id)

  await registrarEventoPatrimonial({
    tipo: TIPOS_EVENTO_PATRIMONIAL.EXCLUSAO,
    patrimonioId: id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} excluiu o registro: ` +
      `${antes?.patrimonio || antes?.descricao || id}.`,
    metadata: {
      tabela: config.tabela,
      registro: antes
    }
  })

  const { error } = await supabase
    .from(config.tabela)
    .delete()
    .eq('id', id)

  if (error) throw error

  return true
}