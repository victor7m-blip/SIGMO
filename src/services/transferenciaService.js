import { supabase } from './supabaseClient'

import {
  buscarPatrimonioPorReferencia,
  normalizarRE,
  registrarMovimentacao,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

const MATERIAIS_TABLE = 'sigmo_materiais'

function maiusculo(valor) {
  if (valor === null || valor === undefined) return null

  const texto = String(valor).trim()

  return texto ? texto.toUpperCase() : null
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
    recebedor_nome: maiusculo(recebedorNome)
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
    mensagem.includes('local_atual') ||
    mensagem.includes('recebedor_re') ||
    mensagem.includes('recebedor_nome') ||
    mensagem.includes('schema cache')

  if (!colunaNaoExiste) {
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

  if (resultado.error) throw resultado.error

  return resultado.data
}

export async function transferirMaterial({
  materialId,

  localDestino,
  unidadeDestino,

  recebedorRE,
  recebedorNome,

  documento = '',
  motivo = 'TRANSFERÃŠNCIA DE MATERIAL',
  observacao = '',

  user = null
}) {
  if (!materialId) {
    throw new Error('Selecione o material que serÃ¡ transferido.')
  }

  if (!String(localDestino ?? '').trim()) {
    throw new Error('Informe o local de destino.')
  }

  if (!String(unidadeDestino ?? '').trim()) {
    throw new Error('Informe a unidade de destino.')
  }

  const re = normalizarRE(recebedorRE, {
    obrigatorio: true,
    campo: 'RE do recebedor'
  })

  if (!String(recebedorNome ?? '').trim()) {
    throw new Error('Informe o nome do recebedor.')
  }

  const patrimonio = await buscarPatrimonioPorReferencia({
    tipo: 'material',
    referenciaId: materialId
  })

  const movimentacao = await registrarMovimentacao({
    patrimonioId: patrimonio.id,

    tipo: TIPOS_MOVIMENTACAO.TRANSFERENCIA,
    statusNovo: patrimonio.status,

    localDestino,
    companhiaDestino: unidadeDestino,

    recebedorRE: re,
    recebedorNome,

    motivo,
    observacao,

    dados: {
      modulo: 'MATERIAIS',
      material_id: materialId,
      documento: String(documento ?? '').trim() || null
    },

    user
  })

  const material = await atualizarDestinoDoMaterial({
    materialId,
    localDestino,
    unidadeDestino,
    recebedorRE: re,
    recebedorNome
  })

  return {
    material,
    movimentacao
  }
}
