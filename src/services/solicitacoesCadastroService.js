import { supabase } from './supabaseClient'

const TABLE =
  'sigmo_solicitacoes_cadastro'

const POLICIAIS_TABLE =
  'policiais'

const STATUS = {
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  REPROVADO: 'REPROVADO',
  CANCELADO: 'CANCELADO'
}

/*
 * Campos que nunca poderão ser alterados
 * por meio de uma solicitação cadastral.
 */
const CAMPOS_PROTEGIDOS = [
  'id',
  'pin',
  'perfil',
  'created_at',
  'updated_at',
  'foto_principal',
  'pinTemporario'
]

function validarId(
  valor,
  mensagem
) {
  if (!valor) {
    throw new Error(mensagem)
  }
}

function limparObjeto(
  objeto = {}
) {
  if (
    !objeto ||
    typeof objeto !== 'object' ||
    Array.isArray(objeto)
  ) {
    return {}
  }

  const resultado = {}

  for (
    const [campo, valor] of
    Object.entries(objeto)
  ) {
    if (
      CAMPOS_PROTEGIDOS.includes(
        campo
      )
    ) {
      continue
    }

    /*
     * undefined não pode ser gravado
     * corretamente dentro do JSON.
     */
    if (valor === undefined) {
      continue
    }

    resultado[campo] = valor
  }

  return resultado
}

function valoresIguais(
  valorAtual,
  valorNovo
) {
  if (
    valorAtual === valorNovo
  ) {
    return true
  }

  /*
   * Normaliza null, undefined e string vazia
   * para evitar solicitações sem alteração real.
   */
  const atualNormalizado =
    valorAtual === undefined ||
    valorAtual === null
      ? ''
      : String(valorAtual).trim()

  const novoNormalizado =
    valorNovo === undefined ||
    valorNovo === null
      ? ''
      : String(valorNovo).trim()

  return (
    atualNormalizado ===
    novoNormalizado
  )
}

function obterSomenteAlteracoes(
  dadosAtuais = {},
  dadosNovos = {}
) {
  const novosLimpos =
    limparObjeto(dadosNovos)

  const alteracoes = {}

  for (
    const [campo, valorNovo] of
    Object.entries(novosLimpos)
  ) {
    const valorAtual =
      dadosAtuais?.[campo]

    if (
      valoresIguais(
        valorAtual,
        valorNovo
      )
    ) {
      continue
    }

    alteracoes[campo] =
      valorNovo
  }

  return alteracoes
}

function montarDadosAnteriores(
  dadosAtuais = {},
  alteracoes = {}
) {
  const anteriores = {}

  for (
    const campo of
    Object.keys(alteracoes)
  ) {
    anteriores[campo] =
      dadosAtuais?.[campo] ??
      null
  }

  return anteriores
}

async function buscarPolicialPorId(
  policialId
) {
  validarId(
    policialId,
    'Policial não informado.'
  )

  const {
    data,
    error
  } = await supabase
    .from(POLICIAIS_TABLE)
    .select('*')
    .eq(
      'id',
      policialId
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'Policial não encontrado.'
    )
  }

  return data
}

async function buscarPoliciaisPorIds(
  ids = []
) {
  const idsValidos = [
    ...new Set(
      ids.filter(Boolean)
    )
  ]

  if (
    idsValidos.length === 0
  ) {
    return new Map()
  }

  const {
    data,
    error
  } = await supabase
    .from(POLICIAIS_TABLE)
    .select(`
      id,
      nome,
      nome_guerra,
      re,
      posto_graduacao,
      companhia,
      pelotao,
      funcao,
      perfil,
      situacao,
      foto_url
    `)
    .in(
      'id',
      idsValidos
    )

  if (error) {
    throw error
  }

  return new Map(
    (data ?? []).map(
      (policial) => [
        policial.id,
        policial
      ]
    )
  )
}

