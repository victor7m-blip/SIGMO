import { supabase } from './supabaseClient'

const FONTES = [
  { tabela: 'sigmo_patrimonio_historico', origem: 'HISTORICO' },
  { tabela: 'sigmo_patrimonio_movimentacoes', origem: 'MOVIMENTACAO' }
]

const CAMPOS_DATA = [
  'created_at',
  'data_evento',
  'data_movimentacao',
  'data',
  'updated_at'
]

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor) {
  return texto(valor).toUpperCase()
}

function ehUuid(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    texto(valor)
  )
}

function valorHumano(valor) {
  const resultado = texto(valor)
  return resultado && !ehUuid(resultado)
    ? resultado
    : ''
}

function objeto(valor) {
  if (!valor) return {}
  if (typeof valor === 'object') return valor

  try {
    return JSON.parse(valor)
  } catch {
    return {}
  }
}

function obterData(item) {
  for (const campo of CAMPOS_DATA) {
    if (item?.[campo]) return item[campo]
  }

  return null
}

function timestamp(item) {
  const data = obterData(item)
  const valor = data ? new Date(data).getTime() : 0

  return Number.isNaN(valor) ? 0 : valor
}

function tipoEvento(item) {
  const dados = objeto(item?.dados)

  return upper(
    item?.tipo ||
    item?.tipo_movimentacao ||
    item?.tipo_evento ||
    item?.evento ||
    item?.acao ||
    dados.tipo ||
    dados.tipo_movimentacao ||
    'EVENTO'
  )
}

function inicioDoDia(data) {
  const resultado = new Date(data)
  resultado.setHours(0, 0, 0, 0)
  return resultado
}

export function obterGrupoTemporal(data) {
  const hoje = inicioDoDia(new Date())
  const evento = inicioDoDia(new Date(data))
  const dias = Math.floor(
    (hoje.getTime() - evento.getTime()) /
    (1000 * 60 * 60 * 24)
  )

  if (dias === 0) return 'HOJE'
  if (dias === 1) return 'ONTEM'
  if (dias <= 7) return 'ESTA SEMANA'
  if (dias <= 30) return 'ESTE MÊS'
  return 'ANTERIORES'
}

function obterNomeItem(item) {
  const dados = objeto(item?.dados)

  return (
    valorHumano(dados.patrimonio) ||
    valorHumano(dados.numero_patrimonio) ||
    valorHumano(dados.nome) ||
    valorHumano(dados.descricao) ||
    valorHumano(dados.numero_serie) ||
    valorHumano(dados.modelo) ||
    valorHumano(item?.patrimonio) ||
    valorHumano(item?.numero_patrimonio) ||
    valorHumano(dados.tipo_patrimonio) ||
    valorHumano(item?.tipo_patrimonio) ||
    valorHumano(dados.categoria) ||
    'material'
  )
}

function obterAutor(item) {
  const dados = objeto(item?.dados)

  return (
    item?.realizado_por_nome ||
    item?.usuario_nome ||
    item?.criado_por_nome ||
    item?.realizado_por_email ||
    item?.realizado_por_re ||
    dados.usuario_nome ||
    'SISTEMA'
  )
}

function obterDestino(item) {
  const dados = objeto(item?.dados)

  return (
    item?.destino_nome ||
    item?.local_destino ||
    item?.companhia_destino ||
    item?.destino_codigo ||
    dados.destino_nome ||
    dados.local_destino ||
    dados.companhia_destino ||
    dados.destino_codigo ||
    'OUTRO LOCAL'
  )
}

function obterRecebedor(item) {
  const dados = objeto(item?.dados)

  return (
    valorHumano(item?.recebedor_nome) ||
    valorHumano(item?.responsavel_nome) ||
    valorHumano(dados.recebedor_nome) ||
    valorHumano(dados.policial_nome) ||
    valorHumano(item?.recebedor_re) ||
    valorHumano(item?.responsavel_re) ||
    valorHumano(dados.recebedor_re) ||
    valorHumano(dados.policial_re) ||
    ''
  )
}

