import { supabase } from './supabaseClient'

const PATRIMONIOS_TABLE = 'sigmo_patrimonios'
const CONFERENCIAS_TABLE = 'sigmo_conferencias'
const CONFERENCIAS_ITENS_TABLE = 'sigmo_conferencias_itens'

function texto(valor) {
  return String(valor ?? '').trim()
}

function textoUpper(valor) {
  return texto(valor).toUpperCase()
}

function obterPrimeiro(objeto, campos = [], fallback = '') {
  for (const campo of campos) {
    const valor = objeto?.[campo]

    if (valor !== undefined && valor !== null && texto(valor) !== '') {
      return valor
    }
  }

  return fallback
}

function normalizarModulo(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      [
        'modulo',
        'tipo_modulo',
        'modulo_origem',
        'origem_modulo',
        'categoria_modulo'
      ],
      'PATRIMÔNIO'
    )
  )
}

function normalizarCategoria(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      [
        'categoria',
        'tipo',
        'tipo_patrimonio',
        'subtipo',
        'especie',
        'grupo',
        'material_tipo'
      ],
      normalizarModulo(item)
    )
  )
}

function normalizarIdentificador(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      [
        'patrimonio',
        'numero_patrimonio',
        'codigo',
        'numero_serie',
        'serial',
        'identificador',
        'referencia'
      ],
      item?.id
    )
  )
}

function normalizarStatus(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      ['status', 'situacao', 'estado', 'status_atual'],
      'SEM STATUS'
    )
  )
}

function normalizarResponsavelRe(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      [
        'responsavel_re',
        'policial_re',
        're_responsavel',
        'cautelado_re',
        're_atual',
        'destinatario_re'
      ],
      ''
    )
  )
}

function normalizarResponsavelNome(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      [
        'responsavel_nome',
        'policial_nome',
        'nome_responsavel',
        'cautelado_nome',
        'nome_atual',
        'destinatario_nome'
      ],
      ''
    )
  )
}

function normalizarLocal(item = {}) {
  return textoUpper(
    obterPrimeiro(
      item,
      [
        'local_atual',
        'local',
        'localizacao',
        'setor',
        'deposito',
        'destino'
      ],
      ''
    )
  )
}

function statusIndicaBaixado(status) {
  return ['BAIXADO', 'INATIVO', 'EXCLUÍDO', 'EXCLUIDO'].includes(status)
}

function statusIndicaComPolicial(status) {
  return [
    'CAUTELADO',
    'EM USO',
    'COM POLICIAL',
    'DISTRIBUÍDO',
    'DISTRIBUIDO',
    'ENTREGUE'
  ].includes(status)
}

function statusIndicaCofre(status, local) {
  const localNormalizado = textoUpper(local)

  if (
    localNormalizado.includes('COFRE') ||
    localNormalizado.includes('RESERVA') ||
    localNormalizado.includes('ALMOXARIFADO') ||
    localNormalizado.includes('DEPÓSITO') ||
    localNormalizado.includes('DEPOSITO')
  ) {
    return true
  }

  return [
    'ATIVO',
    'DISPONÍVEL',
    'DISPONIVEL',
    'EM ESTOQUE',
    'NO COFRE',
    'RESERVA'
  ].includes(status)
}

export function normalizarPatrimonioOperacional(item = {}) {
  const status = normalizarStatus(item)
  const responsavelRe = normalizarResponsavelRe(item)
  const responsavelNome = normalizarResponsavelNome(item)
  const local = normalizarLocal(item)

  const baixado = statusIndicaBaixado(status)

  const comPolicial =
    !baixado &&
    Boolean(responsavelRe || responsavelNome || statusIndicaComPolicial(status))

  const noCofre =
    !baixado &&
    !comPolicial &&
    statusIndicaCofre(status, local)

  return {
    ...item,
    id: item?.id,
    modulo: normalizarModulo(item),
    categoria: normalizarCategoria(item),
    identificador: normalizarIdentificador(item),
    status,
    responsavel_re: responsavelRe,
    responsavel_nome: responsavelNome,
    local_atual: local,
    baixado,
    com_policial: comPolicial,
    no_cofre: noCofre
  }
}

function ordenarTexto(a, b) {
  return texto(a).localeCompare(texto(b), 'pt-BR', {
    numeric: true,
    sensitivity: 'base'
  })
}