async function anexarDadosPoliciais(
  solicitacoes = []
) {
  if (
    !Array.isArray(solicitacoes) ||
    solicitacoes.length === 0
  ) {
    return []
  }

  const ids = []

  for (
    const solicitacao of
    solicitacoes
  ) {
    ids.push(
      solicitacao.policial_id,
      solicitacao.solicitado_por,
      solicitacao.analisado_por
    )
  }

  const policiaisPorId =
    await buscarPoliciaisPorIds(ids)

  return solicitacoes.map(
    (solicitacao) => ({
      ...solicitacao,

      policial:
        policiaisPorId.get(
          solicitacao.policial_id
        ) || null,

      solicitante:
        policiaisPorId.get(
          solicitacao.solicitado_por
        ) || null,

      analisador:
        policiaisPorId.get(
          solicitacao.analisado_por
        ) || null
    })
  )
}

export async function buscarSolicitacaoPorId(
  solicitacaoId
) {
  validarId(
    solicitacaoId,
    'Solicitação não informada.'
  )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq(
      'id',
      solicitacaoId
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'Solicitação não encontrada.'
    )
  }

  const [solicitacaoCompleta] =
    await anexarDadosPoliciais([
      data
    ])

  return solicitacaoCompleta
}

export async function buscarSolicitacaoPendente(
  policialId
) {
  validarId(
    policialId,
    'Policial não informado.'
  )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq(
      'policial_id',
      policialId
    )
    .eq(
      'status',
      STATUS.PENDENTE
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function criarSolicitacao({
  policialId,
  solicitadoPor,
  dadosAtuais,
  dadosNovos,
  observacao = null
}) {
  validarId(
    policialId,
    'Policial não informado.'
  )

  const policialAtual =
    dadosAtuais?.id === policialId
      ? dadosAtuais
      : await buscarPolicialPorId(
          policialId
        )

  const pendente =
    await buscarSolicitacaoPendente(
      policialId
    )

  if (pendente) {
    throw new Error(
      'Já existe uma solicitação de alteração cadastral pendente para este policial.'
    )
  }

  const alteracoes =
    obterSomenteAlteracoes(
      policialAtual,
      dadosNovos
    )

  if (
    Object.keys(alteracoes)
      .length === 0
  ) {
    throw new Error(
      'Nenhuma alteração cadastral foi identificada.'
    )
  }

  const anteriores =
    montarDadosAnteriores(
      policialAtual,
      alteracoes
    )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert({
      policial_id:
        policialId,

      solicitado_por:
        solicitadoPor ||
        policialId,

      dados_anteriores:
        anteriores,

      dados_novos:
        alteracoes,

      status:
        STATUS.PENDENTE,

      observacao_solicitante:
        observacao?.trim() ||
        null
    })
    .select()
    .single()

  if (error) {
    /*
     * Código PostgreSQL para violação
     * de índice único.
     */
    if (
      error.code === '23505'
    ) {
      throw new Error(
        'Já existe uma solicitação pendente para este policial.'
      )
    }

    throw error
  }

  return data
}

export async function listarSolicitacoes({
  status = '',
  policialId = '',
  pagina = 1,
  limite = 20,
  sortDirection = 'desc'
} = {}) {
  const paginaValida =
    Math.max(
      Number(pagina) || 1,
      1
    )

  const limiteValido =
    Math.max(
      Number(limite) || 20,
      1
    )

  const inicio =
    (paginaValida - 1) *
    limiteValido

  const fim =
    inicio +
    limiteValido -
    1

  let query = supabase
    .from(TABLE)
    .select('*', {
      count: 'exact'
    })
    .order(
      'criado_em',
      {
        ascending:
          sortDirection === 'asc',

        nullsFirst: false
      }
    )
    .range(
      inicio,
      fim
    )

  if (status?.trim()) {
    query = query.eq(
      'status',
      status.trim().toUpperCase()
    )
  }

  if (policialId) {
    query = query.eq(
      'policial_id',
      policialId
    )
  }

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    throw error
  }

  const solicitacoes =
    await anexarDadosPoliciais(
      data ?? []
    )

  return {
    data:
      solicitacoes,

    total:
      count ?? 0
  }
}

export function listarPendentes({
  pagina = 1,
  limite = 20
} = {}) {
  return listarSolicitacoes({
    status:
      STATUS.PENDENTE,

    pagina,
    limite
  })
}

export function listarMinhasSolicitacoes({
  policialId,
  pagina = 1,
  limite = 20
} = {}) {
  validarId(
    policialId,
    'Policial não informado.'
  )

  return listarSolicitacoes({
    policialId,
    pagina,
    limite
  })
}

export async function aprovarSolicitacao({
  solicitacaoId,
  analisadoPor,
  observacao = null
}) {
  validarId(
    solicitacaoId,
    'Solicitação não informada.'
  )

  validarId(
    analisadoPor,
    'Responsável pela aprovação não informado.'
  )

  const solicitacao =
    await buscarSolicitacaoPorId(
      solicitacaoId
    )

  if (
    solicitacao.status !==
    STATUS.PENDENTE
  ) {
    throw new Error(
      'Esta solicitação já foi analisada.'
    )
  }

  const dadosNovos =
    limparObjeto(
      solicitacao.dados_novos
    )

  if (
    Object.keys(dadosNovos)
      .length === 0
  ) {
    throw new Error(
      'A solicitação não possui alterações válidas.'
    )
  }

  const {
    data: policialAtualizado,
    error: erroPolicial
  } = await supabase
    .from(POLICIAIS_TABLE)
    .update(dadosNovos)
    .eq(
      'id',
      solicitacao.policial_id
    )
    .select()
    .single()

  if (erroPolicial) {
    throw erroPolicial
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      status:
        STATUS.APROVADO,

      analisado_por:
        analisadoPor,

      observacao_analise:
        observacao?.trim() ||
        null
    })
    .eq(
      'id',
      solicitacaoId
    )
    .eq(
      'status',
      STATUS.PENDENTE
    )
    .select()
    .maybeSingle()

  if (error || !data) {
    /*
     * Se a atualização do status falhar,
     * tentamos restaurar os valores antigos.
     *
     * Posteriormente poderemos transformar
     * esse fluxo em uma função RPC transacional.
     */
    const dadosAnteriores =
      limparObjeto(
        solicitacao.dados_anteriores
      )

    if (
      Object.keys(dadosAnteriores)
        .length > 0
    ) {
      const {
        error: erroRestauracao
      } = await supabase
        .from(POLICIAIS_TABLE)
        .update(
          dadosAnteriores
        )
        .eq(
          'id',
          solicitacao.policial_id
        )

      if (erroRestauracao) {
        console.error(
          'Falha ao restaurar os dados anteriores do policial:',
          erroRestauracao
        )
      }
    }

    if (error) {
      throw error
    }

    throw new Error(
      'A solicitação não pôde ser aprovada porque seu status foi alterado.'
    )
  }

  return {
    solicitacao:
      data,

    policial:
      policialAtualizado
  }
}

