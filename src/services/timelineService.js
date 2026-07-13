import { supabase } from './supabaseClient'

const TIMELINE_VIEW = 'sigmo_timeline_patrimonial'

function inicioDoDia(data) {
  const resultado = new Date(data)

  resultado.setHours(0, 0, 0, 0)

  return resultado
}

function diferencaEmDias(data) {
  const hoje = inicioDoDia(new Date())
  const evento = inicioDoDia(new Date(data))

  return Math.floor(
    (hoje.getTime() - evento.getTime()) /
    (1000 * 60 * 60 * 24)
  )
}

export function obterGrupoTemporal(data) {
  const dias = diferencaEmDias(data)

  if (dias === 0) return 'HOJE'
  if (dias === 1) return 'ONTEM'
  if (dias <= 7) return 'ESTA SEMANA'
  if (dias <= 30) return 'ESTE MÊS'

  return 'ANTERIORES'
}

function formatarCampo(valor, fallback = '') {
  const texto = String(valor ?? '').trim()

  return texto || fallback
}

function obterNomeItem(item) {
  const dados = item?.dados ?? {}

  return (
    dados.patrimonio ||
    dados.numero_patrimonio ||
    dados.descricao ||
    dados.numero_serie ||
    dados.modelo ||
    dados.material_id ||
    item.referencia_id ||
    'PATRIMÔNIO'
  )
}

function obterAutor(item) {
  return (
    item.realizado_por_nome ||
    item.realizado_por_email ||
    item.realizado_por_re ||
    'SISTEMA'
  )
}

export function gerarDescricaoTimeline(item) {
  const nome = obterNomeItem(item)

  switch (item.tipo) {
    case 'RECEBIMENTO':
      return `recebeu o material ${nome}`

    case 'TRANSFERENCIA':
      return `transferiu ${nome} para ${
        formatarCampo(
          item.local_destino ||
          item.companhia_destino,
          'OUTRO LOCAL'
        )
      }`

    case 'CAUTELA':
      return `cautelou ${nome} para ${
        formatarCampo(
          item.recebedor_nome ||
          item.recebedor_re,
          'RECEBEDOR'
        )
      }`

    case 'DEVOLUCAO':
      return `registrou a devolução de ${nome}`

    case 'RECOLHIMENTO':
      return `recolheu ${nome}`

    case 'BAIXA':
      return `baixou ${nome}`

    case 'CADASTRO':
      return `cadastrou ${nome}`

    case 'EDICAO':
      return `alterou os dados de ${nome}`

    case 'FOTO_ADICIONADA':
      return `adicionou uma foto em ${nome}`

    case 'FOTO_REMOVIDA':
      return `removeu uma foto de ${nome}`

    case 'QR_CODE_GERADO':
      return `gerou o QR Code de ${nome}`

    case 'ETIQUETA_IMPRESSA':
      return `imprimiu a etiqueta de ${nome}`

    case 'EXCLUSAO':
      return `excluiu ${nome}`

    default:
      return `registrou uma movimentação em ${nome}`
  }
}

export function normalizarItemTimeline(item) {
  return {
    ...item,

    autor: obterAutor(item),
    titulo: gerarDescricaoTimeline(item),

    item_nome: obterNomeItem(item),

    grupo: obterGrupoTemporal(item.created_at),

    hora: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(item.created_at)),

    data_formatada: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(item.created_at))
  }
}

export async function listarTimeline({
  patrimonioId = null,
  patrimonioTipo = null,
  tipos = [],
  limite = 100
} = {}) {
  let query = supabase
    .from(TIMELINE_VIEW)
    .select('*')
    .order('created_at', {
      ascending: false
    })
    .limit(limite)

  if (patrimonioId) {
    query = query.eq('patrimonio_id', patrimonioId)
  }

  if (patrimonioTipo) {
    query = query.eq(
      'patrimonio_tipo',
      String(patrimonioTipo).trim().toLowerCase()
    )
  }

  if (Array.isArray(tipos) && tipos.length > 0) {
    query = query.in(
      'tipo',
      tipos.map((tipo) => String(tipo).trim().toUpperCase())
    )
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []).map(normalizarItemTimeline)
}

export function agruparTimeline(itens = []) {
  return itens.reduce((grupos, item) => {
    const grupo = item.grupo || obterGrupoTemporal(item.created_at)

    if (!grupos[grupo]) {
      grupos[grupo] = []
    }

    grupos[grupo].push(item)

    return grupos
  }, {})
}