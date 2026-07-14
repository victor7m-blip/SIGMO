const STORAGE_KEY =
  'sigmo_conferencia_operacional'

function criarId() {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function lerStorage() {
  try {
    const valor =
      localStorage.getItem(STORAGE_KEY)

    if (!valor) {
      return []
    }

    const dados = JSON.parse(valor)

    return Array.isArray(dados)
      ? dados
      : []
  } catch {
    return []
  }
}

function salvarStorage(conferencias) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(conferencias)
  )
}

export function listarConferencias() {
  return lerStorage()
}

export function obterConferenciaAtiva() {
  return (
    lerStorage().find(
      (item) =>
        item.status === 'EM_ANDAMENTO'
    ) || null
  )
}

export function iniciarConferencia({
  categoria = '',
  local = '',
  usuario = null,
  patrimoniosEsperados = []
} = {}) {
  const conferencias = lerStorage()

  const conferencia = {
    id: criarId(),
    categoria,
    local,
    status: 'EM_ANDAMENTO',

    iniciado_em:
      new Date().toISOString(),

    finalizado_em: null,

    iniciado_por:
      usuario?.nome ||
      usuario?.email ||
      usuario?.re ||
      'Usuário SIGMO',

    esperado_ids:
      patrimoniosEsperados
        .map(
          (item) =>
            item.id ||
            item.referencia_id
        )
        .filter(Boolean),

    leituras: []
  }

  conferencias.unshift(conferencia)

  salvarStorage(conferencias)

  return conferencia
}

export function registrarLeituraConferencia({
  conferenciaId,
  patrimonio,
  codigoLido = ''
}) {
  const conferencias = lerStorage()

  const indice = conferencias.findIndex(
    (item) =>
      item.id === conferenciaId
  )

  if (indice < 0) {
    throw new Error(
      'Conferência não encontrada.'
    )
  }

  const conferencia =
    conferencias[indice]

  if (
    conferencia.status !==
    'EM_ANDAMENTO'
  ) {
    throw new Error(
      'Esta conferência já foi finalizada.'
    )
  }

  const patrimonioId =
    patrimonio?.id ||
    patrimonio?.referencia_id ||
    codigoLido

  const leituraExistente =
    conferencia.leituras.find(
      (item) =>
        String(item.patrimonio_id) ===
        String(patrimonioId)
    )

  if (leituraExistente) {
    return {
      conferencia,
      duplicada: true,
      leitura: leituraExistente
    }
  }

  const esperado =
    conferencia.esperado_ids.length ===
      0 ||
    conferencia.esperado_ids.some(
      (id) =>
        String(id) ===
        String(patrimonioId)
    )

  const leitura = {
    id: criarId(),

    patrimonio_id:
      patrimonioId,

    referencia_id:
      patrimonio?.referencia_id ||
      null,

    tipo:
      patrimonio?.tipo ||
      '',

    codigo_lido:
      codigoLido,

    esperado,

    lido_em:
      new Date().toISOString()
  }

  conferencia.leituras.push(leitura)

  conferencias[indice] =
    conferencia

  salvarStorage(conferencias)

  return {
    conferencia,
    duplicada: false,
    leitura
  }
}

export function finalizarConferencia(
  conferenciaId
) {
  const conferencias = lerStorage()

  const indice = conferencias.findIndex(
    (item) =>
      item.id === conferenciaId
  )

  if (indice < 0) {
    throw new Error(
      'Conferência não encontrada.'
    )
  }

  const conferencia =
    conferencias[indice]

  conferencia.status = 'FINALIZADA'

  conferencia.finalizado_em =
    new Date().toISOString()

  conferencias[indice] =
    conferencia

  salvarStorage(conferencias)

  return montarResumoConferencia(
    conferencia
  )
}

export function cancelarConferencia(
  conferenciaId
) {
  const conferencias = lerStorage()

  const indice = conferencias.findIndex(
    (item) =>
      item.id === conferenciaId
  )

  if (indice < 0) {
    return null
  }

  conferencias[indice] = {
    ...conferencias[indice],

    status: 'CANCELADA',

    finalizado_em:
      new Date().toISOString()
  }

  salvarStorage(conferencias)

  return conferencias[indice]
}

export function montarResumoConferencia(
  conferencia
) {
  if (!conferencia) {
    return {
      totalEsperado: 0,
      encontrados: 0,
      ausentes: 0,
      excedentes: 0,
      percentual: 0
    }
  }

  const esperados =
    conferencia.esperado_ids || []

  const leituras =
    conferencia.leituras || []

  const encontrados =
    leituras.filter(
      (item) => item.esperado
    ).length

  const excedentes =
    leituras.filter(
      (item) => !item.esperado
    ).length

  const ausentes =
    Math.max(
      esperados.length -
        encontrados,
      0
    )

  const percentual =
    esperados.length > 0
      ? Math.round(
          (
            encontrados /
            esperados.length
          ) * 100
        )
      : leituras.length > 0
        ? 100
        : 0

  return {
    totalEsperado:
      esperados.length,

    encontrados,
    ausentes,
    excedentes,
    percentual,

    totalLeituras:
      leituras.length,

    conferencia
  }
}

export function excluirConferencia(
  conferenciaId
) {
  const conferencias = lerStorage().filter(
    (item) =>
      item.id !== conferenciaId
  )

  salvarStorage(conferencias)

  return conferencias
}