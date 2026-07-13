import { supabase } from './supabaseClient'

import {
  buscarPatrimonioPorReferencia,
  registrarMovimentacao,
  STATUS_PATRIMONIO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

const MATERIAIS_TABLE = 'sigmo_materiais'

function maiusculo(valor) {
  if (valor === null || valor === undefined) return null

  const texto = String(valor).trim()

  return texto ? texto.toUpperCase() : null
}

async function atualizarMaterialBaixado({
  materialId,
  motivo,
  documento
}) {
  const payloadCompleto = {
    status: STATUS_PATRIMONIO.BAIXADO,
    motivo_baixa: maiusculo(motivo),
    documento_baixa: String(documento ?? '').trim() || null,
    data_baixa: new Date().toISOString()
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

  const mensagem = String(resultado.error.message ?? '')

  const colunaNaoExiste =
    mensagem.includes('motivo_baixa') ||
    mensagem.includes('documento_baixa') ||
    mensagem.includes('data_baixa') ||
    mensagem.includes('schema cache')

  if (!colunaNaoExiste) {
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

  if (resultado.error) throw resultado.error

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
    throw new Error('Selecione o material que serÃ¡ baixado.')
  }

  if (!String(motivo ?? '').trim()) {
    throw new Error('Informe o motivo da baixa.')
  }

  const patrimonio = await buscarPatrimonioPorReferencia({
    tipo: 'material',
    referenciaId: materialId
  })

  if (
    patrimonio.status === STATUS_PATRIMONIO.BAIXADO ||
    patrimonio.status === STATUS_PATRIMONIO.INATIVO
  ) {
    throw new Error('Este patrimÃ´nio jÃ¡ estÃ¡ baixado ou inativo.')
  }

  const movimentacao = await registrarMovimentacao({
    patrimonioId: patrimonio.id,

    tipo: TIPOS_MOVIMENTACAO.BAIXA,
    statusNovo: STATUS_PATRIMONIO.BAIXADO,

    localDestino,
    companhiaDestino: patrimonio.companhia_atual,

    motivo,
    observacao,

    dados: {
      modulo: 'MATERIAIS',
      material_id: materialId,
      documento: String(documento ?? '').trim() || null,
      data_baixa: new Date().toISOString()
    },

    user
  })

  const material = await atualizarMaterialBaixado({
    materialId,
    motivo,
    documento
  })

  return {
    material,
    movimentacao
  }
}
