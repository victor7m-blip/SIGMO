import { supabase } from './supabaseClient'

const FONTES = [
  
  {
    tabela: 'sigmo_patrimonio_historico',
    origem: 'HISTORICO'
  },
  {
    tabela: 'sigmo_patrimonio_movimentacoes',
    origem: 'MOVIMENTACAO'
  }
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

function normalizarUpper(valor) {
  return texto(valor).toUpperCase()
}

function objeto(valor) {
  if (!valor) {
    return {}
  }

  if (typeof valor === 'object') {
    return valor
  }

  try {
    return JSON.parse(valor)
  } catch {
    return {}
  }
}

function obterDataEvento(evento) {
  for (const campo of CAMPOS_DATA) {
    if (evento?.[campo]) {
      return evento[campo]
    }
  }

  return null
}

function obterTimestamp(evento) {
  const data = obterDataEvento(evento)

  if (!data) {
    return 0
  }

  const timestamp = new Date(data).getTime()

  return Number.isNaN(timestamp)
    ? 0
    : timestamp
}

function ordenarEventos(eventos) {
  return [...eventos].sort(
    (eventoA, eventoB) =>
      obterTimestamp(eventoB) -
      obterTimestamp(eventoA)
  )
}

function removerDuplicados(eventos) {
  const mapa = new Map()

  for (const evento of eventos) {
    const chave =
      evento.id ||
      [
        evento.origem,
        obterDataEvento(evento),
        evento.tipo,
        evento.descricao,
        evento.patrimonio_id,
        evento.referencia_id
      ].join('|')

    if (!mapa.has(chave)) {
      mapa.set(chave, evento)
    }
  }

  return [...mapa.values()]
}

function obterIdentificadores(patrimonio) {
  const dados = objeto(patrimonio?.dados)

  return [
    patrimonio?.id,
    patrimonio?.referencia_id,
    patrimonio?.patrimonio_id,
    patrimonio?.entidade_id,
    patrimonio?.item_id,
    patrimonio?.identificador,
    patrimonio?.numero_patrimonio,
    patrimonio?.patrimonio,
    patrimonio?.numero_serie,
    patrimonio?.serie,
    dados.id,
    dados.referencia_id,
    dados.numero_patrimonio,
    dados.patrimonio,
    dados.numero_serie,
    dados.serie
  ]
    .filter(Boolean)
    .map((valor) => texto(valor))
    .filter(Boolean)
}

async function consultarFontePorCampo({
  tabela,
  campo,
  valor,
  limite
}) {
  if (!tabela || !campo || !valor) {
    return []
  }

  const consultaBase = supabase
    .from(tabela)
    .select('*')
    .eq(campo, valor)
    .limit(limite)

  const {
    data,
    error
  } = await consultaBase

  if (error) {
    return []
  }

  return data ?? []
}

async function buscarNaFonte({
  tabela,
  origem,
  patrimonio,
  limite
}) {
  const identificadores =
    obterIdentificadores(patrimonio)

  if (identificadores.length === 0) {
    return []
  }

  const campos = [
    'patrimonio_id',
    'referencia_id',
    'entidade_id',
    'item_id',
    'registro_id',
    'material_id',
    'arma_id'
  ]

  const encontrados = []

  for (const campo of campos) {
    for (const valor of identificadores) {
      const eventos =
        await consultarFontePorCampo({
          tabela,
          campo,
          valor,
          limite
        })

      if (eventos.length > 0) {
        encontrados.push(
          ...eventos.map((evento) => ({
            ...evento,
            origem
          }))
        )
      }
    }
  }

  return removerDuplicados(encontrados)
}

export async function listarTimelinePatrimonio({
  patrimonio,
  limite = 50
} = {}) {
  if (!patrimonio) {
    return []
  }

  const resultados = await Promise.all(
    FONTES.map((fonte) =>
      buscarNaFonte({
        ...fonte,
        patrimonio,
        limite
      })
    )
  )

  return ordenarEventos(
    removerDuplicados(
      resultados.flat()
    )
  ).slice(0, limite)
}

export async function registrarEventoTimelinePatrimonial({
  patrimonioId,
  referenciaId = null,
  tipo = 'EVENTO',
  titulo = null,
  descricao = null,
  usuarioId = null,
  usuarioNome = null,
  localAnterior = null,
  localAtual = null,
  statusAnterior = null,
  statusAtual = null,
  responsavelRe = null,
  responsavelNome = null,
  dados = {}
} = {}) {
  if (!patrimonioId && !referenciaId) {
    throw new Error(
      'Informe o patrimônio para registrar o evento.'
    )
  }

  const tipoNormalizado =
    normalizarUpper(tipo) || 'EVENTO'

  const descricaoNormalizada =
    texto(descricao) ||
    texto(titulo) ||
    tipoNormalizado

  const payload = {
    patrimonio_id:
      patrimonioId || referenciaId,

    referencia_id:
      referenciaId || null,

    tipo:
      tipoNormalizado,

    titulo:
      texto(titulo) ||
      descricaoNormalizada,

    descricao:
      descricaoNormalizada,

    usuario_id:
      usuarioId || null,

    usuario_nome:
      texto(usuarioNome) || null,

    local_anterior:
      texto(localAnterior) || null,

    local_atual:
      texto(localAtual) || null,

    status_anterior:
      normalizarUpper(statusAnterior) || null,

    status_atual:
      normalizarUpper(statusAtual) || null,

    responsavel_re:
      texto(responsavelRe) || null,

    responsavel_nome:
      texto(responsavelNome) || null,

    dados: {
      ...objeto(dados),
      origem: 'CENTRAL_OPERACIONAL'
    }
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function registrarEventoFoto({
  patrimonio,
  foto,
  usuario
} = {}) {
  return registrarEventoTimelinePatrimonial({
    patrimonioId: patrimonio?.id,
    referenciaId:
      patrimonio?.referencia_id,

    tipo: 'FOTO_ADICIONADA',
    titulo: 'Foto adicionada',
    descricao:
      'Uma nova foto foi adicionada ao patrimônio.',

    usuarioId: usuario?.id,
    usuarioNome:
      usuario?.nome ||
      usuario?.email,

    dados: {
      foto_id: foto?.id,
      foto_url:
        foto?.url ||
        foto?.public_url,
      arquivo:
        foto?.nome ||
        foto?.filename
    }
  })
}

export async function registrarEventoQrCode({
  patrimonio,
  codigo,
  usuario
} = {}) {
  return registrarEventoTimelinePatrimonial({
    patrimonioId: patrimonio?.id,
    referenciaId:
      patrimonio?.referencia_id,

    tipo: 'QRCODE_GERADO',
    titulo: 'QR Code gerado',
    descricao:
      'O QR Code do patrimônio foi gerado.',

    usuarioId: usuario?.id,
    usuarioNome:
      usuario?.nome ||
      usuario?.email,

    dados: {
      codigo
    }
  })
}

export async function registrarEventoConferencia({
  patrimonio,
  conferencia,
  usuario
} = {}) {
  const resultado =
    normalizarUpper(
      conferencia?.resultado ||
      conferencia?.status
    ) || 'CONFERIDO'

  return registrarEventoTimelinePatrimonial({
    patrimonioId: patrimonio?.id,
    referenciaId:
      patrimonio?.referencia_id,

    tipo:
      resultado === 'DIVERGENTE'
        ? 'CONFERENCIA_DIVERGENTE'
        : 'CONFERENCIA_REALIZADA',

    titulo:
      resultado === 'DIVERGENTE'
        ? 'Divergência identificada'
        : 'Conferência realizada',

    descricao:
      conferencia?.observacao ||
      conferencia?.descricao ||
      (
        resultado === 'DIVERGENTE'
          ? 'A conferência identificou divergência patrimonial.'
          : 'O patrimônio foi conferido sem divergências.'
      ),

    usuarioId: usuario?.id,
    usuarioNome:
      usuario?.nome ||
      usuario?.email,

    localAtual:
      conferencia?.local_atual ||
      patrimonio?.local_atual,

    statusAtual:
      patrimonio?.status,

    dados: {
      conferencia_id:
        conferencia?.id,
      resultado,
      observacao:
        conferencia?.observacao
    }
  })
}

export async function registrarEventoResponsavel({
  patrimonio,
  responsavelAnterior,
  responsavelAtual,
  usuario
} = {}) {
  return registrarEventoTimelinePatrimonial({
    patrimonioId: patrimonio?.id,
    referenciaId:
      patrimonio?.referencia_id,

    tipo: 'RESPONSAVEL_ALTERADO',
    titulo: 'Responsável alterado',

    descricao: [
      responsavelAnterior?.nome
        ? `Responsável anterior: ${responsavelAnterior.nome}.`
        : null,

      responsavelAtual?.nome
        ? `Novo responsável: ${responsavelAtual.nome}.`
        : 'Patrimônio sem responsável.'
    ]
      .filter(Boolean)
      .join(' '),

    usuarioId: usuario?.id,
    usuarioNome:
      usuario?.nome ||
      usuario?.email,

    responsavelRe:
      responsavelAtual?.re,

    responsavelNome:
      responsavelAtual?.nome,

    dados: {
      responsavel_anterior:
        responsavelAnterior || null,

      responsavel_atual:
        responsavelAtual || null
    }
  })
}

export function normalizarEventoTimeline(evento) {
  const dados = objeto(
    evento?.dados ||
    evento?.metadata ||
    evento?.detalhes_json
  )

  const tipo = normalizarUpper(
    evento?.tipo ||
    evento?.evento ||
    evento?.acao ||
    evento?.operacao ||
    dados.tipo ||
    'EVENTO'
  )

  const titulo =
    texto(
      evento?.titulo ||
      evento?.descricao ||
      evento?.detalhes ||
      evento?.mensagem ||
      dados.titulo
    ) || tipo

  const descricao =
    texto(
      evento?.descricao ||
      evento?.detalhes ||
      evento?.mensagem ||
      dados.descricao
    ) || titulo

  const autor =
    texto(
      evento?.autor ||
      evento?.usuario_nome ||
      evento?.realizado_por ||
      evento?.criado_por ||
      evento?.atualizado_por ||
      dados.usuario_nome
    ) || 'Sistema'

  const data =
    obterDataEvento(evento)

  return {
    ...evento,
    dados,
    tipo,
    titulo,
    descricao,
    autor,
    data,
    origem:
      evento?.origem ||
      dados.origem ||
      'TIMELINE',

    local_anterior:
      evento?.local_anterior ||
      dados.local_anterior ||
      null,

    local_atual:
      evento?.local_atual ||
      dados.local_atual ||
      null,

    status_anterior:
      evento?.status_anterior ||
      dados.status_anterior ||
      null,

    status_atual:
      evento?.status_atual ||
      dados.status_atual ||
      null,

    responsavel_re:
      evento?.responsavel_re ||
      dados.responsavel_re ||
      null,

    responsavel_nome:
      evento?.responsavel_nome ||
      dados.responsavel_nome ||
      null
  }
}