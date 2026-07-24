import { supabase } from './supabaseClient'

const TABELA_PATRIMONIOS =
  'sigmo_patrimonios'

const TABELA_MOVIMENTACOES =
  'sigmo_patrimonio_movimentacoes'

export const TIPOS_MOVIMENTACAO =
  Object.freeze({
    CADASTRO:
      'CADASTRO',

    EDICAO:
      'EDICAO',

    RECEBIMENTO:
      'RECEBIMENTO',

    DISTRIBUICAO:
      'DISTRIBUICAO',

    TRANSFERENCIA:
      'TRANSFERENCIA',

    CAUTELA:
      'CAUTELA',

    CAUTELA_SERVICO:
      'CAUTELA_SERVICO',

    CARGA_PERMANENTE:
      'CARGA_PERMANENTE',

    EMPRESTIMO:
      'EMPRESTIMO',

    DEVOLUCAO:
      'DEVOLUCAO',

    RECOLHIMENTO:
      'RECOLHIMENTO',

    MANUTENCAO:
      'MANUTENCAO',

    RETORNO_MANUTENCAO:
      'RETORNO_MANUTENCAO',

    BAIXA:
      'BAIXA',

    AJUSTE_ESTOQUE:
      'AJUSTE_ESTOQUE',

    CONFERENCIA:
      'CONFERENCIA',

    FOTO_ADICIONADA:
      'FOTO_ADICIONADA',

    FOTO_REMOVIDA:
      'FOTO_REMOVIDA',

    QR_CODE_GERADO:
      'QR_CODE_GERADO',

    ETIQUETA_IMPRESSA:
      'ETIQUETA_IMPRESSA',

    EXCLUSAO:
      'EXCLUSAO'
  })

export const STATUS_PATRIMONIO =
  Object.freeze({
    ATIVO:
      'ATIVO',

    DISPONIVEL:
      'DISPONIVEL',

    RESERVA:
      'RESERVA',

    EM_SERVICO:
      'EM_SERVICO',

    CARGA:
      'CARGA',

    CAUTELADO:
      'CAUTELADO',

    EMPRESTADO:
      'EMPRESTADO',

    MANUTENCAO:
      'MANUTENCAO',

    RECOLHIDO:
      'RECOLHIDO',

    BAIXADO:
      'BAIXADO',

    APREENDIDO:
      'APREENDIDO',

    INATIVO:
      'INATIVO'
  })

export const STATUS_MOVIMENTACAO =
  Object.freeze({
    PENDENTE:
      'PENDENTE',

    EM_ANDAMENTO:
      'EM_ANDAMENTO',

    CONCLUIDA:
      'CONCLUIDA',

    CANCELADA:
      'CANCELADA',

    ATRASADA:
      'ATRASADA'
  })

function normalizarTexto(
  valor
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null
  }

  const resultado =
    String(valor).trim()

  return resultado || null
}

function normalizarUpper(
  valor
) {
  const resultado =
    normalizarTexto(valor)

  return resultado
    ? resultado.toUpperCase()
    : null
}

function normalizarObjeto(
  valor,
  fallback = {}
) {
  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  ) {
    return valor
  }

  return fallback
}

function agoraISO() {
  return new Date().toISOString()
}

function somenteNumeros(
  valor
) {
  return String(
    valor ?? ''
  ).replace(
    /\D/g,
    ''
  )
}

function numeroPositivo(
  valor,
  fallback = 1
) {
  const numero =
    Number(valor)

  if (
    !Number.isFinite(numero) ||
    numero <= 0
  ) {
    return fallback
  }

  return numero
}

function limparObjeto(
  objeto
) {
  return Object.fromEntries(
    Object.entries(
      objeto
    ).filter(
      ([, valor]) =>
        valor !== undefined
    )
  )
}

function gerarProtocoloMovimentacao() {
  const agora =
    new Date()

  const data =
    agora
      .toISOString()
      .slice(0, 10)
      .replace(
        /-/g,
        ''
      )

  const hora =
    agora
      .toTimeString()
      .slice(0, 8)
      .replace(
        /:/g,
        ''
      )

  const aleatorio =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()

  return (
    `MOV-${data}-` +
    `${hora}-${aleatorio}`
  )
}

export function normalizarRE(
  valor,
  {
    obrigatorio = false,
    campo = 'RE'
  } = {}
) {
  const re =
    somenteNumeros(valor)

  if (
    !re &&
    !obrigatorio
  ) {
    return null
  }

  if (
    !re &&
    obrigatorio
  ) {
    throw new Error(
      `${campo} é obrigatório.`
    )
  }

  if (
    re.length !== 6
  ) {
    throw new Error(
      `${campo} deve possuir exatamente 6 dígitos.`
    )
  }

  return re
}

