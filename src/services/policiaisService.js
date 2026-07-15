import { supabase } from './supabaseClient'

const TABLE = 'policiais'
const FOTOS_TABLE = 'sigmo_policiais_fotos'

function gerarPinTemporario() {
  const numero =
    Math.floor(
      100000 +
      Math.random() * 900000
    )

  return String(numero)
}

async function pinJaExiste(pin) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('id')
    .eq('pin', pin)
    .limit(1)

  if (error) {
    throw error
  }

  return (
    Array.isArray(data) &&
    data.length > 0
  )
}

async function gerarPinUnico() {
  for (
    let tentativa = 0;
    tentativa < 20;
    tentativa += 1
  ) {
    const pin =
      gerarPinTemporario()

    const existe =
      await pinJaExiste(pin)

    if (!existe) {
      return pin
    }
  }

  throw new Error(
    'Não foi possível gerar um PIN temporário. Tente novamente.'
  )
}

async function anexarFotosPrincipais(
  policiais = []
) {
  if (
    !Array.isArray(policiais) ||
    policiais.length === 0
  ) {
    return []
  }

  const ids = policiais
    .map(
      (policial) =>
        policial.id
    )
    .filter(Boolean)

  if (ids.length === 0) {
    return policiais
  }

  const {
    data: fotos,
    error
  } = await supabase
    .from(FOTOS_TABLE)
    .select(`
      id,
      policial_id,
      url,
      principal,
      created_at
    `)
    .in(
      'policial_id',
      ids
    )
    .order(
      'principal',
      {
        ascending: false
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    console.warn(
      'Não foi possível carregar as fotos dos policiais:',
      error
    )

    return policiais
  }

  const fotoPorPolicial =
    new Map()

  for (
    const foto of fotos ?? []
  ) {
    if (
      !foto?.policial_id ||
      !foto?.url
    ) {
      continue
    }

    /*
     * A consulta já vem ordenada com:
     * 1. foto principal primeiro;
     * 2. foto mais recente depois.
     *
     * Por isso mantemos a primeira foto
     * encontrada de cada policial.
     */
    if (
      !fotoPorPolicial.has(
        foto.policial_id
      )
    ) {
      fotoPorPolicial.set(
        foto.policial_id,
        foto
      )
    }
  }

  return policiais.map(
    (policial) => {
      const foto =
        fotoPorPolicial.get(
          policial.id
        )

      return {
        ...policial,

        /*
         * Preferimos a foto cadastrada
         * na galeria. Caso não exista,
         * mantemos foto_url do policial.
         */
        foto_url:
          foto?.url ||
          policial.foto_url ||
          null,

        foto_principal:
          foto || null
      }
    }
  )
}

export async function listarPoliciais({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio =
    (pagina - 1) * limite

  const fim =
    inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', {
      count: 'exact'
    })
    .order(sortBy, {
      ascending:
        sortDirection === 'asc',

      nullsFirst: false
    })
    .range(
      inicio,
      fim
    )

  if (filtros.nome?.trim()) {
    query = query.ilike(
      'nome',
      `%${filtros.nome.trim()}%`
    )
  }

  if (
    filtros.nome_guerra?.trim()
  ) {
    query = query.ilike(
      'nome_guerra',
      `%${filtros.nome_guerra.trim()}%`
    )
  }

  if (filtros.re?.trim()) {
    query = query.ilike(
      're',
      `%${filtros.re.trim()}%`
    )
  }

  if (
  filtros.perfil?.trim()
) {
  query = query.eq(
    'perfil',
    filtros.perfil
  )
}

  if (
    filtros.qr_code?.trim()
  ) {
    query = query.ilike(
      'qr_code',
      `%${filtros.qr_code.trim()}%`
    )
  }

  if (
    filtros.posto_graduacao?.trim()
  ) {
    query = query.eq(
      'posto_graduacao',
      filtros.posto_graduacao
    )
  }

  if (
    filtros.companhia?.trim()
  ) {
    query = query.ilike(
      'companhia',
      `%${filtros.companhia.trim()}%`
    )
  }

  if (
    filtros.pelotao?.trim()
  ) {
    query = query.ilike(
      'pelotao',
      `%${filtros.pelotao.trim()}%`
    )
  }

  if (
    filtros.situacao?.trim()
  ) {
    query = query.eq(
      'situacao',
      filtros.situacao
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

  const policiaisComFotos =
    await anexarFotosPrincipais(
      data ?? []
    )

  return {
    data:
      policiaisComFotos,

    total:
      count ?? 0
  }
}

async function buscarValoresUnicos(
  campo
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select(campo)

  if (error) {
    throw error
  }

  return [
    ...new Set(
      (data ?? [])
        .map(
          (item) =>
            item[campo]
        )
        .filter(Boolean)
    )
  ].sort()
}

export function listarPostosGraduacoes() {
  return buscarValoresUnicos(
    'posto_graduacao'
  )
}

export function listarCompanhias() {
  return buscarValoresUnicos(
    'companhia'
  )
}

export function listarPelotoes() {
  return buscarValoresUnicos(
    'pelotao'
  )
}

export function listarSituacoesPoliciais() {
  return buscarValoresUnicos(
    'situacao'
  )
}

export async function cadastrarPolicial(
  payload
) {
  const pinTemporario =
    await gerarPinUnico()

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert({
      ...payload,

      qr_code:
        payload.qr_code ||
        null,

      pin:
        pinTemporario
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return {
    ...data,

    pinTemporario
  }
}

export async function atualizarPolicial(
  id,
  payload
) {
  const dadosAtualizacao = {
    ...payload,

    qr_code:
      payload.qr_code ||
      null
  }

  delete dadosAtualizacao.pin
  delete dadosAtualizacao.pinTemporario
  delete dadosAtualizacao.foto_principal

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update(
      dadosAtualizacao
    )
    .eq(
      'id',
      id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function gerarNovoPinPolicial(
  id
) {
  if (!id) {
    throw new Error(
      'Policial não informado.'
    )
  }

  const pinTemporario =
    await gerarPinUnico()

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      pin:
        pinTemporario
    })
    .eq(
      'id',
      id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return {
    ...data,

    pinTemporario
  }
}

export async function excluirPolicial(
  id
) {
  const {
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq(
      'id',
      id
    )

  if (error) {
    throw error
  }
}