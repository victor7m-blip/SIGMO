import { supabase } from './supabaseClient'

import {
  buscarPatrimonioPorReferencia,
  normalizarRE,
  registrarMovimentacao,
  STATUS_PATRIMONIO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

import {
  registrarManutencao,
  MODULOS_MANUTENCAO
} from './manutencoesService'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

const LOCAL_RETORNO_PADRAO =
  'RESERVA DE MATERIAL'

const NOVIDADES_FOTOS_BUCKET =
  'novidades-fotos'

const TAMANHO_MAXIMO_FOTO =
  5 * 1024 * 1024

const TABELAS_REFERENCIA = {
  material: 'sigmo_materiais',
  materiais: 'sigmo_materiais',
  arma: 'sigmo_armas',
  armas: 'sigmo_armas'
}

function texto(valor) {
  const normalizado =
    String(valor ?? '').trim()

  return normalizado || null
}

function maiusculo(valor) {
  const normalizado =
    texto(valor)

  return normalizado
    ? normalizado.toUpperCase()
    : null
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

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function obterReUsuario(user) {
  const reBruto =
    user?.re ||
    user?.user_metadata?.re ||
    ''

  const reNormalizado = String(reBruto)
    .replace(/\D/g, '')
    .slice(0, 6)

  return normalizarRE(
    reNormalizado,
    {
      obrigatorio: false
    }
  )
}

function obterTabelaReferencia(tipo) {
  return (
    TABELAS_REFERENCIA[
      String(tipo ?? '')
        .trim()
        .toLowerCase()
    ] || null
  )
}

function limparDadosResponsabilidade(dados) {
  const atualizados = {
    ...objeto(dados)
  }

  delete atualizados.responsavel_re
  delete atualizados.re_responsavel
  delete atualizados.recebedor_re
  delete atualizados.policial_re

  delete atualizados.responsavel_nome
  delete atualizados.nome_responsavel
  delete atualizados.recebedor_nome
  delete atualizados.policial_nome

  delete atualizados.carga_policial_re
  delete atualizados.carga_policial_nome
  delete atualizados.guardiao_atual

  return atualizados
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
  const nome =
    String(arquivo?.name ?? '')

  const partes =
    nome.split('.')

  if (partes.length > 1) {
    return partes
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') ||
      'jpg'
  }

  const tipo =
    String(arquivo?.type ?? '')
      .toLowerCase()

  if (tipo.includes('png')) {
    return 'png'
  }

  if (tipo.includes('webp')) {
    return 'webp'
  }

  if (tipo.includes('gif')) {
    return 'gif'
  }

  return 'jpg'
}

function gerarIdentificador() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    Date.now(),
    Math.random()
      .toString(16)
      .slice(2)
  ].join('-')
}

function validarFoto(arquivo) {
  if (!ehArquivo(arquivo)) {
    throw new Error(
      'Uma das fotos selecionadas é inválida.'
    )
  }

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
}

async function enviarFotosNovidade({
  arquivos = [],
  user = null
}) {
  if (
    !Array.isArray(arquivos) ||
    arquivos.length === 0
  ) {
    return []
  }

  const lote =
    gerarIdentificador()

  const data =
    new Date()
      .toISOString()
      .slice(0, 10)

  const usuario =
    String(
      user?.id ||
      'usuario-sem-id'
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        '-'
      )

  const fotosEnviadas = []

  for (
    let indice = 0;
    indice < arquivos.length;
    indice += 1
  ) {
    const arquivo =
      arquivos[indice]

    validarFoto(arquivo)

    const extensao =
      extensaoArquivo(
        arquivo
      )

    const caminho = [
      data,
      usuario,
      lote,
      `${String(indice + 1).padStart(2, '0')}-${gerarIdentificador()}.${extensao}`
    ].join('/')

    const {
      error
    } = await supabase.storage
      .from(
        NOVIDADES_FOTOS_BUCKET
      )
      .upload(
        caminho,
        arquivo,
        {
          cacheControl: '3600',
          contentType:
            arquivo.type ||
            'image/jpeg',
          upsert: false
        }
      )

    if (error) {
      throw new Error(
        `Não foi possível enviar a foto "${arquivo.name}": ${error.message}`
      )
    }

    const {
      data: urlData
    } = supabase.storage
      .from(
        NOVIDADES_FOTOS_BUCKET
      )
      .getPublicUrl(
        caminho
      )

    fotosEnviadas.push({
      url:
        urlData?.publicUrl ||
        null,

      caminho,

      bucket:
        NOVIDADES_FOTOS_BUCKET,

      nome_original:
        arquivo.name,

      tipo:
        arquivo.type ||
        null,

      tamanho:
        Number(
          arquivo.size || 0
        ),

      ordem:
        indice + 1,

      principal:
        indice === 0
    })
  }

  return fotosEnviadas
}

