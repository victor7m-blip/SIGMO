import { supabase } from './supabaseClient'

import {
  buscarMovimentacaoPorId,
  confirmarRecebimentoMovimentacao,
  listarMinhaCautela,
  listarMovimentacoes
} from './movimentacoesService'

import {
  criarMovimentacaoCompleta
} from './movimentacaoEngine'

import {
  cautelarTonfaParaPolicial,
  devolverTonfaDoPolicialAoSvdd
} from './tonfasService'

import {
  listarTonfasEmServico
} from './tonfasMovimentacoesService'

import {
  registrarManutencao,
  MODULOS_MANUTENCAO
} from './manutencoesService'

import {
  criarNotificacaoParaPerfil
} from './notificacoesService'

const NOVIDADES_FOTOS_BUCKET = 'novidades-fotos'
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024

function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}


function normalizarMaiusculo(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
}

function ehArquivo(valor) {
  return (
    valor &&
    typeof valor === 'object' &&
    typeof valor.arrayBuffer === 'function' &&
    typeof valor.name === 'string'
  )
}

function extensaoArquivo(arquivo) {
  const nome = String(arquivo?.name ?? '')
  const partes = nome.split('.')

  if (partes.length > 1) {
    return (
      partes
        .pop()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') ||
      'jpg'
    )
  }

  const tipo = String(arquivo?.type ?? '').toLowerCase()

  if (tipo.includes('png')) return 'png'
  if (tipo.includes('webp')) return 'webp'
  if (tipo.includes('gif')) return 'gif'

  return 'jpg'
}

function gerarIdentificador() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function nomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function lerObjetoObservacao(valor) {
  if (!valor) return {}

  if (typeof valor === 'object') {
    return valor
  }

  try {
    return JSON.parse(valor)
  } catch {
    return {
      texto_original: String(valor)
    }
  }
}

async function prepararNovidadeRecebimento({
  novidade,
  user
}) {
  if (
    !novidade ||
    typeof novidade !== 'object'
  ) {
    return null
  }

  const tipo = normalizarMaiusculo(
    novidade.tipo
  )

  const descricao = normalizarMaiusculo(
    novidade.descricao
  )

  const possuiFotos =
    Array.isArray(novidade.fotos) &&
    novidade.fotos.length > 0

  if (!tipo && !descricao && !possuiFotos) {
    return null
  }

  if (!tipo) {
    throw new Error(
      'Selecione o tipo da novidade.'
    )
  }

  if (!descricao) {
    throw new Error(
      'Descreva a novidade registrada.'
    )
  }

  const arquivos = (
    Array.isArray(novidade.fotos)
      ? novidade.fotos
      : []
  ).filter(ehArquivo)

  const fotosEnviadas = []

  if (arquivos.length > 0) {
    const data = new Date()
      .toISOString()
      .slice(0, 10)

    const usuario = String(
      user?.id || 'usuario-sem-id'
    ).replace(/[^a-zA-Z0-9_-]/g, '-')

    const lote = gerarIdentificador()

    for (
      let indice = 0;
      indice < arquivos.length;
      indice += 1
    ) {
      const arquivo = arquivos[indice]

      if (
        arquivo.type &&
        !String(arquivo.type)
          .toLowerCase()
          .startsWith('image/')
      ) {
        throw new Error(
          `O arquivo "${arquivo.name}" não é uma imagem válida.`
        )
      }

      if (
        Number(arquivo.size || 0) >
        TAMANHO_MAXIMO_FOTO
      ) {
        throw new Error(
          `A foto "${arquivo.name}" ultrapassa o limite de 5 MB.`
        )
      }

      const extensao = extensaoArquivo(
        arquivo
      )

      const caminho = [
        data,
        usuario,
        'recebimento-usuario',
        lote,
        `${String(indice + 1).padStart(2, '0')}-${gerarIdentificador()}.${extensao}`
      ].join('/')

      const { error } =
        await supabase.storage
          .from(NOVIDADES_FOTOS_BUCKET)
          .upload(caminho, arquivo, {
            cacheControl: '3600',
            contentType:
              arquivo.type || 'image/jpeg',
            upsert: false
          })

      if (error) {
        throw new Error(
          `Não foi possível enviar a foto "${arquivo.name}": ${error.message}`
        )
      }

      const { data: urlData } =
        supabase.storage
          .from(NOVIDADES_FOTOS_BUCKET)
          .getPublicUrl(caminho)

      fotosEnviadas.push({
        url: urlData?.publicUrl || null,
        caminho,
        bucket: NOVIDADES_FOTOS_BUCKET,
        nome_original: arquivo.name,
        tipo: arquivo.type || null,
        tamanho: Number(arquivo.size || 0),
        ordem: indice + 1,
        principal: indice === 0
      })
    }
  }

  return {
    tipo,
    descricao,
    providencia:
      normalizarMaiusculo(
        novidade.providencia || 'ANALISE'
      ),
    quantidade_afetada:
      Math.max(
        1,
        Number(
          novidade.quantidade_afetada || 1
        ) || 1
      ),
    status: 'PENDENTE',
    origem: 'RECEBIMENTO PELO USUÁRIO',
    registrada_em:
      new Date().toISOString(),
    registrada_por_id:
      user?.id || null,
    registrada_por_nome:
      normalizarMaiusculo(
        nomeUsuario(user)
      ),
    fotos: fotosEnviadas,
    foto:
      fotosEnviadas[0]?.url || null,
    quantidade_fotos:
      fotosEnviadas.length
  }
}