function erroTabelaInexistente(error) {
  return ['42P01', 'PGRST205'].includes(error?.code)
}

async function listarPatrimoniosBase() {
  const { data, error } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')

  if (error) {
    throw new Error(
      error.message || 'Não foi possível consultar os patrimônios.'
    )
  }

  return (data ?? []).map(normalizarPatrimonioOperacional)
}

export async function listarResumoCentral() {
  const patrimonios = await listarPatrimoniosBase()

  const ativos = patrimonios.filter((item) => !item.baixado)

  const categoriasMap = ativos.reduce((mapa, item) => {
    const chave = item.categoria || item.modulo || 'PATRIMÔNIO'

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        categoria: chave,
        modulo: item.modulo,
        total: 0,
        com_policial: 0,
        no_cofre: 0,
        sem_localizacao: 0,
        divergencias: 0
      })
    }

    const grupo = mapa.get(chave)

    grupo.total += 1

    if (item.com_policial) {
      grupo.com_policial += 1
    }

    if (item.no_cofre) {
      grupo.no_cofre += 1
    }

    if (!item.com_policial && !item.no_cofre) {
      grupo.sem_localizacao += 1
    }

    return mapa
  }, new Map())

  let divergencias = []

  try {
    divergencias = await listarDivergenciasAbertas()
  } catch {
    divergencias = []
  }

  divergencias.forEach((item) => {
    const categoria = textoUpper(item.categoria)

    if (!categoria || !categoriasMap.has(categoria)) {
      return
    }

    categoriasMap.get(categoria).divergencias += 1
  })

  const categorias = Array.from(categoriasMap.values()).sort((a, b) =>
    ordenarTexto(a.categoria, b.categoria)
  )

  return {
    total: ativos.length,
    com_policial: ativos.filter((item) => item.com_policial).length,
    no_cofre: ativos.filter((item) => item.no_cofre).length,
    sem_localizacao: ativos.filter(
      (item) => !item.com_policial && !item.no_cofre
    ).length,
    divergencias: divergencias.length,
    categorias
  }
}

export async function listarCategoriasOperacionais() {
  const resumo = await listarResumoCentral()
  return resumo.categorias
}

export async function listarPatrimoniosCategoria(categoria) {
  const categoriaNormalizada = textoUpper(categoria)
  const patrimonios = await listarPatrimoniosBase()

  return patrimonios
    .filter(
      (item) =>
        !item.baixado &&
        (item.categoria === categoriaNormalizada ||
          item.modulo === categoriaNormalizada)
    )
    .sort((a, b) => ordenarTexto(a.identificador, b.identificador))
}

export async function listarResponsaveisCategoria(categoria) {
  const patrimonios = await listarPatrimoniosCategoria(categoria)

  const responsaveisMap = patrimonios
    .filter((item) => item.com_policial)
    .reduce((mapa, item) => {
      const chave =
        item.responsavel_re ||
        item.responsavel_nome ||
        `SEM-IDENTIFICACAO-${item.id}`

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          re: item.responsavel_re,
          nome: item.responsavel_nome || 'RESPONSÁVEL NÃO IDENTIFICADO',
          quantidade: 0,
          patrimonios: [],
          possui_divergencia: false
        })
      }

      const responsavel = mapa.get(chave)

      responsavel.quantidade += 1
      responsavel.patrimonios.push(item)

      return mapa
    }, new Map())

  return Array.from(responsaveisMap.values()).sort((a, b) => {
    const porNome = ordenarTexto(a.nome, b.nome)

    if (porNome !== 0) {
      return porNome
    }

    return ordenarTexto(a.re, b.re)
  })
}

export async function buscarResponsabilidadePolicial(termo) {
  const busca = textoUpper(termo)

  if (!busca) {
    return {
      policial: null,
      patrimonios: [],
      total: 0
    }
  }

  const patrimonios = await listarPatrimoniosBase()

  const encontrados = patrimonios
    .filter((item) => {
      if (item.baixado) {
        return false
      }

      return (
        item.responsavel_re.includes(busca) ||
        item.responsavel_nome.includes(busca)
      )
    })
    .sort((a, b) => {
      const porCategoria = ordenarTexto(a.categoria, b.categoria)

      if (porCategoria !== 0) {
        return porCategoria
      }

      return ordenarTexto(a.identificador, b.identificador)
    })

  const primeiro = encontrados[0]

  return {
    policial: primeiro
      ? {
          re: primeiro.responsavel_re,
          nome: primeiro.responsavel_nome
        }
      : null,
    patrimonios: encontrados,
    total: encontrados.length
  }
}