async function prepararNovidade({
  novidade,
  user
}) {
  if (
    !novidade ||
    typeof novidade !== 'object'
  ) {
    return null
  }

  const candidatos = [
    ...(
      Array.isArray(
        novidade.fotos
      )
        ? novidade.fotos
        : []
    ),

    ...(
      novidade.foto
        ? [novidade.foto]
        : []
    )
  ]

  const arquivos = []
  const fotosExistentes = []

  for (
    const candidato of candidatos
  ) {
    if (
      ehArquivo(candidato)
    ) {
      if (
        !arquivos.includes(
          candidato
        )
      ) {
        arquivos.push(
          candidato
        )
      }

      continue
    }

    if (
      candidato &&
      typeof candidato === 'object'
    ) {
      fotosExistentes.push(
        candidato
      )
    }
  }

  const fotosEnviadas =
    await enviarFotosNovidade({
      arquivos,
      user
    })

  const fotos = [
    ...fotosExistentes,
    ...fotosEnviadas
  ].map(
    (foto, indice) => ({
      ...foto,
      ordem:
        foto?.ordem ||
        indice + 1,

      principal:
        indice === 0
    })
  )

  const novidadePreparada = {
    ...novidade,

    fotos,

    foto:
      fotos[0]?.url ||
      novidade?.foto_url ||
      null,

    quantidade_fotos:
      fotos.length
  }

  return novidadePreparada
}


function obterModuloManutencao(tipo) {
  const valor =
    String(tipo ?? '')
      .trim()
      .toLowerCase()

  if (
    valor === 'arma' ||
    valor === 'armas'
  ) {
    return MODULOS_MANUTENCAO.ARMAS
  }

  if (
    valor === 'ht' ||
    valor === 'hts'
  ) {
    return MODULOS_MANUTENCAO.HT
  }

  if (
    valor === 'tpd' ||
    valor === 'tpds'
  ) {
    return MODULOS_MANUTENCAO.TPD
  }

  if (
    valor === 'taser' ||
    valor === 'tasers'
  ) {
    return MODULOS_MANUTENCAO.TASER
  }

  if (
    valor === 'colete' ||
    valor === 'coletes'
  ) {
    return MODULOS_MANUTENCAO.COLETE
  }

  if (
    valor === 'municao' ||
    valor === 'municoes' ||
    valor === 'munição' ||
    valor === 'munições'
  ) {
    return MODULOS_MANUTENCAO.MUNICAO
  }

  return MODULOS_MANUTENCAO.OUTROS
}