function obterTipoPatrimonioNovidade({
  patrimonio,
  item,
  observacao
}) {
  const candidatos = [
    observacao?.categoria,
    observacao?.tipo_material,
    item?.categoria,
    item?.tipo_patrimonio,
    patrimonio?.tipo
  ]

  for (const candidato of candidatos) {
    const valor =
      normalizarMaiusculo(candidato)

    if (valor) {
      if (
        valor === 'TONFA' &&
        normalizarMaiusculo(
          patrimonio?.descricao
        ).includes('CASSETETE')
      ) {
        return 'CASSETETE'
      }

      return valor
    }
  }

  const descricao =
    normalizarMaiusculo(
      patrimonio?.descricao ||
      item?.descricao
    )

  if (descricao.includes('CASSETETE')) {
    return 'CASSETETE'
  }

  if (descricao.includes('TONFA')) {
    return 'TONFA'
  }

  return 'MATERIAL'
}

function montarDescricaoNovidadeOficial({
  novidade,
  tipoPatrimonio,
  quantidadeRecebida = 1
}) {
  const partes = [
    novidade?.descricao
  ]

  if (
    ['TONFA', 'CASSETETE'].includes(
      tipoPatrimonio
    )
  ) {
    partes.push(
      `QUANTIDADE AFETADA: ${
        Math.max(
          1,
          Math.min(
            Number(
              novidade?.quantidade_afetada ||
              1
            ) || 1,
            Math.max(
              1,
              Number(
                quantidadeRecebida
              ) || 1
            )
          )
        )
      }`
    )
  }

  if (novidade?.providencia) {
    partes.push(
      `PROVIDÊNCIA SUGERIDA: ${
        normalizarMaiusculo(
          novidade.providencia
        )
      }`
    )
  }

  if (
    Array.isArray(novidade?.fotos) &&
    novidade.fotos.length > 0
  ) {
    partes.push(
      `FOTOS ANEXADAS: ${
        novidade.fotos.length
      }`
    )
  }

  return partes
    .filter(Boolean)
    .join(' | ')
}

async function registrarFotosNovidadeOficial({
  novidadeId,
  novidade
}) {
  if (
    !novidadeId ||
    !Array.isArray(novidade?.fotos) ||
    novidade.fotos.length === 0
  ) {
    return []
  }

  const registros =
    novidade.fotos
      .filter((foto) => foto?.url)
      .map((foto, indice) => ({
        novidade_id:
          novidadeId,

        foto_url:
          foto.url,

        foto_caminho:
          foto.caminho ||
          null,

        nome_original:
          foto.nome_original ||
          null,

        tipo_arquivo:
          foto.tipo ||
          null,

        tamanho_bytes:
          Number(
            foto.tamanho ||
            0
          ) || null,

        principal:
          foto.principal === true ||
          indice === 0,

        ordem:
          Number(
            foto.ordem ||
            indice + 1
          ) || indice + 1
      }))

  if (registros.length === 0) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from(
      'sigmo_patrimonio_novidades_fotos'
    )
    .insert(registros)
    .select()

  if (error) {
    throw new Error(
      `A novidade foi registrada, mas não foi possível vincular as fotos: ${error.message}`
    )
  }

  return data || []
}

async function registrarNovidadeOficial({
  patrimonio,
  item,
  observacao,
  novidade,
  quantidadeRecebida = 1,
  user
}) {
  if (
    !patrimonio?.id ||
    !novidade
  ) {
    return null
  }

  const tipoPatrimonio =
    obterTipoPatrimonioNovidade({
      patrimonio,
      item,
      observacao
    })

  const titulo =
    normalizarMaiusculo(
      novidade.tipo ||
      'NOVIDADE NO RECEBIMENTO'
    )

  const descricao =
    montarDescricaoNovidadeOficial({
      novidade,
      tipoPatrimonio,
      quantidadeRecebida
    })

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_registrar_patrimonio_novidade',
    {
      p_patrimonio_id:
        patrimonio.id,

      p_tipo_patrimonio:
        tipoPatrimonio,

      p_titulo:
        titulo,

      p_descricao:
        descricao || null,

      p_gravidade:
        'baixa',

      p_registrado_por_id:
        user?.id ||
        obterPolicialId(user) ||
        null,

      p_registrado_por_nome:
        normalizarMaiusculo(
          nomeUsuario(user)
        ) || null
    }
  )

  if (error) {
    throw new Error(
      `Não foi possível registrar a novidade patrimonial: ${error.message}`
    )
  }

  const novidadeId =
    Array.isArray(data)
      ? (
          data[0]?.id ||
          data[0]?.sigmo_registrar_patrimonio_novidade ||
          data[0] ||
          null
        )
      : (
          data?.id ||
          data?.sigmo_registrar_patrimonio_novidade ||
          data ||
          null
        )

  if (!novidadeId) {
    return null
  }

  const fotos =
    await registrarFotosNovidadeOficial({
      novidadeId,
      novidade
    })

  return {
    id: novidadeId,
    patrimonio_id:
      patrimonio.id,
    tipo_patrimonio:
      tipoPatrimonio,
    titulo,
    status:
      'registrada',
    fotos
  }
}

