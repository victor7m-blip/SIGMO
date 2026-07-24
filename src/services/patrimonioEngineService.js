import { supabase } from './supabaseClient'
import {
  obterNomeUsuario,
  registrarEventoPatrimonial,
  TIPOS_EVENTO_PATRIMONIAL
} from './eventoPatrimonialService'

function normalizarPayload(payload = {}) {
  const novoPayload = {}

  Object.entries(payload).forEach(([chave, valor]) => {
    novoPayload[chave] =
      typeof valor === 'string'
        ? valor.trim().toUpperCase()
        : valor
  })

  return novoPayload
}

function formatarNomeCampo(campo) {
  const nomes = {
    patrimonio: 'PATRIMÔNIO',
    numero_patrimonio: 'NÚMERO DO PATRIMÔNIO',
    descricao: 'DESCRIÇÃO',
    categoria: 'CATEGORIA',
    marca: 'MARCA',
    modelo: 'MODELO',
    numero_serie: 'NÚMERO DE SÉRIE',
    especie: 'ESPÉCIE',
    calibre: 'CALIBRE',
    status: 'STATUS',
    local_atual: 'LOCAL',
    unidade: 'UNIDADE',
    observacoes: 'OBSERVAÇÕES'
  }

  return (
    nomes[campo] ||
    campo.replaceAll('_', ' ').toUpperCase()
  )
}

function valorParaTexto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return '-'
  }

  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor)
    } catch {
      return String(valor)
    }
  }

  return String(valor)
}

function listarAlteracoes(
  antes = {},
  depois = {}
) {
  const ignorar = [
    'id',
    'created_at',
    'updated_at'
  ]

  return Object.keys(depois)
    .filter(
      (chave) => !ignorar.includes(chave)
    )
    .filter(
      (chave) =>
        valorParaTexto(antes?.[chave]) !==
        valorParaTexto(depois?.[chave])
    )
    .map((chave) => ({
      campo: chave,
      anterior:
        valorParaTexto(antes?.[chave]),
      novo:
        valorParaTexto(depois?.[chave])
    }))
}

async function registrarAlteracoes({
  patrimonioId,
  antes,
  depois,
  usuario
}) {
  const alteracoes =
    listarAlteracoes(antes, depois)

  if (alteracoes.length === 0) {
    await registrarEventoPatrimonial({
      tipo:
        TIPOS_EVENTO_PATRIMONIAL.EDICAO,
      patrimonioId,
      usuario,
      descricao:
        `${obterNomeUsuario(usuario)} atualizou o registro.`
    })

    return
  }

  for (const alteracao of alteracoes) {
    const nomeCampo =
      formatarNomeCampo(alteracao.campo)

    let tipoEvento =
      TIPOS_EVENTO_PATRIMONIAL.EDICAO

    if (alteracao.campo === 'status') {
      tipoEvento =
        TIPOS_EVENTO_PATRIMONIAL.STATUS
    }

    if (alteracao.campo === 'local_atual') {
      tipoEvento =
        TIPOS_EVENTO_PATRIMONIAL.LOCAL
    }

    await registrarEventoPatrimonial({
      tipo: tipoEvento,
      patrimonioId,
      usuario,
      descricao:
        `${obterNomeUsuario(usuario)} alterou ` +
        `${nomeCampo}: ` +
        `${alteracao.anterior} → ` +
        `${alteracao.novo}.`,
      metadata: {
        campo: alteracao.campo,
        valorAnterior: alteracao.anterior,
        valorNovo: alteracao.novo
      }
    })
  }
}

export async function listarPatrimoniosEngine(
  config
) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw error
  }

  return data || []
}