async function buscarNovidadeOficialComFotos(novidade) {
  const novidadeId =
    novidade?.novidade_id ||
    novidade?.id ||
    null

  if (!novidadeId) {
    return null
  }

  const {
    data: registro,
    error: registroError
  } = await supabase
    .from('sigmo_patrimonio_novidades')
    .select('*')
    .eq('id', novidadeId)
    .maybeSingle()

  if (registroError) {
    throw registroError
  }

  if (!registro?.id) {
    return null
  }

  const {
    data: fotos,
    error: fotosError
  } = await supabase
    .from('sigmo_patrimonio_novidades_fotos')
    .select('*')
    .eq('novidade_id', registro.id)
    .order('principal', { ascending: false })
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (fotosError) {
    throw fotosError
  }

  return {
    ...registro,
    fotos: (fotos || []).map((foto, indice) => ({
      ...foto,
      url:
        foto?.foto_url ||
        foto?.url ||
        null,
      caminho:
        foto?.foto_caminho ||
        foto?.caminho ||
        null,
      ordem:
        foto?.ordem ||
        indice + 1,
      principal:
        foto?.principal === true ||
        indice === 0,
      origem:
        'USUARIO'
    }))
  }
}

function mesclarFotosNovidade(...listas) {
  const resultado = []
  const chaves = new Set()

  for (const lista of listas) {
    for (const foto of Array.isArray(lista) ? lista : []) {
      if (!foto || typeof foto !== 'object') continue

      const url =
        foto?.foto_url ||
        foto?.url ||
        foto?.publicUrl ||
        foto?.public_url ||
        null

      const caminho =
        foto?.foto_caminho ||
        foto?.caminho ||
        foto?.path ||
        null

      const chave =
        `${url || ''}|${caminho || ''}`

      if (!url || chaves.has(chave)) {
        continue
      }

      chaves.add(chave)

      resultado.push({
        ...foto,
        url,
        caminho,
        ordem:
          foto?.ordem ||
          resultado.length + 1,
        principal:
          resultado.length === 0
            ? true
            : foto?.principal === true
      })
    }
  }

  return resultado
}

function montarDescricaoManutencao({
  novidadeOficial,
  novidadeAtual,
  observacao
}) {
  const relatoUsuario =
    texto(novidadeOficial?.descricao)

  const analiseSvdd =
    texto(novidadeAtual?.descricao)

  const partes = []

  if (relatoUsuario) {
    partes.push(
      `RELATO DO USUÁRIO: ${relatoUsuario}`
    )
  }

  if (
    analiseSvdd &&
    analiseSvdd !== relatoUsuario
  ) {
    partes.push(
      `ANÁLISE DO SVDD: ${analiseSvdd}`
    )
  }

  if (partes.length === 0) {
    partes.push(
      analiseSvdd ||
      texto(observacao) ||
      'MATERIAL ENCAMINHADO PARA MANUTENÇÃO NO RECEBIMENTO.'
    )
  }

  return partes.join(' | ')
}

function novidadeSolicitaManutencao(
  novidade
) {
  return (
    String(
      novidade?.providencia ||
      novidade?.destino ||
      ''
    )
      .trim()
      .toUpperCase() ===
    'MANUTENCAO'
  )
}

function erroDeColunaAusente(error) {
  const mensagem =
    String(
      error?.message ?? ''
    ).toLowerCase()

  return (
    mensagem.includes('schema cache') ||
    mensagem.includes('could not find') ||
    mensagem.includes('column') ||
    mensagem.includes('local_atual') ||
    mensagem.includes('responsavel_re') ||
    mensagem.includes('recebedor_re')
  )
}