async function notificarNovidadePatrimonial({
  novidadeOficial,
  novidade,
  patrimonio,
  item,
  user
}) {
  if (!novidadeOficial?.id || !patrimonio?.id || !novidade) {
    return []
  }

  const tipoPatrimonio =
    novidadeOficial?.tipo_patrimonio ||
    obterTipoPatrimonioNovidade({
      patrimonio,
      item,
      observacao:
        lerObjetoObservacao(
          item?.observacao
        )
    })

  const descricaoMaterial =
    normalizarMaiusculo(
      patrimonio?.descricao ||
      item?.descricao ||
      tipoPatrimonio ||
      'MATERIAL'
    )

  const tipoNovidade =
    normalizarMaiusculo(
      novidade?.tipo ||
      novidadeOficial?.titulo ||
      'NOVIDADE'
    )

  const providencia =
    normalizarMaiusculo(
      novidade?.providencia ||
      'ANALISE'
    )

  const descricao =
    normalizarMaiusculo(
      novidade?.descricao
    )

  const policialNome =
    normalizarMaiusculo(
      nomeUsuario(user)
    )

  const policialRe =
    obterRePolicial(user)

  const mensagem = [
    `${policialNome}${policialRe ? ` (RE ${policialRe})` : ''} registrou uma novidade em ${descricaoMaterial}.`,
    `TIPO: ${tipoNovidade}.`,
    descricao
      ? `DESCRIÇÃO: ${descricao}.`
      : '',
    `PROVIDÊNCIA SUGERIDA: ${providencia}.`,
    'O material pode permanecer com o usuário até avaliação do setor responsável.'
  ]
    .filter(Boolean)
    .join(' ')

  const payloadBase = {
    titulo:
      'NOVIDADE PATRIMONIAL REGISTRADA',
    mensagem,
    tipo: 'ALERTA',
    modulo: 'PATRIMONIO',
    prioridade: 'ALTA',
    link: '/central-operacional',
    metadata: {
      origem:
        'RECEBIMENTO PELO USUÁRIO',
      novidade_id:
        novidadeOficial.id,
      patrimonio_id:
        patrimonio.id,
      referencia_id:
        patrimonio?.referencia_id ||
        null,
      tipo_patrimonio:
        tipoPatrimonio,
      tipo_novidade:
        tipoNovidade,
      providencia,
      descricao,
      policial_id:
        obterPolicialId(user),
      policial_re:
        policialRe || null,
      policial_nome:
        policialNome
    }
  }

  return Promise.all([
    criarNotificacaoParaPerfil({
      perfil:
        'ENCARREGADO DO SVDD',
      ...payloadBase
    }),
    criarNotificacaoParaPerfil({
      perfil: 'P4',
      ...payloadBase
    })
  ])
}

function novidadeSolicitaManutencao(novidade) {
  return (
    normalizarMaiusculo(
      novidade?.providencia ||
      novidade?.destino
    ) === 'MANUTENCAO'
  )
}

function obterModuloManutencao(tipoPatrimonio) {
  const tipo =
    normalizarMaiusculo(tipoPatrimonio)

  if (tipo === 'ARMA' || tipo === 'ARMAS') {
    return MODULOS_MANUTENCAO.ARMAS
  }

  if (
    tipo === 'TONFA' ||
    tipo === 'TONFAS' ||
    tipo === 'CASSETETE' ||
    tipo === 'CASSETETES'
  ) {
    return MODULOS_MANUTENCAO.TONFAS
  }

  if (tipo === 'HT' || tipo === 'HTS') {
    return MODULOS_MANUTENCAO.HT
  }

  if (tipo === 'TPD' || tipo === 'TPDS') {
    return MODULOS_MANUTENCAO.TPD
  }

  if (tipo === 'TASER' || tipo === 'TASERS') {
    return MODULOS_MANUTENCAO.TASER
  }

  if (tipo === 'COLETE' || tipo === 'COLETES') {
    return MODULOS_MANUTENCAO.COLETE
  }

  if (
    tipo === 'MUNICAO' ||
    tipo === 'MUNICOES' ||
    tipo === 'MUNIÇÃO' ||
    tipo === 'MUNIÇÕES'
  ) {
    return MODULOS_MANUTENCAO.MUNICAO
  }

  return MODULOS_MANUTENCAO.OUTROS
}

function obterArquivosNovidadeOriginal(novidade) {
  if (!novidade || typeof novidade !== 'object') {
    return []
  }

  return [
    ...(Array.isArray(novidade.fotos)
      ? novidade.fotos
      : []),
    ...(novidade.foto
      ? [novidade.foto]
      : [])
  ].filter(ehArquivo)
}

function obterRePolicial(user) {
  return String(
    user?.re ||
    user?.policial_re ||
    user?.matricula ||
    ''
  )
    .replace(/\D/g, '')
    .slice(0, 6)
}

function obterPolicialId(user) {
  return (
    user?.policial_id ||
    user?.id_policial ||
    user?.id ||
    null
  )
}

function ehCargaPermanente(item) {
  const dados =
    lerObjetoObservacao(
      item?.dados
    )

  const status =
    normalizarMaiusculo(
      item?.status ||
      item?.status_operacional ||
      dados?.status ||
      dados?.status_operacional
    )

  const local =
    normalizarMaiusculo(
      item?.local_atual ||
      dados?.local_atual
    )

  return (
    status === 'CARGA' ||
    local === 'CARGA PERMANENTE'
  )
}

function ehCautela(movimentacao) {
  return normalizar(
    movimentacao?.tipo_movimentacao ||
    movimentacao?.tipo
  ) === 'cautela'
}

function ehDevolucao(movimentacao) {
  return normalizar(
    movimentacao?.tipo_movimentacao ||
    movimentacao?.tipo
  ) === 'devolucao'
}

function statusEh(movimentacao, ...status) {
  const atual = normalizar(
    movimentacao?.status
  ).replace(/\s+/g, '_')

  return status
    .map((item) =>
      normalizar(item)
        .replace(/\s+/g, '_')
    )
    .includes(atual)
}

