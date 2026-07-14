import { supabase } from './supabaseClient'

const FONTES = [
  'sigmo_timeline_patrimonial',
  'sigmo_patrimonio_historico',
  'sigmo_patrimonio_movimentacoes'
]

function ordenarEventos(eventos) {
  return [...eventos].sort(
    (a, b) => {
      const dataA = new Date(
        a.created_at ||
          a.data_evento ||
          a.data ||
          0
      ).getTime()

      const dataB = new Date(
        b.created_at ||
          b.data_evento ||
          b.data ||
          0
      ).getTime()

      return dataB - dataA
    }
  )
}

async function tentarConsulta({
  tabela,
  campo,
  valor,
  limite
}) {
  if (!valor) {
    return []
  }

  const { data, error } = await supabase
    .from(tabela)
    .select('*')
    .eq(campo, valor)
    .order('created_at', {
      ascending: false
    })
    .limit(limite)

  if (error) {
    return []
  }

  return data ?? []
}

async function buscarNaFonte({
  tabela,
  patrimonio,
  limite
}) {
  const tentativas = [
    {
      campo: 'patrimonio_id',
      valor: patrimonio?.id
    },
    {
      campo: 'patrimonio_id',
      valor: patrimonio?.referencia_id
    },
    {
      campo: 'referencia_id',
      valor: patrimonio?.referencia_id
    },
    {
      campo: 'entidade_id',
      valor: patrimonio?.referencia_id
    },
    {
      campo: 'item_id',
      valor: patrimonio?.referencia_id
    }
  ]

  for (const tentativa of tentativas) {
    const eventos = await tentarConsulta({
      tabela,
      campo: tentativa.campo,
      valor: tentativa.valor,
      limite
    })

    if (eventos.length > 0) {
      return eventos
    }
  }

  return []
}

export async function listarTimelinePatrimonio({
  patrimonio,
  limite = 50
}) {
  if (!patrimonio) {
    return []
  }

  const resultados =
    await Promise.all(
      FONTES.map((tabela) =>
        buscarNaFonte({
          tabela,
          patrimonio,
          limite
        })
      )
    )

  const mapa = new Map()

  for (const evento of resultados.flat()) {
    const chave =
      evento.id ||
      [
        evento.created_at,
        evento.tipo,
        evento.descricao
      ].join('-')

    mapa.set(chave, evento)
  }

  return ordenarEventos(
    [...mapa.values()]
  ).slice(0, limite)
}

export function normalizarEventoTimeline(
  evento
) {
  const tipo = String(
    evento?.tipo ||
      evento?.evento ||
      evento?.acao ||
      evento?.operacao ||
      'EVENTO'
  ).toUpperCase()

  const titulo =
    evento?.titulo ||
    evento?.descricao ||
    evento?.detalhes ||
    evento?.mensagem ||
    tipo

  const autor =
    evento?.autor ||
    evento?.usuario_nome ||
    evento?.realizado_por ||
    evento?.criado_por ||
    evento?.atualizado_por ||
    'Sistema'

  const data =
    evento?.created_at ||
    evento?.data_evento ||
    evento?.data ||
    evento?.updated_at

  return {
    ...evento,
    tipo,
    titulo,
    autor,
    data
  }
}