export async function buscarPatrimonioEnginePorId(
  config,
  id
) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function cadastrarPatrimonioEngine(
  config,
  payload,
  user = null
) {
  const payloadNormalizado =
    normalizarPayload(payload)

  const { data, error } = await supabase
    .from(config.tabela)
    .insert([payloadNormalizado])
    .select()
    .single()

  if (error) {
    throw error
  }

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL.CADASTRO,
    patrimonioId: data.id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} cadastrou o patrimônio.`,
    metadata: {
      tabela: config.tabela
    }
  })

  return data
}

export async function atualizarPatrimonioEngine(
  config,
  id,
  payload,
  user = null
) {
  const antes =
    await buscarPatrimonioEnginePorId(
      config,
      id
    )

  const payloadNormalizado =
    normalizarPayload(payload)

  const { data, error } = await supabase
    .from(config.tabela)
    .update(payloadNormalizado)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  await registrarAlteracoes({
    patrimonioId: id,
    antes,
    depois: data,
    usuario: user
  })

  return data
}

export async function excluirPatrimonioEngine(
  config,
  id,
  user = null
) {
  const antes =
    await buscarPatrimonioEnginePorId(
      config,
      id
    )

  await registrarEventoPatrimonial({
    tipo:
      TIPOS_EVENTO_PATRIMONIAL.EXCLUSAO,
    patrimonioId: id,
    usuario: user,
    descricao:
      `${obterNomeUsuario(user)} excluiu o registro: ` +
      `${
        antes?.patrimonio ||
        antes?.numero_patrimonio ||
        antes?.descricao ||
        id
      }.`,
    metadata: {
      tabela: config.tabela,
      registro: antes
    }
  })

  const { error } = await supabase
    .from(config.tabela)
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }

  return true
}

/*
 * =====================================================
 * PATRIMÔNIO ENGINE 7.6.2
 * =====================================================
 *
 * Estas funções utilizam as tabelas centrais:
 * - sigmo_patrimonio_itens
 * - sigmo_patrimonio_lotes
 * - sigmo_patrimonio_movimentacoes
 * - sigmo_patrimonio_saldos
 */

function textoEngine(valor) {
  return String(valor ?? '').trim()
}

function maiusculoEngine(valor) {
  return textoEngine(valor).toUpperCase()
}

function numeroEngine(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return numero
}

function obterUsuarioEngine(user = null) {
  return {
    id:
      user?.id ||
      user?.user_id ||
      user?.usuario_id ||
      user?.usuario?.id ||
      null,

    nome:
      textoEngine(
        user?.nome_guerra ||
          user?.nome ||
          user?.name ||
          user?.email ||
          user?.usuario?.nome_guerra ||
          user?.usuario?.nome
      ) || null
  }
}

export async function buscarItemPatrimonialEnginePorCodigo(
  codigo
) {
  const codigoNormalizado =
    maiusculoEngine(codigo)

  if (!codigoNormalizado) {
    throw new Error(
      'Código do item patrimonial não informado.'
    )
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonio_itens')
    .select('*')
    .eq('codigo', codigoNormalizado)
    .eq('ativo', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error(
      `Item patrimonial ${codigoNormalizado} não encontrado na Engine.`
    )
  }

  return data
}

export async function receberPatrimonio({
  itemId,
  quantidade,
  natureza = 'PROPRIO',

  proprietario = {},
  gestor = {},
  guardiao = {},
  local = {},
  origem = {},
  documento = {},

  codigoLote = null,
  dataRecebimento = null,
  observacoes = null,
  metadata = {},
  user = null
}) {
  const quantidadeNormalizada =
    numeroEngine(quantidade)

  if (!itemId) {
    throw new Error(
      'Item patrimonial não informado.'
    )
  }

  if (quantidadeNormalizada <= 0) {
    throw new Error(
      'A quantidade deve ser maior que zero.'
    )
  }

  const usuario =
    obterUsuarioEngine(user)

  const { data, error } = await supabase.rpc(
    'sigmo_receber_patrimonio',
    {
      p_item_id:
        itemId,

      p_quantidade:
        quantidadeNormalizada,

      p_natureza:
        maiusculoEngine(natureza) ||
        'PROPRIO',

      p_proprietario_tipo:
        maiusculoEngine(proprietario.tipo) ||
        'PMESP',

      p_proprietario_id:
        textoEngine(proprietario.id) ||
        null,

      p_proprietario_nome:
        maiusculoEngine(proprietario.nome) ||
        'PMESP',

      p_gestor_tipo:
        maiusculoEngine(gestor.tipo) ||
        'P4',

      p_gestor_id:
        textoEngine(gestor.id) ||
        null,

      p_gestor_nome:
        maiusculoEngine(gestor.nome) ||
        'P4',

      p_guardiao_tipo:
        maiusculoEngine(guardiao.tipo) ||
        'P4',

      p_guardiao_id:
        textoEngine(guardiao.id) ||
        null,

      p_guardiao_nome:
        maiusculoEngine(guardiao.nome) ||
        'P4',

      p_local_tipo:
        maiusculoEngine(local.tipo) ||
        'SETOR',

      p_local_id:
        textoEngine(local.id) ||
        null,

      p_local_nome:
        maiusculoEngine(local.nome) ||
        'P4',

      p_origem_tipo:
        maiusculoEngine(origem.tipo) ||
        null,

      p_origem_id:
        textoEngine(origem.id) ||
        null,

      p_origem_nome:
        maiusculoEngine(origem.nome) ||
        null,

      p_documento_tipo:
        maiusculoEngine(documento.tipo) ||
        null,

      p_documento_numero:
        textoEngine(documento.numero) ||
        null,

      p_documento_data:
        documento.data ||
        null,

      p_codigo_lote:
        maiusculoEngine(codigoLote) ||
        null,

      p_data_recebimento:
        dataRecebimento ||
        null,

      p_observacoes:
        textoEngine(observacoes) ||
        null,

      p_metadata:
        metadata && typeof metadata === 'object'
          ? metadata
          : {},

      p_usuario_id:
        usuario.id,

      p_usuario_nome:
        usuario.nome
    }
  )

  if (error) {
    throw error
  }

  if (!data?.sucesso) {
    throw new Error(
      data?.mensagem ||
        'Não foi possível receber o patrimônio.'
    )
  }

  return data
}

export async function receberPatrimonioPorCodigo({
  codigoItem,
  ...dados
}) {
  const item =
    await buscarItemPatrimonialEnginePorCodigo(
      codigoItem
    )

  const resultado =
    await receberPatrimonio({
      ...dados,
      itemId: item.id,
      metadata: {
        ...(dados.metadata || {}),
        item_codigo:
          item.codigo,
        item_categoria:
          item.categoria,
        item_nome:
          item.nome
      }
    })

  return {
    item,
    ...resultado
  }
}