export function normalizarUsuarioMovimentacao(
  user = null
) {
  const usuario =
    normalizarObjeto(
      user,
      {}
    )

  const reBruto =
    usuario.re ??
    usuario.RE ??
    usuario.matricula ??
    usuario.registro ??
    usuario.username ??
    usuario.user_metadata?.re ??
    ''

  const reNumerico =
    somenteNumeros(
      reBruto
    )

  const id =
    usuario.id ??
    usuario.policial_id ??
    usuario.user_id ??
    usuario.auth_id ??
    null

  return {
    id:
      id || null,

    re:
      reNumerico.length === 6
        ? reNumerico
        : null,

    nome:
      normalizarUpper(
        usuario.nome ??
        usuario.name ??
        usuario.nome_completo ??
        usuario.nome_guerra ??
        usuario.displayName ??
        usuario.user_metadata?.nome ??
        usuario.user_metadata?.full_name ??
        null
      ),

    email:
      normalizarTexto(
        usuario.email
      )?.toLowerCase() ??
      null,

    perfil:
      normalizarUpper(
        usuario.perfil ??
        usuario.role ??
        usuario.user_metadata?.perfil ??
        null
      )
  }
}

function mapearPatrimonio(
  row
) {
  if (!row) {
    return null
  }

  return {
    ...row,

    patrimonioId:
      row.id,

    referenciaId:
      row.referencia_id,

    referenciaTipo:
      row.referencia_tipo ??
      row.tipo ??
      null,

    localAtual:
      row.local_atual,

    companhiaAtual:
      row.companhia_atual,

    statusAtual:
      row.status_atual ??
      row.status ??
      null,

    responsavelId:
      row.responsavel_id ??
      row.responsavel_atual_id ??
      null,

    responsavelNome:
      row.responsavel_nome ??
      row.responsavel_atual_nome ??
      null,

    responsavelRe:
      row.responsavel_re ??
      row.dados?.carga_policial_re ??
      null,

    atualizadoEm:
      row.updated_at ??
      row.atualizado_em ??
      null,

    criadoEm:
      row.created_at ??
      row.criado_em ??
      null
  }
}

function mapearMovimentacao(
  row
) {
  if (!row) {
    return null
  }

  return {
    ...row,

    movimentacaoId:
      row.id,

    patrimonioId:
      row.patrimonio_id ??
      row.item_id ??
      null,

    tipo:
      row.tipo_movimentacao ??
      row.tipo ??
      null,

    criadoEm:
      row.criado_em ??
      row.created_at ??
      row.data_movimentacao ??
      null
  }
}

function obterDadosPatrimonio(
  patrimonio
) {
  return normalizarObjeto(
    patrimonio?.dados,
    {}
  )
}

export function obterIdentificacaoPatrimonio(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(
      patrimonio
    )

  return (
    dados.patrimonio ||
    dados.numero_patrimonio ||
    patrimonio?.numero_patrimonio ||
    dados.numero_serie ||
    patrimonio?.numero_serie ||
    dados.descricao ||
    patrimonio?.descricao ||
    dados.modelo ||
    patrimonio?.referencia_id ||
    patrimonio?.id ||
    'PATRIMÔNIO'
  )
}

function obterEntidade(
  entidade,
  {
    tipoPadrao = 'OUTRO',
    nomePadrao = 'NÃO INFORMADO',
    codigoPadrao = null
  } = {}
) {
  const valor =
    normalizarObjeto(
      entidade,
      {}
    )

  const tipo =
    normalizarUpper(
      valor.tipo ??
      tipoPadrao
    ) ||
    tipoPadrao

  const codigo =
    normalizarUpper(
      valor.codigo ??
      valor.id ??
      valor.re ??
      codigoPadrao
    )

  const nome =
    normalizarUpper(
      valor.nome ??
      valor.nome_guerra ??
      valor.descricao ??
      codigo ??
      nomePadrao
    ) ||
    nomePadrao

  return {
    tipo,
    codigo,
    id:
      valor.id ??
      codigo ??
      null,

    nome,

    re:
      valor.re
        ? somenteNumeros(
            valor.re
          )
        : null,

    companhia:
      normalizarUpper(
        valor.companhia
      ),

    dados:
      normalizarObjeto(
        valor.dados,
        {}
      )
  }
}