async function carregarDetalhes(movimentacoes) {
  const resultados = []

  for (const movimentacao of movimentacoes) {
    try {
      const detalhe =
        await buscarMovimentacaoPorId(
          movimentacao.id
        )

      resultados.push(
        detalhe || movimentacao
      )
    } catch (error) {
      console.warn(
        'Não foi possível carregar os itens da cautela:',
        error
      )

      resultados.push(movimentacao)
    }
  }

  return resultados
}

export async function listarCautelasAguardandoUsuario(
  user
) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  const {
    data: movimentacoes,
    error
  } = await supabase
    .from('sigmo_movimentacoes')
    .select('*')
    .eq('recebedor_id', policialId)
    .in(
      'tipo_movimentacao',
      ['CAUTELA', 'ENTREGA']
    )
    .eq('status', 'aguardando_recebimento')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return carregarDetalhes(movimentacoes || [])
}

export async function listarMateriaisEmServicoUsuario(
  user
) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  const policialRe = obterRePolicial(user)

  const [
    patrimoniosIndividuais,
    quantitativosEmServico
  ] = await Promise.all([
    listarMinhaCautela(policialId),
    listarTonfasEmServico({
      re: policialRe,
      policialId
    })
  ])

  // Tonfa e Cassetete usam um patrimônio agregado por estoque.
  // Esse registro central não deve ser usado como se fosse um item
  // individual da cautela, porque a responsabilidade real está em
  // sigmo_tonfas_movimentacoes.
  const individuais = (patrimoniosIndividuais || []).filter(
    (item) =>
      normalizar(item?.tipo) !== 'tonfa' &&
      !ehCargaPermanente(item)
  )

  const quantitativosAtivos =
    (quantitativosEmServico || []).filter(
      (item) => Number(item?.saldo ?? item?.quantidade ?? 0) > 0
    )

  if (quantitativosAtivos.length === 0) {
    return individuais
  }

  const tonfaIds = [
    ...new Set(
      quantitativosAtivos
        .map((item) => item?.tonfa_id || item?.referencia_id)
        .filter(Boolean)
        .map(String)
    )
  ]

  let patrimoniosQuantitativos = []

  if (tonfaIds.length > 0) {
    const {
      data,
      error
    } = await supabase
      .from('sigmo_patrimonios')
      .select('id, tipo, referencia_id, descricao, ativo')
      .eq('tipo', 'tonfa')
      .eq('ativo', true)
      .in('referencia_id', tonfaIds)

    if (error) {
      throw error
    }

    patrimoniosQuantitativos = data || []
  }

  const patrimonioPorReferencia = new Map(
    patrimoniosQuantitativos.map((patrimonio) => [
      String(patrimonio.referencia_id),
      patrimonio
    ])
  )

  const quantitativos = quantitativosAtivos
    .map((item) => {
      const tonfaId =
        item?.tonfa_id ||
        item?.referencia_id ||
        null

      const patrimonio = patrimonioPorReferencia.get(
        String(tonfaId || '')
      )

      if (!patrimonio?.id) {
        console.warn(
          'Cautela quantitativa sem patrimônio central correspondente:',
          item
        )
        return null
      }

      return {
        ...item,
        patrimonio_id: patrimonio.id,
        referencia_id: tonfaId,
        descricao:
          item?.descricao ||
          patrimonio?.descricao ||
          item?.tipo ||
          item?.categoria ||
          'TONFA/CASSETETE',
        quantidade: Number(
          item?.saldo ??
          item?.quantidade ??
          1
        ) || 1
      }
    })
    .filter(Boolean)

  return [
    ...individuais,
    ...quantitativos
  ]
}

export async function listarDevolucoesPendentesUsuario(
  user
) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    return []
  }

  const movimentacoes =
    await listarMovimentacoes({
      solicitante_id: policialId
    })

  return carregarDetalhes(
    movimentacoes.filter(
      (movimentacao) =>
        ehDevolucao(movimentacao) &&
        statusEh(
          movimentacao,
          'aguardando_aprovacao',
          'aguardando_recebimento',
          'em_andamento'
        )
    )
  )
}


async function sincronizarCargaPermanenteRecebida({
  movimentacao,
  patrimoniosPorId,
  policial
}) {
  const individuais =
    (movimentacao?.itens || [])
      .map((item) =>
        patrimoniosPorId.get(
          String(item?.patrimonio_id)
        )
      )
      .filter(Boolean)
      .filter(
        (patrimonio) =>
          normalizar(patrimonio?.tipo) !== 'tonfa'
      )

  for (const patrimonio of individuais) {
    const dadosAtuais =
      lerObjetoObservacao(
        patrimonio?.dados
      )

    const rePolicial =
      policial?.re ||
      policial?.policial_re ||
      null

    const nomePolicial =
      nomeUsuario(policial)

    const { error } = await supabase
      .from('sigmo_patrimonios')
      .update({
        status: 'CARGA',
        local_atual: 'CARGA PERMANENTE',
        responsavel_atual_id:
          policial?.id || null,
        responsavel_atual_nome:
          nomePolicial,
        dados: {
          ...dadosAtuais,
          status: 'CARGA',
          status_operacional: 'CARGA',
          local_atual:
            'CARGA PERMANENTE',
          carga_policial_id:
            policial?.id || null,
          carga_policial_re:
            rePolicial,
          carga_policial_nome:
            nomePolicial,
          guardiao_atual: {
            tipo: 'POLICIAL',
            id:
              policial?.id || null,
            re:
              rePolicial,
            nome:
              nomePolicial
          }
        }
      })
      .eq('id', patrimonio.id)

    if (error) {
      throw error
    }

    if (
      normalizar(patrimonio?.tipo) === 'arma' &&
      patrimonio?.referencia_id
    ) {
      const {
        error: armaError
      } = await supabase
        .from('sigmo_armas')
        .update({
          status: 'CARGA',
          local_atual:
            'CARGA PERMANENTE',
          carga_policial_id:
            policial?.id || null,
          carga_policial_re:
            rePolicial,
          carga_policial_nome:
            nomePolicial
        })
        .eq(
          'id',
          patrimonio.referencia_id
        )

      if (armaError) {
        throw armaError
      }
    }
  }
}

