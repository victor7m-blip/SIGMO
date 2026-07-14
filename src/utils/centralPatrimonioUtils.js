export function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function texto(
  valor,
  fallback = 'Não informado'
) {
  const resultado = String(valor ?? '').trim()

  return resultado || fallback
}

export function numero(valor) {
  return new Intl.NumberFormat('pt-BR').format(
    Number(valor) || 0
  )
}

export function dataHora(valor) {
  if (!valor) {
    return 'Não informado'
  }

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return texto(valor)
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

export function obterDadosPatrimonio(
  patrimonio
) {
  const dados = patrimonio?.dados

  if (!dados) {
    return {}
  }

  if (
    typeof dados === 'object' &&
    !Array.isArray(dados)
  ) {
    return dados
  }

  try {
    return JSON.parse(dados)
  } catch {
    return {}
  }
}

export function buscarValor(
  objeto,
  campos = []
) {
  if (
    !objeto ||
    typeof objeto !== 'object'
  ) {
    return ''
  }

  for (const campo of campos) {
    const valor = objeto[campo]

    if (
      valor !== null &&
      valor !== undefined &&
      String(valor).trim()
    ) {
      return String(valor).trim()
    }
  }

  return ''
}

export function obterIdentificadorPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  const tipo = normalizarTexto(
    patrimonio?.tipo
  )

  const camposGerais = [
    'patrimonio',
    'numero_patrimonio',
    'numero',
    'codigo',
    'prefixo',
    'numero_serie',
    'serie',
    'serial',
    'registro'
  ]

  const camposArma = [
    'patrimonio',
    'numero_patrimonio',
    'numero_arma',
    'numero',
    'registro',
    'registro_arma',
    'sigma',
    'sinarm',
    'numero_serie',
    'serie',
    'serial',
    'codigo'
  ]

  const identificador = buscarValor(
    dados,
    tipo === 'arma' || tipo === 'armas'
      ? camposArma
      : camposGerais
  )

  if (identificador) {
    return identificador
  }

  return `${nomeCategoria(
    patrimonio?.tipo
  )} sem identificação`
}

export function obterDescricaoPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  const tipo = normalizarTexto(
    patrimonio?.tipo
  )

  if (
    tipo === 'arma' ||
    tipo === 'armas'
  ) {
    const marca = buscarValor(
      dados,
      ['marca', 'fabricante']
    )

    const modelo = buscarValor(
      dados,
      ['modelo', 'modelo_arma']
    )

    const calibre = buscarValor(
      dados,
      ['calibre']
    )

    return (
      [
        marca,
        modelo,
        calibre
          ? `Calibre ${calibre}`
          : ''
      ]
        .filter(Boolean)
        .join(' • ') ||
      'Arma'
    )
  }

  return texto(
    buscarValor(
      dados,
      [
        'descricao',
        'nome',
        'modelo',
        'categoria',
        'tipo_material'
      ]
    ),
    nomeCategoria(patrimonio?.tipo)
  )
}

export function obterResponsavelPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return texto(
    buscarValor(
      dados,
      [
        'responsavel_nome',
        'nome_responsavel',
        'recebedor_nome',
        'policial_nome',
        'cautelado_para',
        'nome_policial',
        'nome_recebedor'
      ]
    ) ||
      patrimonio?.responsavel_nome,
    'Reserva / sem responsável'
  )
}

export function obterReResponsavelPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return texto(
    buscarValor(
      dados,
      [
        'responsavel_re',
        're_responsavel',
        'recebedor_re',
        'policial_re',
        're_policial',
        're_recebedor'
      ]
    ) ||
      patrimonio?.responsavel_re,
    ''
  )
}

export function obterLocalPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return texto(
    patrimonio?.local_atual ||
      buscarValor(
        dados,
        [
          'local_atual',
          'local',
          'unidade',
          'setor'
        ]
      ),
    'Local não informado'
  )
}

export function obterStatusPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return texto(
    patrimonio?.status ||
      dados.status,
    'SEM STATUS'
  ).toUpperCase()
}

export function obterFotosPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  const candidatos = [
    dados.fotos,
    dados.imagens,
    dados.foto_urls,
    dados.urls_fotos
  ]

  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) {
      return candidato
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }

          return (
            item?.url ||
            item?.public_url ||
            item?.foto_url ||
            item?.imagem_url ||
            ''
          )
        })
        .filter(Boolean)
    }
  }

  return [
    dados.foto_url,
    dados.imagem_url,
    dados.url_foto,
    dados.foto
  ].filter(Boolean)
}

export function obterQrCodePatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return (
    dados.qr_code_url ||
    dados.qrcode_url ||
    dados.qr_url ||
    dados.qr_code ||
    patrimonio?.qr_code_url ||
    ''
  )
}

export function possuiResponsavel(
  patrimonio
) {
  return Boolean(
    obterReResponsavelPatrimonio(
      patrimonio
    ) ||
      obterResponsavelPatrimonio(
        patrimonio
      ) !==
        'Reserva / sem responsável'
  )
}

export function possuiDivergencia(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  const status = normalizarTexto(
    obterStatusPatrimonio(patrimonio)
  )

  return Boolean(
    dados.divergencia === true ||
      dados.possui_divergencia === true ||
      dados.conferencia_divergente === true ||
      status.includes('diverg')
  )
}

export function classeStatusPatrimonio(
  status
) {
  const valor = normalizarTexto(status)

  if (
    valor.includes('baix') ||
    valor.includes('inativ')
  ) {
    return 'central-status-baixado'
  }

  if (
    valor.includes('cautel') ||
    valor.includes('policial')
  ) {
    return 'central-status-cautelado'
  }

  if (
    valor.includes('recolh') ||
    valor.includes('manut')
  ) {
    return 'central-status-recolhido'
  }

  if (
    valor.includes('diverg') ||
    valor.includes('pendente')
  ) {
    return 'central-status-divergencia'
  }

  return 'central-status-ativo'
}

export function nomeCategoria(tipo) {
  const nomes = {
    material: 'Materiais',
    materiais: 'Materiais',
    arma: 'Armas',
    armas: 'Armas',
    municao: 'Munições',
    municoes: 'Munições',
    policial: 'Policiais',
    policiais: 'Policiais',
    ht: 'HT',
    tpd: 'TPD',
    colete: 'Coletes',
    coletes: 'Coletes',
    taser: 'Taser',
    viatura: 'Viaturas',
    viaturas: 'Viaturas',
    epi: 'EPI',
    fardamento: 'Fardamento'
  }

  const chave = normalizarTexto(tipo)

  return (
    nomes[chave] ||
    texto(tipo, 'Outros')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letra) =>
        letra.toUpperCase()
      )
  )
}

export function criarTextoPesquisa(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return normalizarTexto(
    [
      obterIdentificadorPatrimonio(
        patrimonio
      ),
      obterDescricaoPatrimonio(
        patrimonio
      ),
      obterResponsavelPatrimonio(
        patrimonio
      ),
      obterReResponsavelPatrimonio(
        patrimonio
      ),
      obterLocalPatrimonio(
        patrimonio
      ),
      obterStatusPatrimonio(
        patrimonio
      ),
      dados.marca,
      dados.modelo,
      dados.numero_serie,
      dados.serie,
      dados.categoria,
      dados.calibre,
      dados.registro,
      dados.sigma,
      dados.sinarm
    ].join(' ')
  )
}