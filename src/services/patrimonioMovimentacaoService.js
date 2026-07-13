import { supabase } from './supabaseClient'

const PATRIMONIOS_TABLE = 'sigmo_patrimonios'
const MOVIMENTACOES_TABLE = 'sigmo_patrimonio_movimentacoes'

export const TIPOS_MOVIMENTACAO = Object.freeze({
  CADASTRO: 'CADASTRO',
  EDICAO: 'EDICAO',
  RECEBIMENTO: 'RECEBIMENTO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  CAUTELA: 'CAUTELA',
  DEVOLUCAO: 'DEVOLUCAO',
  RECOLHIMENTO: 'RECOLHIMENTO',
  BAIXA: 'BAIXA',
  FOTO_ADICIONADA: 'FOTO_ADICIONADA',
  FOTO_REMOVIDA: 'FOTO_REMOVIDA',
  QR_CODE_GERADO: 'QR_CODE_GERADO',
  ETIQUETA_IMPRESSA: 'ETIQUETA_IMPRESSA',
  EXCLUSAO: 'EXCLUSAO'
})

export const STATUS_PATRIMONIO = Object.freeze({
  ATIVO: 'ATIVO',
  DISPONIVEL: 'DISPONIVEL',
  CAUTELADO: 'CAUTELADO',
  RECOLHIDO: 'RECOLHIDO',
  BAIXADO: 'BAIXADO',
  INATIVO: 'INATIVO'
})

function textoMaiusculo(valor) {
  if (valor === null || valor === undefined) {
    return null
  }

  const texto = String(valor).trim()

  return texto ? texto.toUpperCase() : null
}

function textoNormal(valor) {
  if (valor === null || valor === undefined) {
    return null
  }

  const texto = String(valor).trim()

  return texto || null
}

function somenteNumeros(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

export function normalizarRE(
  valor,
  {
    obrigatorio = false,
    campo = 'RE'
  } = {}
) {
  const re = somenteNumeros(valor)

  if (!re && !obrigatorio) {
    return null
  }

  if (!re && obrigatorio) {
    throw new Error(`${campo} é obrigatório.`)
  }

  if (re.length !== 6) {
    throw new Error(
      `${campo} deve possuir exatamente 6 dígitos.`
    )
  }

  return re
}

export function normalizarUsuarioMovimentacao(user = null) {
  const reBruto =
    user?.re ??
    user?.RE ??
    user?.matricula ??
    user?.registro ??
    user?.username ??
    ''

  const reNumerico = somenteNumeros(reBruto)

  return {
    re:
      reNumerico.length === 6
        ? reNumerico
        : null,

    nome: textoMaiusculo(
      user?.nome ??
      user?.name ??
      user?.nome_completo ??
      user?.displayName ??
      null
    ),

    email:
      textoNormal(user?.email)?.toLowerCase() ??
      null
  }
}

export function obterIdentificacaoPatrimonio(
  patrimonio
) {
  const dados = patrimonio?.dados ?? {}

  return (
    dados.patrimonio ||
    dados.numero_patrimonio ||
    dados.numero_serie ||
    dados.descricao ||
    dados.modelo ||
    patrimonio?.referencia_id ||
    patrimonio?.id ||
    'PATRIMÔNIO'
  )
}

export async function buscarPatrimonioPorId(
  patrimonioId
) {
  if (!patrimonioId) {
    throw new Error(
      'O ID do patrimônio é obrigatório.'
    )
  }

  const { data, error } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')
    .eq('id', patrimonioId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function buscarPatrimonioPorReferencia({
  tipo,
  referenciaId
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

  const { data, error } = await supabase
    .from(PATRIMONIOS_TABLE)
    .select('*')
    .eq(
      'tipo',
      String(tipo).trim().toLowerCase()
    )
    .eq('referencia_id', referenciaId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      'O registro patrimonial central não foi encontrado. ' +
      'Salve o cadastro novamente para sincronizá-lo.'
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

  const usuario =
    normalizarUsuarioMovimentacao(user)

  const recebedorReNormalizado =
    recebedorRE
      ? normalizarRE(recebedorRE, {
          campo: 'RE do recebedor'
        })
      : null

  const { data, error } = await supabase.rpc(
    'sigmo_registrar_movimentacao',
    {
      p_patrimonio_id: patrimonioId,
      p_tipo: textoMaiusculo(tipo),

      p_status_novo:
        textoMaiusculo(statusNovo),

      p_local_destino:
        textoMaiusculo(localDestino),

      p_companhia_destino:
        textoMaiusculo(companhiaDestino),

      p_recebedor_re:
        recebedorReNormalizado,

      p_recebedor_nome:
        textoMaiusculo(recebedorNome),

      p_motivo:
        textoMaiusculo(motivo),

      p_observacao:
        textoNormal(observacao),

      p_dados:
        dados ?? {},

      p_realizado_por_re:
        usuario.re,

      p_realizado_por_nome:
        usuario.nome,

      p_realizado_por_email:
        usuario.email
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarMovimentacoesPatrimoniais({
  patrimonioId = null,
  tipo = null,
  limite = 50
} = {}) {
  let query = supabase
    .from(MOVIMENTACOES_TABLE)
    .select('*')
    .order('created_at', {
      ascending: false
    })
    .limit(limite)

  if (patrimonioId) {
    query = query.eq(
      'patrimonio_id',
      patrimonioId
    )
  }

  if (tipo) {
    query = query.eq(
      'tipo',
      textoMaiusculo(tipo)
    )
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data ?? []
}

export async function listarMovimentacoesDoItem({
  tipo,
  referenciaId,
  limite = 100
}) {
  const patrimonio =
    await buscarPatrimonioPorReferencia({
      tipo,
      referenciaId
    })

  return listarMovimentacoesPatrimoniais({
    patrimonioId: patrimonio.id,
    limite
  })
}