async function sincronizarCautelaIndividualRecebida({
  movimentacao,
  patrimoniosPorId,
  policial
}) {
  const individuais =
    (movimentacao?.itens || [])
      .map((item) =>
        patrimoniosPorId.get(
          String(item?.patrimonio_id)
        )
      )
      .filter(Boolean)
      .filter(
        (patrimonio) =>
          normalizar(patrimonio?.tipo) !== 'tonfa'
      )

  for (const patrimonio of individuais) {
    const dadosAtuais =
      lerObjetoObservacao(
        patrimonio?.dados
      )

    const { error } = await supabase
      .from('sigmo_patrimonios')
      .update({
        status: 'CAUTELADO',
        local_atual: 'CAUTELA INDIVIDUAL',
        responsavel_atual_id:
          policial?.id || null,
        responsavel_atual_nome:
          nomeUsuario(policial),
        dados: {
          ...dadosAtuais,
          carga_policial_re:
            policial?.re ||
            policial?.policial_re ||
            null,
          carga_policial_nome:
            nomeUsuario(policial),
          guardiao_atual: {
            tipo: 'POLICIAL',
            id:
              policial?.id || null,
            re:
              policial?.re ||
              policial?.policial_re ||
              null,
            nome:
              nomeUsuario(policial)
          }
        }
      })
      .eq('id', patrimonio.id)

    if (error) {
      throw error
    }

    if (
      normalizar(patrimonio?.tipo) === 'arma' &&
      patrimonio?.referencia_id
    ) {
      const rePolicial =
        policial?.re ||
        policial?.policial_re ||
        null

      const nomePolicial =
        nomeUsuario(policial)

      const {
        error: armaError
      } = await supabase
        .from('sigmo_armas')
        .update({
          status: 'CAUTELADO',
          local_atual:
            'CAUTELA INDIVIDUAL',
          carga_policial_id:
            policial?.id || null,
          carga_policial_re:
            rePolicial,
          carga_policial_nome:
            nomePolicial
        })
        .eq(
          'id',
          patrimonio.referencia_id
        )

      if (armaError) {
        throw armaError
      }
    }
  }
}

