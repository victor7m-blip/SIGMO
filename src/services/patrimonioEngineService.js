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