function obterGuardiaoOrigem({
  patrimonio,
  dados
}) {
  const dadosPatrimonio =
    obterDadosPatrimonio(
      patrimonio
    )

  const origemInformada =
    dados.guardiao_origem ??
    dados.origem_guardiao ??
    null

  if (origemInformada) {
    return obterEntidade(
      origemInformada,
      {
        tipoPadrao:
          'SETOR',

        nomePadrao:
          patrimonio.local_atual ||
          'ORIGEM'
      }
    )
  }

  return obterEntidade(
    {
      tipo:
        patrimonio.responsavel_atual_id
          ? 'POLICIAL'
          : 'SETOR',

      id:
        patrimonio.responsavel_atual_id ??
        patrimonio.local_atual ??
        null,

      codigo:
        patrimonio.responsavel_atual_id ??
        patrimonio.local_atual ??
        null,

      nome:
        patrimonio.responsavel_atual_nome ??
        patrimonio.local_atual ??
        'ORIGEM',

      re:
        patrimonio.responsavel_re ??
        dadosPatrimonio.carga_policial_re ??
        null,

      companhia:
        patrimonio.companhia_atual ??
        null
    },
    {
      tipoPadrao:
        'SETOR',

      nomePadrao:
        'ORIGEM'
    }
  )
}

function obterGuardiaoDestino({
  dados,
  recebedorRE,
  recebedorNome,
  localDestino,
  companhiaDestino
}) {
  const destinoInformado =
    dados.guardiao_destino ??
    dados.destino_guardiao ??
    null

  if (destinoInformado) {
    return obterEntidade(
      destinoInformado,
      {
        tipoPadrao:
          recebedorRE
            ? 'POLICIAL'
            : 'SETOR',

        nomePadrao:
          recebedorNome ||
          localDestino ||
          'DESTINO'
      }
    )
  }

  return obterEntidade(
    {
      tipo:
        recebedorRE
          ? 'POLICIAL'
          : 'SETOR',

      codigo:
        recebedorRE ||
        localDestino ||
        null,

      nome:
        recebedorNome ||
        localDestino ||
        'DESTINO',

      re:
        recebedorRE,

      companhia:
        companhiaDestino
    },
    {
      tipoPadrao:
        'SETOR',

      nomePadrao:
        'DESTINO'
    }
  )
}
function obterGestorPatrimonial({
  dados,
  guardiaoDestino
}) {
  const gestorInformado =
    dados.gestor_patrimonial ??
    dados.gestor_destino ??
    dados.destino_gestor ??
    null

  if (gestorInformado) {
    return obterEntidade(
      gestorInformado,
      {
        tipoPadrao:
          'SETOR',

        codigoPadrao:
          'P4',

        nomePadrao:
          'P4'
      }
    )
  }

  return obterEntidade(
    {
      tipo:
        'SETOR',

      codigo:
        'P4',

      nome:
        'P4',

      companhia:
        guardiaoDestino.companhia ??
        null
    },
    {
      tipoPadrao:
        'SETOR',

      codigoPadrao:
        'P4',

      nomePadrao:
        'P4'
    }
  )
}

function obterProprietarioPatrimonial({
  patrimonio,
  dados
}) {
  const proprietarioInformado =
    dados.proprietario ??
    dados.proprietario_patrimonial ??
    null

  if (proprietarioInformado) {
    return obterEntidade(
      proprietarioInformado,
      {
        tipoPadrao:
          'UNIDADE',

        codigoPadrao:
          patrimonio.companhia_atual ??
          'PMESP',

        nomePadrao:
          patrimonio.companhia_atual ??
          'PMESP'
      }
    )
  }

  return obterEntidade(
    {
      tipo:
        'UNIDADE',

      codigo:
        patrimonio.companhia_atual ??
        'PMESP',

      nome:
        patrimonio.companhia_atual ??
        'PMESP',

      companhia:
        patrimonio.companhia_atual ??
        null
    },
    {
      tipoPadrao:
        'UNIDADE',

      codigoPadrao:
        'PMESP',

      nomePadrao:
        'PMESP'
    }
  )
}

function obterLocalPatrimonial({
  local,
  guardiao,
  fallback
}) {
  const valor =
    normalizarObjeto(
      local,
      {}
    )

  const nome =
    normalizarUpper(
      valor.nome ??
      valor.descricao ??
      valor.codigo ??
      (
        typeof local === 'string'
          ? local
          : null
      ) ??
      guardiao?.nome ??
      fallback
    ) ||
    fallback

  const tipo =
    normalizarUpper(
      valor.tipo ??
      (
        guardiao?.tipo === 'POLICIAL'
          ? 'PESSOAL'
          : 'SETOR'
      )
    ) ||
    'SETOR'

  const codigo =
    normalizarUpper(
      valor.codigo ??
      guardiao?.codigo ??
      nome
    )

  return {
    tipo,
    codigo,
    nome
  }
}

function obterNaturezaMovimentacao({
  dados
}) {
  const natureza =
    normalizarUpper(
      dados.natureza ??
      dados.natureza_patrimonial ??
      dados.metadata?.natureza ??
      'PROPRIO'
    )

  const naturezasPermitidas = [
    'PROPRIO',
    'EMPRESTIMO',
    'COMODATO',
    'DOACAO',
    'APREENSAO',
    'CEDIDO',
    'LOCACAO',
    'OUTROS'
  ]

  return naturezasPermitidas.includes(
    natureza
  )
    ? natureza
    : 'PROPRIO'
}

