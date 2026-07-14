import { supabase } from './supabaseClient'

import {
  buscarPatrimonioPorReferencia,
  normalizarRE,
  registrarMovimentacao,
  STATUS_PATRIMONIO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

const PATRIMONIOS_TABLE =
  'sigmo_patrimonios'

const LOCAL_RETORNO_PADRAO =
  'RESERVA DE MATERIAL'

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
  return normalizarRE(
    user?.re ||
    user?.user_metadata?.re ||
    '',
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

  return atualizados
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
      STATUS_PATRIMONIO.ATIVO,

    local_atual:
      maiusculo(localDestino),

    companhia_atual:
      maiusculo(unidadeDestino),

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
        STATUS_PATRIMONIO.ATIVO,

      local_atual:
        maiusculo(localDestino)
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

  const movimentacao =
    await registrarMovimentacao({
      patrimonioId:
        patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO.RECEBIMENTO,

      statusNovo:
        STATUS_PATRIMONIO.ATIVO,

      localDestino,

      companhiaDestino:
        unidadeDestino,

      recebedorRE:
        operadorRe,

      recebedorNome:
        operadorNome,

      motivo:
        'DEVOLUÇÃO DE MATERIAL À RESERVA',

      observacao,

      dados: {
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
          texto(documento)
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

  return {
    patrimonio:
      patrimonioAtualizado,

    registroReferencia,

    movimentacao
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