export async function reprovarSolicitacao({
  solicitacaoId,
  analisadoPor,
  observacao
}) {
  validarId(
    solicitacaoId,
    'Solicitação não informada.'
  )

  validarId(
    analisadoPor,
    'Responsável pela reprovação não informado.'
  )

  if (
    !observacao?.trim()
  ) {
    throw new Error(
      'Informe o motivo da reprovação.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      status:
        STATUS.REPROVADO,

      analisado_por:
        analisadoPor,

      observacao_analise:
        observacao.trim()
    })
    .eq(
      'id',
      solicitacaoId
    )
    .eq(
      'status',
      STATUS.PENDENTE
    )
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'A solicitação não foi encontrada ou já foi analisada.'
    )
  }

  return data
}

export async function cancelarSolicitacao({
  solicitacaoId,
  policialId
}) {
  validarId(
    solicitacaoId,
    'Solicitação não informada.'
  )

  validarId(
    policialId,
    'Policial não informado.'
  )

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      status:
        STATUS.CANCELADO
    })
    .eq(
      'id',
      solicitacaoId
    )
    .eq(
      'policial_id',
      policialId
    )
    .eq(
      'status',
      STATUS.PENDENTE
    )
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'A solicitação não foi encontrada, já foi analisada ou não pertence ao policial informado.'
    )
  }

  return data
}

export async function contarSolicitacoesPendentes() {
  const {
    count,
    error
  } = await supabase
    .from(TABLE)
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq(
      'status',
      STATUS.PENDENTE
    )

  if (error) {
    throw error
  }

  return count ?? 0
}

export {
  STATUS as STATUS_SOLICITACAO_CADASTRO
}