function obterStatusMovimentacao(
  dados
) {
  return (
    normalizarUpper(
      dados.status_movimentacao
    ) ||
    STATUS_MOVIMENTACAO.CONCLUIDA
  )
}

function montarMetadataMovimentacao({
  patrimonio,
  tipo,
  statusNovo,
  motivo,
  observacao,
  dados,
  usuario,
  guardiaoOrigem,
  guardiaoDestino,
  gestor,
  proprietario
}) {
  return {
    engine:
      dados.engine ??
      'PATRIMONIO_CORE_V1',

    patrimonio: {
      id:
        patrimonio.id,

      tipo:
        patrimonio.tipo ??
        patrimonio.referencia_tipo ??
        null,

      referencia_id:
        patrimonio.referencia_id ??
        null,

      identificacao:
        obterIdentificacaoPatrimonio(
          patrimonio
        ),

      descricao:
        patrimonio.descricao ??
        null
    },

    movimentacao: {
      tipo:
        normalizarUpper(
          tipo
        ),

      status_anterior:
        patrimonio.status_atual ??
        patrimonio.status ??
        null,

      status_novo:
        normalizarUpper(
          statusNovo
        ),

      motivo:
        normalizarUpper(
          motivo
        ),

      observacao:
        normalizarTexto(
          observacao
        ),

      quantidade:
        numeroPositivo(
          dados.quantidade,
          1
        )
    },

    guardiao_origem:
      guardiaoOrigem,

    guardiao_destino:
      guardiaoDestino,

    gestor_patrimonial:
      gestor,

    proprietario:
      proprietario,

    realizado_por:
      usuario,

    dados_engine:
      dados,

    registrado_em:
      agoraISO()
  }
}

