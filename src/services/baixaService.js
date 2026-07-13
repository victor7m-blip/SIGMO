import { supabase } from './supabaseClient'

import {
  buscarPatrimonioPorReferencia,
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
    mensagem.includes('motivo_baixa') ||
    mensagem.includes('documento_baixa') ||
    mensagem.includes('data_baixa') ||
    mensagem.includes('local_atual') ||
    mensagem.includes('schema cache') ||
    mensagem.includes('could not find')
  )
}

async function atualizarMaterialBaixado({
  materialId,
  motivo,
  documento,
  dataBaixa
}) {
  const payloadCompleto = {
    status: STATUS_PATRIMONIO.BAIXADO,
    local_atual: 'BAIXADO',
    motivo_baixa: maiusculo(motivo),
    documento_baixa: texto(documento),
    data_baixa: dataBaixa
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
      status: STATUS_PATRIMONIO.BAIXADO
    })
    .eq('id', materialId)
    .select()
    .single()

  if (resultado.error) {
    throw resultado.error
  }

  return resultado.data
}

export async function baixarMaterial({
  materialId,

  motivo,
  documento = '',
  observacao = '',

  localDestino = 'BAIXADO',

  user = null
}) {
  if (!materialId) {
    throw new Error(
      'Selecione o material que será baixado.'
    )
  }

  if (!texto(motivo)) {
    throw new Error(
      'Informe o motivo da baixa.'
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
      'Este patrimônio já está baixado ou inativo.'
    )
  }

  const dataBaixa =
    new Date().toISOString()

  const movimentacao =
    await registrarMovimentacao({
      patrimonioId: patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO.BAIXA,

      statusNovo:
        STATUS_PATRIMONIO.BAIXADO,

      localDestino:
        texto(localDestino) ||
        'BAIXADO',

      companhiaDestino:
        patrimonio.companhia_atual,

      motivo,
      observacao,

      dados: {
        modulo: 'MATERIAIS',
        material_id: materialId,
        documento: texto(documento),
        data_baixa: dataBaixa
      },

      user
    })

  const material =
    await atualizarMaterialBaixado({
      materialId,
      motivo,
      documento,
      dataBaixa
    })

  return {
    material,

    patrimonio: {
      ...patrimonio,
      status:
        STATUS_PATRIMONIO.BAIXADO,
      local_atual: 'BAIXADO'
    },

    movimentacao
  }
}