export async function confirmarRecebimentoCautela({
  movimentacaoId,
  itens = [],
  user
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Cautela não informada.'
    )
  }

  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacao) {
    throw new Error(
      'Movimentação não encontrada.'
    )
  }

  const tipoMovimentacao =
    normalizarMaiusculo(
      movimentacao?.tipo_movimentacao ||
      movimentacao?.tipo
    )

  const destinoMovimentacao =
    normalizarMaiusculo(
      movimentacao?.destino_local
    )

  const entregaCargaPermanente =
    tipoMovimentacao === 'ENTREGA' &&
    destinoMovimentacao ===
      'CARGA PERMANENTE'

  const selecoesPorItem = new Map(
    (Array.isArray(itens) ? itens : [])
      .filter((item) => item?.itemId)
      .map((item) => [
        String(item.itemId),
        item
      ])
  )

  const patrimonioIds = [
    ...new Set(
      (movimentacao.itens || [])
        .map((item) => item?.patrimonio_id)
        .filter(Boolean)
    )
  ]

  let patrimoniosPorId = new Map()

  if (patrimonioIds.length > 0) {
    const {
      data: patrimonios,
      error: patrimoniosError
    } = await supabase
      .from('sigmo_patrimonios')
      .select('id, tipo, referencia_id, descricao, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados')
      .in('id', patrimonioIds)

    if (patrimoniosError) {
      throw patrimoniosError
    }

    patrimoniosPorId = new Map(
      (patrimonios || []).map(
        (patrimonio) => [
          String(patrimonio.id),
          patrimonio
        ]
      )
    )
  }

  const itensQuantitativos = []
  const itensIndividuaisComNovidade = []
  const itensObservacaoAlterados = []

  for (const item of movimentacao.itens || []) {
    const patrimonio =
      patrimoniosPorId.get(
        String(item?.patrimonio_id)
      )

    const observacao =
      lerObjetoObservacao(
        item?.observacao
      )

    const selecao =
      selecoesPorItem.get(
        String(item?.id)
      )

    const novidadePreparada =
      await prepararNovidadeRecebimento({
        novidade:
          selecao?.novidade || null,
        user
      })

    const ehTonfa =
      normalizar(patrimonio?.tipo) === 'tonfa' ||
      normalizar(item?.tipo_patrimonio) === 'tonfa' ||
      normalizar(observacao?.tipo_registro) ===
        'tonfa_quantidade'

    if (!ehTonfa) {
      if (novidadePreparada) {
        itensIndividuaisComNovidade.push({
          item,
          novidadeOriginal:
            selecao?.novidade || null,
          observacaoOriginal:
            item?.observacao || '',
          observacaoAtualizada:
            JSON.stringify({
              ...observacao,
              novidade_recebimento:
                novidadePreparada
            })
        })
      }

      continue
    }

    const tonfaId =
      observacao?.tonfa_id ||
      patrimonio?.referencia_id ||
      null

    if (!tonfaId) {
      throw new Error(
        `Não foi possível identificar o estoque quantitativo de ${
          item?.descricao ||
          patrimonio?.descricao ||
          'Tonfa/Cassetete'
        }.`
      )
    }

    const quantidadeEnviada =
      Math.max(
        1,
        Number(item?.quantidade || 1) || 1
      )

    const quantidadeReceber =
      Math.max(
        1,
        Math.min(
          Number(
            selecao?.quantidadeReceber ??
            quantidadeEnviada
          ) || 1,
          quantidadeEnviada
        )
      )

    itensQuantitativos.push({
      item,
      patrimonio,
      tonfaId,
      quantidadeEnviada,
      quantidadeReceber,
      saldoNaoRecebido:
        quantidadeEnviada -
        quantidadeReceber,
      observacaoOriginal:
        item?.observacao || '',
      observacaoObjetoOriginal:
        observacao,
      novidadeOriginal:
        selecao?.novidade || null,
      novidadePreparada
    })
  }

  if (
    entregaCargaPermanente &&
    itensQuantitativos.length > 0
  ) {
    throw new Error(
      'Carga permanente quantitativa ainda não está habilitada neste fluxo.'
    )
  }

  const policialRe = obterRePolicial(user)

  if (policialRe.length !== 6) {
    throw new Error(
      'O usuário deve possuir RE funcional com 6 dígitos.'
    )
  }

  const policial = {
    ...user,
    id: policialId,
    policial_id: policialId,
    re: policialRe,
    policial_re: policialRe
  }

  const processados = []
  const itensMovimentacaoAlterados = []
  const novidadesOficiaisCriadas = []
  const manutencoesCriadas = []

  try {
    for (
      const registro of
      itensIndividuaisComNovidade
    ) {
      const { error } = await supabase
        .from('sigmo_movimentacao_itens')
        .update({
          observacao:
            registro.observacaoAtualizada
        })
        .eq('id', registro.item.id)

      if (error) throw error

      itensObservacaoAlterados.push(
        registro
      )

      const patrimonio =
        patrimoniosPorId.get(
          String(
            registro.item?.patrimonio_id
          )
        )

      const novidade =
        await registrarNovidadeOficial({
          patrimonio,
          item:
            registro.item,
          observacao:
            lerObjetoObservacao(
              registro.observacaoOriginal
            ),
          novidade:
            lerObjetoObservacao(
              registro.observacaoAtualizada
            )?.novidade_recebimento ||
            null,
          quantidadeRecebida:
            Number(
              registro.item?.quantidade ||
              1
            ) || 1,
          user
        })

      if (novidade?.id) {
        novidadesOficiaisCriadas.push(
          novidade.id
        )

        await notificarNovidadePatrimonial({
          novidadeOficial:
            novidade,
          novidade:
            lerObjetoObservacao(
              registro.observacaoAtualizada
            )?.novidade_recebimento ||
            null,
          patrimonio,
          item:
            registro.item,
          user
        })
      }
    }

    for (const registro of itensQuantitativos) {
      const observacaoAtualizada = {
        ...registro.observacaoObjetoOriginal,
        tipo_registro:
          'TONFA_QUANTIDADE',
        tonfa_id:
          registro.tonfaId,
        quantidade_enviada:
          registro.quantidadeEnviada,
        quantidade_recebida:
          registro.quantidadeReceber,
        saldo_nao_recebido:
          registro.saldoNaoRecebido,
        recebimento_parcial:
          registro.saldoNaoRecebido > 0,
        novidade_recebimento:
          registro.novidadePreparada ||
          registro.observacaoObjetoOriginal
            ?.novidade_recebimento ||
          null
      }

      const {
        error: atualizarItemError
      } = await supabase
        .from('sigmo_movimentacao_itens')
        .update({
          quantidade:
            registro.quantidadeReceber,
          observacao:
            JSON.stringify(
              observacaoAtualizada
            )
        })
        .eq('id', registro.item.id)

      if (atualizarItemError) {
        throw atualizarItemError
      }

      itensMovimentacaoAlterados.push(
        registro
      )

      if (registro.novidadePreparada) {
        const novidade =
          await registrarNovidadeOficial({
            patrimonio:
              registro.patrimonio,
            item:
              registro.item,
            observacao:
              registro.observacaoObjetoOriginal,
            novidade:
              registro.novidadePreparada,
            quantidadeRecebida:
              registro.quantidadeReceber,
            user
          })

        if (novidade?.id) {
          novidadesOficiaisCriadas.push(
            novidade.id
          )

          await notificarNovidadePatrimonial({
            novidadeOficial:
              novidade,
            novidade:
              registro.novidadePreparada,
            patrimonio:
              registro.patrimonio,
            item:
              registro.item,
            user
          })
        }
      }

      await cautelarTonfaParaPolicial({
        tonfaId:
          registro.tonfaId,
        policial,
        quantidade:
          registro.quantidadeReceber,
        observacoes:
          [
            registro.saldoNaoRecebido > 0
              ? `RECEBIMENTO PARCIAL PELO USUÁRIO. ENVIADO: ${registro.quantidadeEnviada}. RECEBIDO: ${registro.quantidadeReceber}. SALDO MANTIDO NO SVDD: ${registro.saldoNaoRecebido}.`
              : 'CARRINHO RECEBIDO INTEGRALMENTE PELO USUÁRIO.',
            registro.novidadePreparada
              ? `NOVIDADE RELATADA NO RECEBIMENTO: ${registro.novidadePreparada.tipo} - ${registro.novidadePreparada.descricao} | QUANTIDADE AFETADA: ${registro.novidadePreparada.quantidade_afetada}`
              : ''
          ]
            .filter(Boolean)
            .join(' | '),
        user
      })

      processados.push(registro)
    }

    const houveRecebimentoParcial =
      itensQuantitativos.some(
        (item) =>
          item.saldoNaoRecebido > 0
      )

    await confirmarRecebimentoMovimentacao({
      movimentacao_id:
        movimentacaoId,
      recebedor:
        policial,
      observacao:
        houveRecebimentoParcial
          ? 'CARRINHO RECEBIDO COM AJUSTE DE QUANTIDADE. O SALDO NÃO ACEITO PERMANECEU NO COFRE DO SVDD.'
          : 'CARRINHO RECEBIDO INTEGRALMENTE PELO USUÁRIO.'
    })

    // A RPC finaliza a movimentação. Em seguida, sincronizamos
    // o estado operacional conforme o tipo de recebimento.
    if (entregaCargaPermanente) {
      await sincronizarCargaPermanenteRecebida({
        movimentacao,
        patrimoniosPorId,
        policial
      })
    } else {
      await sincronizarCautelaIndividualRecebida({
        movimentacao,
        patrimoniosPorId,
        policial
      })
    }

    const registrosParaManutencao = [
      ...itensIndividuaisComNovidade.map(
        (registro) => ({
          item: registro.item,
          patrimonio:
            patrimoniosPorId.get(
              String(
                registro.item?.patrimonio_id
              )
            ),
          novidade:
            lerObjetoObservacao(
              registro.observacaoAtualizada
            )?.novidade_recebimento ||
            null,
          novidadeOriginal:
            registro.novidadeOriginal,
          quantidade:
            Number(
              registro.item?.quantidade ||
              1
            ) || 1
        })
      ),
      ...itensQuantitativos.map(
        (registro) => ({
          item: registro.item,
          patrimonio:
            registro.patrimonio,
          novidade:
            registro.novidadePreparada,
          novidadeOriginal:
            registro.novidadeOriginal,
          quantidade:
            registro.quantidadeReceber
        })
      )
    ].filter(
      (registro) =>
        registro.patrimonio?.id &&
        novidadeSolicitaManutencao(
          registro.novidade
        )
    )

    for (
      const registro of
      registrosParaManutencao
    ) {
      const tipoPatrimonio =
        obterTipoPatrimonioNovidade({
          patrimonio:
            registro.patrimonio,
          item:
            registro.item,
          observacao:
            lerObjetoObservacao(
              registro.item?.observacao
            )
        })

      const arquivos =
        obterArquivosNovidadeOriginal(
          registro.novidadeOriginal
        )

      const manutencao =
        await registrarManutencao({
          modulo:
            obterModuloManutencao(
              tipoPatrimonio
            ),

          tipoMaterial:
            tipoPatrimonio ||
            registro.patrimonio?.tipo ||
            'MATERIAL',

          referenciaId:
            registro.patrimonio
              ?.referencia_id ||
            registro.patrimonio?.id,

          patrimonioId:
            registro.patrimonio?.id ||
            null,

          movimentacaoId:
            movimentacaoId,

          quantidade:
            Math.max(
              1,
              Number(
                registro.quantidade ||
                1
              ) || 1
            ),

          tipoNovidade:
            registro.novidade?.tipo ||
            'DEVOLVIDO COM NOVIDADE',

          descricao:
            registro.novidade
              ?.descricao ||
            'Material encaminhado para manutenção no recebimento.',

          observacoes:
            `NOVIDADE REGISTRADA NO RECEBIMENTO. PROVIDÊNCIA: MANUTENCAO.`,

          origem:
            movimentacao?.origem_local ||
            'CAUTELA INDIVIDUAL',

          destino:
            'MANUTENCAO',

          policial: {
            id:
              policial?.id || null,
            re:
              policial?.re || null,
            nome:
              nomeUsuario(policial)
          },

          fotos:
            arquivos,

          user
        })

      if (manutencao?.id) {
        manutencoesCriadas.push(
          manutencao.id
        )
      }
    }

    const totalQuantitativoRecebido =
      itensQuantitativos.reduce(
        (total, item) =>
          total +
          item.quantidadeReceber,
        0
      )

    const totalMantidoSvdd =
      itensQuantitativos.reduce(
        (total, item) =>
          total +
          item.saldoNaoRecebido,
        0
      )

    return {
      sucesso: true,
      recebimento_parcial:
        totalMantidoSvdd > 0,
      total_quantitativo_recebido:
        totalQuantitativoRecebido,
      total_mantido_svdd:
        totalMantidoSvdd,
      novidades_registradas:
        novidadesOficiaisCriadas.length,
      manutencoes_registradas:
        manutencoesCriadas.length,
      mensagem:
        entregaCargaPermanente
          ? 'Carga permanente recebida com sucesso. O material foi vinculado ao seu cadastro funcional.'
          : totalMantidoSvdd > 0
            ? `Recebimento parcial concluído. ${totalQuantitativoRecebido} unidade(s) recebida(s) e ${totalMantidoSvdd} unidade(s) mantida(s) no Cofre do SVDD.`
            : 'Cautela recebida com sucesso. Os materiais já estão sob sua responsabilidade.'
    }
  } catch (error) {
    if (novidadesOficiaisCriadas.length > 0) {
      console.warn(
        'O recebimento falhou após o registro de novidade patrimonial. As novidades já registradas foram mantidas para auditoria:',
        novidadesOficiaisCriadas
      )
    }

    for (const registro of [...processados].reverse()) {
      try {
        await devolverTonfaDoPolicialAoSvdd({
          tonfaId:
            registro.tonfaId,
          policial,
          quantidade:
            registro.quantidadeReceber,
          observacoes:
            'ROLLBACK AUTOMÁTICO: FALHA AO FINALIZAR O CARRINHO.',
          user
        })
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar saldo quantitativo após erro no recebimento:',
          rollbackError
        )
      }
    }

    for (
      const registro of
      [...itensObservacaoAlterados].reverse()
    ) {
      try {
        await supabase
          .from('sigmo_movimentacao_itens')
          .update({
            observacao:
              registro.observacaoOriginal
          })
          .eq('id', registro.item.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar novidade do item após erro no recebimento:',
          rollbackError
        )
      }
    }

    for (const registro of [...itensMovimentacaoAlterados].reverse()) {
      try {
        await supabase
          .from('sigmo_movimentacao_itens')
          .update({
            quantidade:
              registro.quantidadeEnviada,
            observacao:
              registro.observacaoOriginal
          })
          .eq('id', registro.item.id)
      } catch (rollbackItemError) {
        console.error(
          'Falha ao restaurar o item quantitativo da movimentação:',
          rollbackItemError
        )
      }
    }

    throw error
  }
}