export function gerarDescricaoTimeline(item) {
  const nome = obterNomeItem(item)
  const recebedor = obterRecebedor(item)

  switch (tipoEvento(item)) {
    case 'RECEBIMENTO':
      return nome === 'material'
        ? 'recebeu material'
        : `recebeu ${nome}`
    case 'TRANSFERENCIA':
      return nome === 'material'
        ? `transferiu material para ${obterDestino(item)}`
        : `transferiu ${nome} para ${obterDestino(item)}`
    case 'CAUTELA':
    case 'CAUTELA_SERVICO':
      if (recebedor) {
        return nome === 'material'
          ? `cautelou material para ${recebedor}`
          : `cautelou ${nome} para ${recebedor}`
      }
      return nome === 'material'
        ? 'registrou uma cautela de material'
        : `registrou uma cautela de ${nome}`
    case 'CARGA_PERMANENTE':
      if (recebedor) {
        return nome === 'material'
          ? `pagou material como carga permanente para ${recebedor}`
          : `pagou ${nome} como carga permanente para ${recebedor}`
      }
      return 'registrou uma carga permanente'
    case 'DEVOLUCAO':
      return nome === 'material'
        ? 'registrou uma devolução de material'
        : `registrou a devolução de ${nome}`
    case 'RECOLHIMENTO':
      return nome === 'material'
        ? 'recolheu material'
        : `recolheu ${nome}`
    case 'BAIXA':
      return nome === 'material'
        ? 'baixou material'
        : `baixou ${nome}`
    case 'CADASTRO':
      return nome === 'material'
        ? 'cadastrou material'
        : `cadastrou ${nome}`
    case 'EDICAO':
      return nome === 'material'
        ? 'alterou dados patrimoniais'
        : `alterou os dados de ${nome}`
    case 'FOTO_ADICIONADA':
      return nome === 'material'
        ? 'adicionou uma foto ao patrimônio'
        : `adicionou uma foto em ${nome}`
    case 'FOTO_REMOVIDA':
      return nome === 'material'
        ? 'removeu uma foto do patrimônio'
        : `removeu uma foto de ${nome}`
    case 'QR_CODE_GERADO':
    case 'QRCODE_GERADO':
      return nome === 'material'
        ? 'gerou o QR Code do patrimônio'
        : `gerou o QR Code de ${nome}`
    case 'ETIQUETA_IMPRESSA':
      return nome === 'material'
        ? 'imprimiu uma etiqueta patrimonial'
        : `imprimiu a etiqueta de ${nome}`
    case 'EXCLUSAO':
      return nome === 'material'
        ? 'excluiu um registro patrimonial'
        : `excluiu ${nome}`
    default: {
      const descricao = texto(item?.descricao || item?.titulo)
      if (descricao && !descricao.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)) {
        return descricao
      }
      return nome === 'material'
        ? 'registrou uma movimentação patrimonial'
        : `registrou uma movimentação em ${nome}`
    }
  }
}

export function normalizarItemTimeline(item) {
  const data = obterData(item) || new Date().toISOString()

  return {
    ...item,
    tipo: tipoEvento(item),
    created_at: data,
    autor: obterAutor(item),
    titulo: gerarDescricaoTimeline(item),
    item_nome: obterNomeItem(item),
    grupo: obterGrupoTemporal(data),
    hora: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(data)),
    data_formatada: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(data))
  }
}

function correspondePatrimonio(item, patrimonioId) {
  if (!patrimonioId) return true

  const esperado = texto(patrimonioId)
  const dados = objeto(item?.dados)
  const ids = [
    item?.patrimonio_id,
    item?.referencia_id,
    item?.entidade_id,
    item?.item_id,
    item?.registro_id,
    item?.material_id,
    item?.arma_id,
    item?.lote_id,
    dados.patrimonio_id,
    dados.referencia_id,
    dados.entidade_id,
    dados.item_id,
    dados.registro_id,
    dados.material_id,
    dados.arma_id,
    dados.lote_id,
    dados.tonfa_id
  ].filter(Boolean).map(texto)

  return ids.includes(esperado)
}

function correspondeTipoPatrimonio(item, patrimonioTipo) {
  if (!patrimonioTipo) return true

  const dados = objeto(item?.dados)
  const encontrado = texto(
    item?.patrimonio_tipo ||
    item?.categoria ||
    item?.tipo_patrimonio ||
    dados.patrimonio_tipo ||
    dados.categoria ||
    dados.tipo_patrimonio
  ).toLowerCase()

  return encontrado === texto(patrimonioTipo).toLowerCase()
}

async function consultarFonte(fonte, limite) {
  const quantidade = Math.max(Number(limite || 100) * 5, 100)

  const ordenada = await supabase
    .from(fonte.tabela)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(quantidade)

  if (!ordenada.error) {
    return (ordenada.data ?? []).map(item => ({
      ...item,
      origem: fonte.origem
    }))
  }

  const simples = await supabase
    .from(fonte.tabela)
    .select('*')
    .limit(quantidade)

  if (simples.error) {
    console.warn(`Timeline indisponível em ${fonte.tabela}.`, simples.error)
    return []
  }

  return (simples.data ?? []).map(item => ({
    ...item,
    origem: fonte.origem
  }))
}

function removerDuplicados(itens) {
  const mapa = new Map()

  for (const item of itens) {
    const chave = item?.id
      ? `${item.origem}:${item.id}`
      : [
          item.origem,
          obterData(item),
          tipoEvento(item),
          item.patrimonio_id,
          item.referencia_id,
          item.descricao
        ].join('|')

    if (!mapa.has(chave)) mapa.set(chave, item)
  }

  return [...mapa.values()]
}

export async function listarTimeline({
  patrimonioId = null,
  patrimonioTipo = null,
  tipos = [],
  limite = 100
} = {}) {
  const resultados = await Promise.all(
    FONTES.map(fonte => consultarFonte(fonte, limite))
  )

  const tiposNormalizados = Array.isArray(tipos)
    ? tipos.map(upper).filter(Boolean)
    : []

  return removerDuplicados(resultados.flat())
    .filter(item => correspondePatrimonio(item, patrimonioId))
    .filter(item => correspondeTipoPatrimonio(item, patrimonioTipo))
    .filter(item =>
      tiposNormalizados.length === 0 ||
      tiposNormalizados.includes(tipoEvento(item))
    )
    .sort((a, b) => timestamp(b) - timestamp(a))
    .slice(0, Math.max(Number(limite || 100), 1))
    .map(normalizarItemTimeline)
}

export function agruparTimeline(itens = []) {
  return itens.reduce((grupos, item) => {
    const grupo = item.grupo || obterGrupoTemporal(item.created_at)

    if (!grupos[grupo]) grupos[grupo] = []
    grupos[grupo].push(item)

    return grupos
  }, {})
}