export async function buscarPatrimonioOperacional(termo) {
  const busca = textoUpper(termo)

  if (!busca) {
    return null
  }

  const patrimonios = await listarPatrimoniosBase()

  return (
    patrimonios.find(
      (item) =>
        item.id === termo ||
        item.identificador === busca ||
        textoUpper(item.numero_serie) === busca ||
        textoUpper(item.codigo) === busca
    ) ?? null
  )
}

export async function criarConferencia({
  categoria,
  nome = '',
  observacao = '',
  criadoPorRe = '',
  criadoPorNome = ''
}) {
  const categoriaNormalizada = textoUpper(categoria)

  if (!categoriaNormalizada) {
    throw new Error('Informe a categoria da conferência.')
  }

  const patrimonios = await listarPatrimoniosCategoria(categoriaNormalizada)

  const { data: conferencia, error } = await supabase
    .from(CONFERENCIAS_TABLE)
    .insert({
      nome: textoUpper(nome) || `CONFERÊNCIA ${categoriaNormalizada}`,
      categoria: categoriaNormalizada,
      status: 'EM_ANDAMENTO',
      total_esperado: patrimonios.length,
      total_encontrado: 0,
      total_divergencia: 0,
      observacao: textoUpper(observacao) || null,
      criado_por_re: textoUpper(criadoPorRe) || null,
      criado_por_nome: textoUpper(criadoPorNome) || null
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Não foi possível iniciar a conferência.')
  }

  if (patrimonios.length > 0) {
    const itens = patrimonios.map((item) => ({
      conferencia_id: conferencia.id,
      patrimonio_id: item.id,
      categoria: item.categoria,
      identificador: item.identificador,
      status_conferencia: 'PENDENTE',
      responsavel_re_esperado: item.responsavel_re || null,
      responsavel_nome_esperado: item.responsavel_nome || null,
      local_esperado: item.local_atual || null
    }))

    const { error: itensError } = await supabase
      .from(CONFERENCIAS_ITENS_TABLE)
      .insert(itens)

    if (itensError) {
      await supabase
        .from(CONFERENCIAS_TABLE)
        .delete()
        .eq('id', conferencia.id)

      throw new Error(
        itensError.message ||
          'Não foi possível preparar os itens da conferência.'
      )
    }
  }

  return conferencia
}

export async function obterConferenciaAtiva(categoria) {
  const categoriaNormalizada = textoUpper(categoria)

  let query = supabase
    .from(CONFERENCIAS_TABLE)
    .select('*')
    .eq('status', 'EM_ANDAMENTO')
    .order('created_at', { ascending: false })
    .limit(1)

  if (categoriaNormalizada) {
    query = query.eq('categoria', categoriaNormalizada)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    if (erroTabelaInexistente(error)) {
      return null
    }

    throw new Error(error.message || 'Não foi possível consultar a conferência.')
  }

  return data ?? null
}

export async function listarItensConferencia(conferenciaId) {
  if (!conferenciaId) {
    return []
  }

  const { data, error } = await supabase
    .from(CONFERENCIAS_ITENS_TABLE)
    .select('*')
    .eq('conferencia_id', conferenciaId)
    .order('identificador', { ascending: true })

  if (error) {
    throw new Error(
      error.message || 'Não foi possível consultar os itens da conferência.'
    )
  }

  return data ?? []
}

export async function conferirPatrimonio({
  conferenciaId,
  patrimonio,
  encontradoPorRe = '',
  encontradoPorNome = '',
  observacao = ''
}) {
  if (!conferenciaId) {
    throw new Error('Conferência não identificada.')
  }

  const itemNormalizado = normalizarPatrimonioOperacional(patrimonio)

  if (!itemNormalizado.id) {
    throw new Error('Patrimônio não identificado.')
  }

  const { data, error } = await supabase
    .from(CONFERENCIAS_ITENS_TABLE)
    .update({
      status_conferencia: 'ENCONTRADO',
      encontrado_em: new Date().toISOString(),
      encontrado_por_re: textoUpper(encontradoPorRe) || null,
      encontrado_por_nome: textoUpper(encontradoPorNome) || null,
      observacao: textoUpper(observacao) || null
    })
    .eq('conferencia_id', conferenciaId)
    .eq('patrimonio_id', itemNormalizado.id)
    .select('*')
    .single()

  if (error) {
    throw new Error(
      error.message || 'Não foi possível registrar a conferência.'
    )
  }

  await recalcularConferencia(conferenciaId)

  return data
}

export async function marcarDivergenciaConferencia({
  conferenciaId,
  itemId,
  tipoDivergencia = 'NÃO LOCALIZADO',
  observacao = ''
}) {
  const { data, error } = await supabase
    .from(CONFERENCIAS_ITENS_TABLE)
    .update({
      status_conferencia: 'DIVERGENTE',
      tipo_divergencia: textoUpper(tipoDivergencia),
      observacao: textoUpper(observacao) || null
    })
    .eq('conferencia_id', conferenciaId)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Não foi possível registrar a divergência.')
  }

  await recalcularConferencia(conferenciaId)

  return data
}