async function obterDestinoDevolucaoPatrimonio({
  patrimonioId,
  policialId
}) {
  if (!patrimonioId) {
    return null
  }

  const {
    data: itensMovimentacao,
    error: itensError
  } = await supabase
    .from('sigmo_movimentacao_itens')
    .select('movimentacao_id, created_at')
    .eq('patrimonio_id', patrimonioId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (itensError) {
    throw itensError
  }

  const movimentacaoIds = [
    ...new Set(
      (itensMovimentacao || [])
        .map((item) => item?.movimentacao_id)
        .filter(Boolean)
    )
  ]

  if (movimentacaoIds.length === 0) {
    return null
  }

  let query = supabase
    .from('sigmo_movimentacoes')
    .select('id, tipo_movimentacao, status, origem_local, recebedor_id, created_at')
    .in('id', movimentacaoIds)
    .eq('tipo_movimentacao', 'CAUTELA')
    .eq('status', 'finalizada')

  if (policialId) {
    query = query.eq('recebedor_id', policialId)
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(1)

  const {
    data: cautelas,
    error: cautelasError
  } = await query

  if (cautelasError) {
    throw cautelasError
  }

  const origem = normalizarMaiusculo(
    cautelas?.[0]?.origem_local
  )

  if (
    origem.includes('P4') ||
    origem.includes('DEPÓSITO DO P4') ||
    origem.includes('DEPOSITO DO P4') ||
    origem.includes('GUARDA DO P4') ||
    origem.includes('COFRE DO P4')
  ) {
    return 'DEPÓSITO DO P4'
  }

  if (origem.includes('SVDD')) {
    return 'COFRE DO SVDD'
  }

  return null
}

export async function solicitarDevolucaoCautela({
  user,
  itens = []
}) {
  const policialId = obterPolicialId(user)

  if (!policialId) {
    throw new Error(
      'Usuário não vinculado a um cadastro funcional.'
    )
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error(
      'Nenhum material em serviço foi localizado para devolução.'
    )
  }

  const gruposPorDestino = new Map()

  for (const item of itens) {
    const quantitativo =
      item?.tipo_registro ===
      'TONFA_QUANTIDADE'

    const patrimonioId =
      item?.patrimonio_id ||
      item?.id ||
      null

    if (!patrimonioId) {
      continue
    }

    const destinoLocal = quantitativo
      ? 'COFRE DO SVDD'
      : await obterDestinoDevolucaoPatrimonio({
          patrimonioId,
          policialId
        })

    if (!destinoLocal) {
      throw new Error(
        `Não foi possível identificar o setor de origem da cautela de ${item?.descricao || item?.numero_serie || 'um dos materiais selecionados'}. A devolução não foi criada para evitar encaminhamento incorreto.`
      )
    }

    const observacaoQuantitativo = quantitativo
      ? JSON.stringify({
          tipo_registro:
            'TONFA_QUANTIDADE',
          movimentacao_tonfa_id:
            item?.movimentacao_tonfa_id ||
            null,
          tonfa_id:
            item?.tonfa_id ||
            item?.referencia_id ||
            null,
          tipo_material:
            item?.tipo ||
            item?.categoria ||
            null
        })
      : item?.observacao || ''

    const itemMovimentacao = {
      id: item?.id,
      patrimonio_id: patrimonioId,
      quantidade:
        Number(item?.quantidade || 1) || 1,
      observacao:
        observacaoQuantitativo
    }

    if (!gruposPorDestino.has(destinoLocal)) {
      gruposPorDestino.set(
        destinoLocal,
        []
      )
    }

    gruposPorDestino
      .get(destinoLocal)
      .push(itemMovimentacao)
  }

  if (gruposPorDestino.size === 0) {
    throw new Error(
      'Os materiais não possuem identificação patrimonial válida.'
    )
  }

  const movimentacoesCriadas = []

  for (const [destinoLocal, itensMovimentacao] of gruposPorDestino) {
    const resultado =
      await criarMovimentacaoCompleta({
        tipo: 'DEVOLUCAO',
        origemLocal:
          'CAUTELA INDIVIDUAL',
        destinoLocal,
        solicitante: {
          ...user,
          id: policialId
        },
        recebedor: null,
        observacoes:
          `DEVOLUÇÃO DOS MATERIAIS SELECIONADOS PELO USUÁRIO PARA ${destinoLocal}.`,
        itens: itensMovimentacao,
        aprovarAutomaticamente: false
      })

    movimentacoesCriadas.push({
      destinoLocal,
      ...resultado
    })
  }

  return {
    sucesso: true,
    movimentacoes:
      movimentacoesCriadas,
    destinos: [
      ...gruposPorDestino.keys()
    ]
  }
}