async function obterPatrimonioInterno(
  id
) {
  const {
    data,
    error
  } = await supabase
    .from(
      TABELA_PATRIMONIOS
    )
    .select('*')
    .eq(
      'id',
      id
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

async function atualizarPatrimonio(
  id,
  dados
) {
  const payload =
    limparObjeto({
      ...dados,

      updated_at:
        agoraISO()
    })

  const {
    data,
    error
  } = await supabase
    .from(
      TABELA_PATRIMONIOS
    )
    .update(
      payload
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

async function inserirMovimentacao(
  payload
) {
  const registro =
    limparObjeto({
      ...payload,

      created_at:
        payload.created_at ??
        agoraISO()
    })

  const {
    data,
    error
  } = await supabase
    .from(
      TABELA_MOVIMENTACOES
    )
    .insert(
      registro
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function buscarPatrimonioPorId(
  id
) {
  if (!id) {
    return null
  }

  const row =
    await obterPatrimonioInterno(
      id
    )

  return mapearPatrimonio(
    row
  )
}

export async function buscarPatrimonioPorReferencia(
  tipoOuParametros,
  referenciaIdInformada = null
) {
  const parametros =
    typeof tipoOuParametros === 'object'
      ? tipoOuParametros
      : {
          tipo:
            tipoOuParametros,

          referenciaId:
            referenciaIdInformada
        }

  const tipo =
    normalizarTexto(
      parametros.tipo ??
      parametros.referenciaTipo
    )

  const referenciaId =
    parametros.referenciaId ??
    parametros.referencia_id ??
    null

  if (
    !tipo ||
    !referenciaId
  ) {
    return null
  }

  let query =
    supabase
      .from(
        TABELA_PATRIMONIOS
      )
      .select('*')
      .eq(
        'referencia_id',
        referenciaId
      )

  const {
    data,
    error
  } = await query
    .eq(
      'tipo',
      tipo
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapearPatrimonio(
    data
  )
}

function normalizarTipoMovimentacaoBanco(
  tipo
) {
  const tipoNormalizado =
    normalizarUpper(tipo)

  const mapa = {
    RECEBIMENTO:
      'RECEBIMENTO',

    DISTRIBUICAO:
      'TRANSFERENCIA',

    TRANSFERENCIA:
      'TRANSFERENCIA',

    EMPRESTIMO:
      'EMPRESTIMO_SAIDA',

    EMPRESTIMO_ENTRADA:
      'EMPRESTIMO_ENTRADA',

    EMPRESTIMO_SAIDA:
      'EMPRESTIMO_SAIDA',

    DEVOLUCAO_EMPRESTIMO:
      'DEVOLUCAO_EMPRESTIMO',

    CARGA_PERMANENTE:
      'CARGA_PERMANENTE',

    CAUTELA:
      'CAUTELA',

    CAUTELA_SERVICO:
      'CAUTELA',

    DEVOLUCAO:
      'DEVOLUCAO',

    MANUTENCAO:
      'MANUTENCAO_ENVIO',

    MANUTENCAO_ENVIO:
      'MANUTENCAO_ENVIO',

    RETORNO_MANUTENCAO:
      'MANUTENCAO_RETORNO',

    MANUTENCAO_RETORNO:
      'MANUTENCAO_RETORNO',

    REGULARIZACAO_ENTRADA:
      'REGULARIZACAO_ENTRADA',

    REGULARIZACAO_SAIDA:
      'REGULARIZACAO_SAIDA',

    BAIXA:
      'BAIXA',

    AJUSTE_ESTOQUE:
      'INVENTARIO_AJUSTE',

    CONFERENCIA:
      'INVENTARIO_AJUSTE',

    INVENTARIO_AJUSTE:
      'INVENTARIO_AJUSTE',

    ALTERACAO_GESTOR:
      'ALTERACAO_GESTOR',

    ALTERACAO_GUARDIAO:
      'ALTERACAO_GUARDIAO',

    ALTERACAO_LOCAL:
      'ALTERACAO_LOCAL'
  }

  const resultado =
    mapa[tipoNormalizado]

  if (!resultado) {
    throw new Error(
      `Tipo de movimentação não suportado: ${tipoNormalizado || 'NÃO INFORMADO'}.`
    )
  }

  return resultado
}

async function buscarItemCatalogoPatrimonial(
  patrimonio
) {
  const dados =
    obterDadosPatrimonio(
      patrimonio
    )

  const descricao =
    normalizarUpper(
      patrimonio.descricao ??
      dados.descricao ??
      ''
    ) || ''

  let categoria =
    normalizarUpper(
      dados.categoria ??
      dados.tipo_material ??
      dados.tipo ??
      patrimonio.tipo
    )

  if (
    descricao.includes(
      'CASSETETE'
    )
  ) {
    categoria =
      'CASSETETE'
  } else if (
    descricao.includes(
      'TONFA'
    )
  ) {
    categoria =
      'TONFA'
  }

  if (!categoria) {
    throw new Error(
      'Não foi possível identificar a categoria do item patrimonial.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(
      'sigmo_patrimonio_itens'
    )
    .select(
      'id, categoria, codigo, nome'
    )
    .eq(
      'categoria',
      categoria
    )
    .eq(
      'ativo',
      true
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      `Item de catálogo não encontrado para a categoria ${categoria}.`
    )
  }

  return data
}

export async function registrarMovimentacao({
  patrimonioId,
  tipo,

  statusNovo = null,

  localDestino = null,
  companhiaDestino = null,

  recebedorRE = null,
  recebedorNome = null,

  motivo = null,
  observacao = null,

  dados = {},

  user = null
}) {
  if (!patrimonioId) {
    throw new Error(
      'O patrimônio da movimentação é obrigatório.'
    )
  }

  if (!tipo) {
    throw new Error(
      'O tipo da movimentação é obrigatório.'
    )
  }

  const patrimonio =
    await buscarPatrimonioPorId(
      patrimonioId
    )


    const itemCatalogo =
  await buscarItemCatalogoPatrimonial(
    patrimonio
  )
  if (!patrimonio) {
    throw new Error(
      'Patrimônio não encontrado.'
    )
  }

  const dadosNormalizados =
    normalizarObjeto(
      dados,
      {}
    )

  const usuario =
    normalizarUsuarioMovimentacao(
      user
    )

  const tipoOriginal =
  normalizarUpper(
    tipo
  )

const tipoNormalizado =
  normalizarTipoMovimentacaoBanco(
    tipoOriginal
  )

  const statusNovoNormalizado =
    normalizarUpper(
      statusNovo
    )

  const localDestinoNormalizado =
    normalizarUpper(
      localDestino
    )

  const companhiaDestinoNormalizada =
    normalizarUpper(
      companhiaDestino
    )

  const recebedorReNormalizado =
    recebedorRE
      ? normalizarRE(
          recebedorRE,
          {
            campo:
              'RE do recebedor'
          }
        )
      : null

  const recebedorNomeNormalizado =
    normalizarUpper(
      recebedorNome
    )

  const guardiaoOrigem =
    obterGuardiaoOrigem({
      patrimonio,
      dados:
        dadosNormalizados
    })

  const guardiaoDestino =
    obterGuardiaoDestino({
      dados:
        dadosNormalizados,

      recebedorRE:
        recebedorReNormalizado,

      recebedorNome:
        recebedorNomeNormalizado,

      localDestino:
        localDestinoNormalizado,

      companhiaDestino:
        companhiaDestinoNormalizada
    })

  const gestor =
    obterGestorPatrimonial({
      dados:
        dadosNormalizados,

      guardiaoDestino
    })

  const proprietario =
    obterProprietarioPatrimonial({
      patrimonio,
      dados:
        dadosNormalizados
    })

  const localOrigemEstruturado =
    obterLocalPatrimonial({
      local:
        dadosNormalizados.local_origem,

      guardiao:
        guardiaoOrigem,

      fallback:
        normalizarUpper(
          patrimonio.local_atual
        ) ||
        'ORIGEM'
    })

  const localDestinoEstruturado =
    obterLocalPatrimonial({
      local:
        dadosNormalizados.local_destino ??
        localDestinoNormalizado,

      guardiao:
        guardiaoDestino,

      fallback:
        localDestinoNormalizado ||
        guardiaoDestino.nome ||
        'DESTINO'
    })

  const quantidade =
    numeroPositivo(
      dadosNormalizados.quantidade,
      1
    )

  const protocolo =
    normalizarUpper(
      dadosNormalizados.protocolo
    ) ||
    gerarProtocoloMovimentacao()

  const natureza =
    obterNaturezaMovimentacao({
      tipo:
        tipoNormalizado,

      dados:
        dadosNormalizados
    })

  const statusMovimentacao =
    obterStatusMovimentacao(
      dadosNormalizados
    )

  const metadata =
    montarMetadataMovimentacao({
      patrimonio,
      tipo:
        tipoNormalizado,

      statusNovo:
        statusNovoNormalizado,

      motivo,
      observacao,

      dados:
        dadosNormalizados,

      usuario,
      guardiaoOrigem,
      guardiaoDestino,
      gestor,
      proprietario
    })

  const agora =
    agoraISO()

  const movimentacao = {
    protocolo,

    tipo_movimentacao:
      tipoNormalizado,

    item_id:
       itemCatalogo.id,
    quantidade,

    destino_guardiao_tipo:
      guardiaoDestino.tipo,

    destino_guardiao_codigo:
      guardiaoDestino.codigo,

    destino_guardiao_id:
      guardiaoDestino.id,

    destino_guardiao_nome:
      guardiaoDestino.nome,

    destino_guardiao_re:
      guardiaoDestino.re,

    destino_local_tipo:
      localDestinoEstruturado.tipo,

    destino_local_codigo:
      localDestinoEstruturado.codigo,

    destino_local_nome:
      localDestinoEstruturado.nome,

    destino_gestor_tipo:
      gestor.tipo,

    destino_gestor_codigo:
      gestor.codigo,

    destino_gestor_id:
      gestor.id,

    destino_gestor_nome:
      gestor.nome,

    proprietario_tipo:
      proprietario.tipo,

    proprietario_codigo:
      proprietario.codigo,

    proprietario_id:
      proprietario.id,

    proprietario_nome:
      proprietario.nome,

    natureza,

    metadata,

    patrimonio_id:
      patrimonioId,

    tipo:
       tipoOriginal,

    status_anterior:
      patrimonio.status_atual ??
      patrimonio.status ??
      null,

    status_novo:
      statusNovoNormalizado,

    local_origem:
      normalizarUpper(
        patrimonio.local_atual
      ),

    local_destino:
      localDestinoEstruturado.nome,

    companhia_origem:
      normalizarUpper(
        patrimonio.companhia_atual
      ),

    companhia_destino:
      companhiaDestinoNormalizada,

    responsavel_anterior_re:
      patrimonio.responsavel_re ??
      null,

    responsavel_anterior_nome:
      normalizarUpper(
        patrimonio.responsavel_nome
      ),

    recebedor_re:
      recebedorReNormalizado,

    recebedor_nome:
      recebedorNomeNormalizado,

    motivo:
      normalizarUpper(
        motivo
      ),

    observacao:
      normalizarTexto(
        observacao
      ),

    dados:
      dadosNormalizados,

    realizado_por_re:
      usuario.re,

    realizado_por_nome:
      usuario.nome,

    realizado_por_email:
      usuario.email,

    status_movimentacao:
      statusMovimentacao,

    created_at:
      agora
  }

  const movimentoInserido =
    await inserirMovimentacao(
      movimentacao
    )

  const atualizacaoPatrimonio = {
    updated_at:
      agora,

    atualizado_por:
      usuario.nome ??
      usuario.email ??
      null
  }

  if (statusNovoNormalizado) {
    atualizacaoPatrimonio.status =
      statusNovoNormalizado
  }

  if (localDestinoEstruturado.nome) {
    atualizacaoPatrimonio.local_atual =
      localDestinoEstruturado.nome
  }

  if (companhiaDestinoNormalizada) {
    atualizacaoPatrimonio.companhia_atual =
      companhiaDestinoNormalizada
  }

  if (recebedorReNormalizado) {
    atualizacaoPatrimonio.responsavel_atual_id =
      guardiaoDestino.id ??
      recebedorReNormalizado

    atualizacaoPatrimonio.responsavel_atual_nome =
      recebedorNomeNormalizado
  } else if (
    guardiaoDestino.tipo !==
    'POLICIAL'
  ) {
    atualizacaoPatrimonio.responsavel_atual_id =
      null

    atualizacaoPatrimonio.responsavel_atual_nome =
      guardiaoDestino.nome
  }

  const dadosPatrimonioAtualizados = {
    ...obterDadosPatrimonio(
      patrimonio
    ),

    guardiao_atual:
      guardiaoDestino,

    gestor_patrimonial:
      gestor,

    proprietario_patrimonial:
      proprietario,

    ultima_movimentacao: {
      id:
        movimentoInserido.id,

      protocolo,

      tipo:
        tipoNormalizado,

      quantidade,

      data_hora:
        agora
    }
  }

  if (recebedorReNormalizado) {
    dadosPatrimonioAtualizados.carga_policial_re =
      recebedorReNormalizado

    dadosPatrimonioAtualizados.carga_policial_nome =
      recebedorNomeNormalizado
  } else {
    dadosPatrimonioAtualizados.carga_policial_re =
      null

    dadosPatrimonioAtualizados.carga_policial_nome =
      null
  }

  atualizacaoPatrimonio.dados =
    dadosPatrimonioAtualizados

  const patrimonioAtualizado =
    await atualizarPatrimonio(
      patrimonioId,
      atualizacaoPatrimonio
    )

  return {
    sucesso:
      true,

    protocolo,

    patrimonio:
      mapearPatrimonio(
        patrimonioAtualizado
      ),

    movimentacao:
      mapearMovimentacao(
        movimentoInserido
      )
  }
}
export async function listarMovimentacoesPatrimoniais({
  patrimonioId = null,
  tipo = null,
  statusMovimentacao = null,
  protocolo = null,
  limite = 50
} = {}) {
  const limiteSeguro =
    Math.max(
      1,
      Math.min(
        Number(limite) || 50,
        500
      )
    )

  let query =
    supabase
      .from(
        TABELA_MOVIMENTACOES
      )
      .select('*')
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(
        limiteSeguro
      )

  if (patrimonioId) {
    query =
      query.eq(
        'patrimonio_id',
        patrimonioId
      )
  }

  if (tipo) {
    query =
      query.eq(
        'tipo_movimentacao',
        normalizarUpper(
          tipo
        )
      )
  }

  if (statusMovimentacao) {
    query =
      query.eq(
        'status_movimentacao',
        normalizarUpper(
          statusMovimentacao
        )
      )
  }

  if (protocolo) {
    query =
      query.eq(
        'protocolo',
        normalizarUpper(
          protocolo
        )
      )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return (
    data ?? []
  ).map(
    mapearMovimentacao
  )
}

export async function listarMovimentacoesDoItem({
  tipo,
  referenciaId,
  limite = 100
}) {
  if (!tipo) {
    throw new Error(
      'O tipo do patrimônio é obrigatório.'
    )
  }

  if (!referenciaId) {
    throw new Error(
      'A referência do patrimônio é obrigatória.'
    )
  }

  const patrimonio =
    await buscarPatrimonioPorReferencia({
      tipo,
      referenciaId
    })

  if (!patrimonio?.id) {
    return []
  }

  return listarMovimentacoesPatrimoniais({
    patrimonioId:
      patrimonio.id,

    limite
  })
}

export async function buscarMovimentacaoPorId(
  movimentacaoId
) {
  if (!movimentacaoId) {
    return null
  }

  const {
    data,
    error
  } = await supabase
    .from(
      TABELA_MOVIMENTACOES
    )
    .select('*')
    .eq(
      'id',
      movimentacaoId
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapearMovimentacao(
    data
  )
}

export async function buscarMovimentacaoPorProtocolo(
  protocolo
) {
  const protocoloNormalizado =
    normalizarUpper(
      protocolo
    )

  if (!protocoloNormalizado) {
    return null
  }

  const {
    data,
    error
  } = await supabase
    .from(
      TABELA_MOVIMENTACOES
    )
    .select('*')
    .eq(
      'protocolo',
      protocoloNormalizado
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapearMovimentacao(
    data
  )
}

export async function listarMovimentacoesPendentes({
  companhia = null,
  guardiaoCodigo = null,
  limite = 100
} = {}) {
  const limiteSeguro =
    Math.max(
      1,
      Math.min(
        Number(limite) || 100,
        500
      )
    )

  let query =
    supabase
      .from(
        TABELA_MOVIMENTACOES
      )
      .select('*')
      .in(
        'status_movimentacao',
        [
          STATUS_MOVIMENTACAO.PENDENTE,
          STATUS_MOVIMENTACAO.EM_ANDAMENTO
        ]
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )
      .limit(
        limiteSeguro
      )

  if (companhia) {
    query =
      query.eq(
        'companhia_destino',
        normalizarUpper(
          companhia
        )
      )
  }

  if (guardiaoCodigo) {
    query =
      query.eq(
        'destino_guardiao_codigo',
        normalizarUpper(
          guardiaoCodigo
        )
      )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return (
    data ?? []
  ).map(
    mapearMovimentacao
  )
}

export async function atualizarStatusMovimentacao({
  movimentacaoId,
  status,
  observacao = null,
  user = null
}) {
  if (!movimentacaoId) {
    throw new Error(
      'A movimentação é obrigatória.'
    )
  }

  const statusNormalizado =
    normalizarUpper(
      status
    )

  if (!statusNormalizado) {
    throw new Error(
      'O novo status da movimentação é obrigatório.'
    )
  }

  const statusPermitidos =
    Object.values(
      STATUS_MOVIMENTACAO
    )

  if (
    !statusPermitidos.includes(
      statusNormalizado
    )
  ) {
    throw new Error(
      'Status de movimentação inválido.'
    )
  }

  const movimentacaoAtual =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (!movimentacaoAtual) {
    throw new Error(
      'Movimentação não encontrada.'
    )
  }

  const usuario =
    normalizarUsuarioMovimentacao(
      user
    )

  const metadataAtual =
    normalizarObjeto(
      movimentacaoAtual.metadata,
      {}
    )

  const historicoStatus =
    Array.isArray(
      metadataAtual.historico_status
    )
      ? metadataAtual.historico_status
      : []

  const metadataAtualizada = {
    ...metadataAtual,

    historico_status: [
      ...historicoStatus,
      {
        status_anterior:
          movimentacaoAtual.status_movimentacao ??
          null,

        status_novo:
          statusNormalizado,

        observacao:
          normalizarTexto(
            observacao
          ),

        realizado_por:
          usuario,

        data_hora:
          agoraISO()
      }
    ]
  }

  const payload = {
    status_movimentacao:
      statusNormalizado,

    metadata:
      metadataAtualizada,

    updated_at:
      agoraISO()
  }

  if (observacao) {
    payload.observacao =
      normalizarTexto(
        observacao
      )
  }

  const {
    data,
    error
  } = await supabase
    .from(
      TABELA_MOVIMENTACOES
    )
    .update(
      payload
    )
    .eq(
      'id',
      movimentacaoId
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return mapearMovimentacao(
    data
  )
}

export async function concluirMovimentacao({
  movimentacaoId,
  observacao = null,
  user = null
}) {
  return atualizarStatusMovimentacao({
    movimentacaoId,

    status:
      STATUS_MOVIMENTACAO.CONCLUIDA,

    observacao,

    user
  })
}

export async function cancelarMovimentacao({
  movimentacaoId,
  motivo,
  user = null
}) {
  if (!normalizarTexto(motivo)) {
    throw new Error(
      'O motivo do cancelamento é obrigatório.'
    )
  }

  return atualizarStatusMovimentacao({
    movimentacaoId,

    status:
      STATUS_MOVIMENTACAO.CANCELADA,

    observacao:
      motivo,

    user
  })
}

export async function contarMovimentacoesPatrimoniais({
  patrimonioId = null,
  tipo = null,
  statusMovimentacao = null
} = {}) {
  let query =
    supabase
      .from(
        TABELA_MOVIMENTACOES
      )
      .select(
        'id',
        {
          count: 'exact',
          head: true
        }
      )

  if (patrimonioId) {
    query =
      query.eq(
        'patrimonio_id',
        patrimonioId
      )
  }

  if (tipo) {
    query =
      query.eq(
        'tipo_movimentacao',
        normalizarUpper(
          tipo
        )
      )
  }

  if (statusMovimentacao) {
    query =
      query.eq(
        'status_movimentacao',
        normalizarUpper(
          statusMovimentacao
        )
      )
  }

  const {
    count,
    error
  } = await query

  if (error) {
    throw error
  }

  return count ?? 0
}

export default {
  TIPOS_MOVIMENTACAO,
  STATUS_PATRIMONIO,
  STATUS_MOVIMENTACAO,

  normalizarRE,
  normalizarUsuarioMovimentacao,
  obterIdentificacaoPatrimonio,

  buscarPatrimonioPorId,
  buscarPatrimonioPorReferencia,

  registrarMovimentacao,

  listarMovimentacoesPatrimoniais,
  listarMovimentacoesDoItem,
  listarMovimentacoesPendentes,

  buscarMovimentacaoPorId,
  buscarMovimentacaoPorProtocolo,

  atualizarStatusMovimentacao,
  concluirMovimentacao,
  cancelarMovimentacao,

  contarMovimentacoesPatrimoniais
}