export async function recalcularConferencia(conferenciaId) {
  const itens = await listarItensConferencia(conferenciaId)

  const totalEncontrado = itens.filter(
    (item) => item.status_conferencia === 'ENCONTRADO'
  ).length

  const totalDivergencia = itens.filter(
    (item) => item.status_conferencia === 'DIVERGENTE'
  ).length

  const { data, error } = await supabase
    .from(CONFERENCIAS_TABLE)
    .update({
      total_encontrado: totalEncontrado,
      total_divergencia: totalDivergencia,
      updated_at: new Date().toISOString()
    })
    .eq('id', conferenciaId)
    .select('*')
    .single()

  if (error) {
    throw new Error(
      error.message || 'Não foi possível atualizar a conferência.'
    )
  }

  return data
}

export async function finalizarConferencia({
  conferenciaId,
  observacao = ''
}) {
  if (!conferenciaId) {
    throw new Error('Conferência não identificada.')
  }

  const itens = await listarItensConferencia(conferenciaId)

  const pendentes = itens.filter(
    (item) => item.status_conferencia === 'PENDENTE'
  )

  if (pendentes.length > 0) {
    const idsPendentes = pendentes.map((item) => item.id)

    const { error: pendentesError } = await supabase
      .from(CONFERENCIAS_ITENS_TABLE)
      .update({
        status_conferencia: 'DIVERGENTE',
        tipo_divergencia: 'NÃO LOCALIZADO'
      })
      .in('id', idsPendentes)

    if (pendentesError) {
      throw new Error(
        pendentesError.message ||
          'Não foi possível finalizar os itens pendentes.'
      )
    }
  }

  await recalcularConferencia(conferenciaId)

  const { data, error } = await supabase
    .from(CONFERENCIAS_TABLE)
    .update({
      status: 'FINALIZADA',
      finalizada_em: new Date().toISOString(),
      observacao_final: textoUpper(observacao) || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', conferenciaId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Não foi possível finalizar a conferência.')
  }

  return data
}

export async function listarDivergenciasAbertas() {
  const { data, error } = await supabase
    .from(CONFERENCIAS_ITENS_TABLE)
    .select(`
      *,
      conferencia:sigmo_conferencias (
        id,
        nome,
        categoria,
        status,
        created_at,
        finalizada_em
      )
    `)
    .eq('status_conferencia', 'DIVERGENTE')
    .order('updated_at', { ascending: false })

  if (error) {
    if (erroTabelaInexistente(error)) {
      return []
    }

    throw new Error(
      error.message || 'Não foi possível consultar as divergências.'
    )
  }

  return data ?? []
}

export async function listarConferencias({
  categoria = '',
  status = '',
  limite = 30
} = {}) {
  let query = supabase
    .from(CONFERENCIAS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (texto(categoria)) {
    query = query.eq('categoria', textoUpper(categoria))
  }

  if (texto(status)) {
    query = query.eq('status', textoUpper(status))
  }

  const { data, error } = await query

  if (error) {
    if (erroTabelaInexistente(error)) {
      return []
    }

    throw new Error(
      error.message || 'Não foi possível consultar as conferências.'
    )
  }

  return data ?? []
}