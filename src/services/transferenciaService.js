import { supabase } from './supabaseClient'

import {
  buscarPatrimonioPorReferencia,
  normalizarRE,
  registrarMovimentacao,
  STATUS_PATRIMONIO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

const MATERIAIS_TABLE = 'sigmo_materiais'

function maiusculo(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null
  }

  const texto = String(valor).trim()

  return texto
    ? texto.toUpperCase()
    : null
}

function texto(valor) {
  const valorNormalizado =
    String(valor ?? '').trim()

  return valorNormalizado || null
}

function erroDeColunaAusente(error) {
  const mensagem = String(
    error?.message ?? ''
  ).toLowerCase()

  return (
    mensagem.includes('local_atual') ||
    mensagem.includes('recebedor_re') ||
    mensagem.includes('recebedor_nome') ||
    mensagem.includes('schema cache') ||
    mensagem.includes('could not find')
  )
}

async function atualizarDestinoDoMaterial({
  materialId,
  localDestino,
  unidadeDestino,
  recebedorRE,
  recebedorNome
}) {
  const payloadCompleto = {
    local_atual: maiusculo(localDestino),
    unidade: maiusculo(unidadeDestino),
    recebedor_re: recebedorRE,
    recebedor_nome:
      maiusculo(recebedorNome)
  }

  let resultado = await supabase
    .from(MATERIAIS_TABLE)
    .update(payloadCompleto)
    .eq('id', materialId)
    .select()
    .single()

  if (!resultado.error) {
    return resultado.data
  }

  if (!erroDeColunaAusente(resultado.error)) {
    throw resultado.error
  }

  resultado = await supabase
    .from(MATERIAIS_TABLE)
    .update({
      unidade: maiusculo(unidadeDestino)
    })
    .eq('id', materialId)
    .select()
    .single()

  if (resultado.error) {
    throw resultado.error
  }

  return resultado.data
}

export async function transferirMaterial({
  materialId,

  localDestino,
  unidadeDestino,

  recebedorRE,
  recebedorNome,

  documento = '',
  motivo = 'TRANSFERÊNCIA DE MATERIAL',
  observacao = '',

  user = null
}) {
  if (!materialId) {
    throw new Error(
      'Selecione o material que será transferido.'
    )
  }

  if (!texto(localDestino)) {
    throw new Error(
      'Informe o local de destino.'
    )
  }

  if (!texto(unidadeDestino)) {
    throw new Error(
      'Informe a unidade de destino.'
    )
  }

  const re = normalizarRE(recebedorRE, {
    obrigatorio: true,
    campo: 'RE do recebedor'
  })

  if (!texto(recebedorNome)) {
    throw new Error(
      'Informe o nome do recebedor.'
    )
  }

  const patrimonio =
    await buscarPatrimonioPorReferencia({
      tipo: 'material',
      referenciaId: materialId
    })

  if (
    patrimonio.status ===
      STATUS_PATRIMONIO.BAIXADO ||
    patrimonio.status ===
      STATUS_PATRIMONIO.INATIVO
  ) {
    throw new Error(
      'Este patrimônio está baixado ou inativo e não pode ser transferido.'
    )
  }

  const movimentacao =
    await registrarMovimentacao({
      patrimonioId: patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO.TRANSFERENCIA,

      statusNovo:
        patrimonio.status ||
        STATUS_PATRIMONIO.ATIVO,

      localDestino,
      companhiaDestino: unidadeDestino,

      recebedorRE: re,
      recebedorNome,

      motivo:
        texto(motivo) ||
        'TRANSFERÊNCIA DE MATERIAL',

      observacao,

      dados: {
        modulo: 'MATERIAIS',
        material_id: materialId,
        documento: texto(documento)
      },

      user
    })

  const material =
    await atualizarDestinoDoMaterial({
      materialId,
      localDestino,
      unidadeDestino,
      recebedorRE: re,
      recebedorNome
    })

  return {
    material,

    patrimonio: {
      ...patrimonio,
      local_atual:
        maiusculo(localDestino),
      companhia_atual:
        maiusculo(unidadeDestino)
    },

    movimentacao
  }
}