async function atualizarPatrimonioCentral({
  patrimonio,
  localDestino,
  unidadeDestino
}) {
  const dados =
    limparDadosResponsabilidade(
      patrimonio?.dados
    )

  const payload = {
    status:
      'RESERVA',

    local_atual:
      maiusculo(localDestino),

    companhia_atual:
      maiusculo(unidadeDestino),

    responsavel_atual_id:
      null,

    responsavel_atual_nome:
      null,

    dados
  }

  const {
    data,
    error
  } = await supabase
    .from(PATRIMONIOS_TABLE)
    .update(payload)
    .eq('id', patrimonio.id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

async function atualizarRegistroReferencia({
  patrimonio,
  localDestino,
  unidadeDestino
}) {
  const tabela =
    obterTabelaReferencia(
      patrimonio?.tipo
    )

  if (
    !tabela ||
    !patrimonio?.referencia_id
  ) {
    return null
  }

  let payload

  if (tabela === 'sigmo_armas') {
    payload = {
      status:
        'RESERVA',

      local_atual:
        maiusculo(localDestino),

      carga_policial_id:
        null,

      carga_policial_re:
        null,

      carga_policial_nome:
        null,

      carga_policial_posto_graduacao:
        null,

      carga_policial_companhia:
        null,

      carga_policial_pelotao:
        null,

      carga_policial_funcao:
        null
    }
  } else if (
    tabela === 'sigmo_materiais'
  ) {
    payload = {
      status:
        STATUS_PATRIMONIO.ATIVO,

      local_atual:
        maiusculo(localDestino),

      unidade:
        maiusculo(unidadeDestino)
    }
  } else {
    payload = {
      status:
        STATUS_PATRIMONIO.ATIVO
    }
  }

  const {
    data,
    error
  } = await supabase
    .from(tabela)
    .update(payload)
    .eq(
      'id',
      patrimonio.referencia_id
    )
    .select('*')
    .maybeSingle()

  if (error) {
    console.warn(
      `O patrimônio central foi atualizado, mas não foi possível sincronizar ${tabela}:`,
      error
    )

    return null
  }

  return data
}

export async function receberMaterial({
  patrimonioId = null,
  referenciaId = null,
  tipo = 'material',

  entregadorRE,
  entregadorNome,

  localDestino =
    LOCAL_RETORNO_PADRAO,

  unidadeDestino = '',

  documento = '',
  observacao = '',
  novidade = null,
  novidadePreparada = false,

  user = null
}) {
  const referencia =
    referenciaId ||
    patrimonioId

  if (!referencia) {
    throw new Error(
      'Selecione o patrimônio que será recebido.'
    )
  }

  const reEntregador =
    normalizarRE(
      entregadorRE,
      {
        obrigatorio: true,
        campo: 'RE de quem está entregando'
      }
    )

  if (!texto(entregadorNome)) {
    throw new Error(
      'O nome de quem está entregando não foi localizado.'
    )
  }

  if (!texto(localDestino)) {
    throw new Error(
      'O local de retorno não foi informado.'
    )
  }

  const patrimonio =
    await buscarPatrimonioPorReferencia({
      tipo,
      referenciaId: referencia
    })

  if (
    patrimonio.status ===
      STATUS_PATRIMONIO.BAIXADO ||
    patrimonio.status ===
      STATUS_PATRIMONIO.INATIVO
  ) {
    throw new Error(
      'Este patrimônio está baixado ou inativo e não pode ser recebido.'
    )
  }

  const operadorNome =
    obterNomeUsuario(user)

  const operadorRe =
    obterReUsuario(user)

  const novidadeOriginal =
    novidade

  const novidadeFinal =
    novidadePreparada
      ? novidade
      : await prepararNovidade({
          novidade,
          user
        })

  const novidadeOficial =
    await buscarNovidadeOficialComFotos(
      novidadeFinal
    )

  const fotosParaManutencao =
    mesclarFotosNovidade(
      novidadeOficial?.fotos,
      novidadeFinal?.fotos
    )

  const movimentacao =
    await registrarMovimentacao({
      patrimonioId:
        patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO.RECEBIMENTO,

      statusNovo:
        'RESERVA',

      localDestino,

      companhiaDestino:
        unidadeDestino,

      recebedorRE: null,
      recebedorNome: null,

      motivo:
        'DEVOLUÇÃO DE MATERIAL À RESERVA',

      observacao,

      dados: {
       guardiao_destino: {
       tipo: 'SETOR',
       codigo: maiusculo(localDestino),
       nome: maiusculo(localDestino),
        id: null
      },

        modulo:
          String(tipo)
            .trim()
            .toUpperCase(),

        referencia_id:
          patrimonio.referencia_id,

        entregador_re:
          reEntregador,

        entregador_nome:
          maiusculo(
            entregadorNome
          ),

        recebido_por_id:
          user?.id || null,

        recebido_por_re:
          operadorRe,

        recebido_por_nome:
          maiusculo(
            operadorNome
          ),

        local_retorno:
          maiusculo(
            localDestino
          ),

        documento:
          texto(documento),

        novidade:
          novidadeFinal &&
          typeof novidadeFinal === 'object'
            ? novidadeFinal
            : null
      },

      user
    })

  const patrimonioAtualizado =
    await atualizarPatrimonioCentral({
      patrimonio,
      localDestino,
      unidadeDestino
    })

  const registroReferencia =
    await atualizarRegistroReferencia({
      patrimonio,
      localDestino,
      unidadeDestino
    })

  let manutencao = null

  if (
    novidadeSolicitaManutencao(
      novidadeFinal
    )
  ) {
    manutencao =
      await registrarManutencao({
        modulo:
          obterModuloManutencao(
            patrimonio?.tipo ||
            tipo
          ),

        tipoMaterial:
          patrimonio?.dados?.tipo ||
          patrimonio?.dados?.especie ||
          patrimonio?.dados?.categoria ||
          patrimonio?.tipo ||
          tipo ||
          'MATERIAL',

        referenciaId:
          patrimonio?.referencia_id ||
          referencia,

        patrimonioId:
          patrimonio?.id ||
          null,

        movimentacaoId:
          movimentacao?.id ||
          null,

        quantidade:
          1,

        tipoNovidade:
          novidadeOficial?.titulo ||
          novidadeFinal?.tipo ||
          'DEVOLVIDO COM NOVIDADE',

        descricao:
          montarDescricaoManutencao({
            novidadeOficial,
            novidadeAtual:
              novidadeFinal,
            observacao
          }),

        observacoes:
          [
            texto(observacao),
            'PROVIDÊNCIA DEFINIDA PELO SVDD: MANUTENCAO'
          ]
            .filter(Boolean)
            .join(' | '),

        origem:
          'CAUTELA INDIVIDUAL',

        destino:
          'MANUTENCAO',

        policial: {
          re:
            reEntregador,

          nome:
            entregadorNome
        },

        // A manutenção herda as fotos oficiais já registradas pelo usuário
        // e também eventuais fotos adicionadas pelo SVDD, sem depender
        // apenas do estado da tela.
        foto:
          fotosParaManutencao[0] ||
          null,

        fotos:
          fotosParaManutencao,

        user
      })
  }

  return {
    patrimonio:
      patrimonioAtualizado,

    registroReferencia,

    movimentacao,

    manutencao
  }
}

export async function receberMateriais({
  itens = [],

  entregadorRE,
  entregadorNome,

  localDestino =
    LOCAL_RETORNO_PADRAO,

  unidadeDestino = '',

  documento = '',
  observacao = '',
  novidade = null,

  user = null
}) {
  if (
    !Array.isArray(itens) ||
    itens.length === 0
  ) {
    throw new Error(
      'Selecione pelo menos um patrimônio para receber.'
    )
  }

  const resultados = []

  for (const item of itens) {
    const resultado =
      await receberMaterial({
        patrimonioId:
          item.patrimonio_id ||
          item.id,

        referenciaId:
          item.referencia_id,

        tipo:
          item.tipo ||
          item.modulo ||
          'material',

        entregadorRE,
        entregadorNome,

        localDestino:
          item.local_origem ||
          localDestino,

        unidadeDestino,
        documento,
        observacao,
        novidade,

        novidadePreparada:
          false,

        user
      })

    resultados.push({
      item,
      resultado
    })
  }

  return {
    total:
      resultados.length,

    resultados
  }
}

export {
  LOCAL_RETORNO_PADRAO
}