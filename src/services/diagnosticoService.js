import {
  supabase
} from './supabaseClient'

const TABELAS_PRIORITARIAS = [
  'policiais',
  'sigmo_policiais_fotos',
  'sigmo_materiais',
  'sigmo_armas',
  'sigmo_municoes',
  'sigmo_patrimonios',
  'sigmo_patrimonio_movimentacoes',
  'sigmo_solicitacoes_cadastro',
  'sigmo_permissoes_temporarias',
  'sigmo_releases',
  'auditoria'
]

function normalizarColunas(
  colunas
) {
  if (
    !Array.isArray(colunas)
  ) {
    return []
  }

  return colunas
    .map(
      (coluna) => ({
        nome:
          coluna?.nome ||
          '',

        tipo:
          coluna?.tipo ||
          coluna?.tipo_banco ||
          'desconhecido',

        tipoBanco:
          coluna?.tipo_banco ||
          '',

        aceitaNulo:
          Boolean(
            coluna?.aceita_nulo
          ),

        padrao:
          coluna?.padrao ??
          null,

        posicao:
          Number(
            coluna?.posicao
          ) || 0
      })
    )
    .sort(
      (a, b) =>
        a.posicao -
        b.posicao
    )
}

function normalizarTabela(
  item
) {
  return {
    tabela:
      item?.tabela ||
      'tabela_desconhecida',

    existe:
      Boolean(
        item?.existe
      ),

    totalColunas:
      Number(
        item?.total_colunas
      ) || 0,

    colunas:
      normalizarColunas(
        item?.colunas
      )
  }
}

export async function diagnosticarBanco() {
  const {
    data,
    error
  } = await supabase
    .rpc(
      'sigmo_diagnosticar_banco'
    )

  if (error) {
    throw error
  }

  const tabelas =
    (data ?? [])
      .map(
        normalizarTabela
      )

  const mapa =
    new Map(
      tabelas.map(
        (item) => [
          item.tabela,
          item
        ]
      )
    )

  return TABELAS_PRIORITARIAS
    .map(
      (nome) =>
        mapa.get(nome) || {
          tabela:
            nome,

          existe:
            false,

          totalColunas:
            0,

          colunas:
            []
        }
    )
}

export function resumirDiagnostico(
  tabelas = []
) {
  const total =
    tabelas.length

  const existentes =
    tabelas.filter(
      (item) =>
        item.existe
    ).length

  const ausentes =
    total -
    existentes

  const totalColunas =
    tabelas.reduce(
      (
        acumulado,
        item
      ) =>
        acumulado +
        Number(
          item.totalColunas ||
          0
        ),
      0
    )

  return {
    total,
    existentes,
    ausentes,
    totalColunas,
    saudavel:
      total > 0 &&
      ausentes === 0
  }
}