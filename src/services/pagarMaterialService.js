import { supabase } from './supabaseClient'

const FONTES_PATRIMONIAIS = [
  {
    modulo: 'MATERIAL',
    tabela: 'sigmo_materiais'
  },
  {
    modulo: 'ARMA',
    tabela: 'sigmo_armas'
  },
  {
    modulo: 'MUNIÇÃO',
    tabela: 'sigmo_municoes'
  }
]

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
}

function obterPatrimonio(registro) {
  return (
    registro?.patrimonio ||
    registro?.numero_patrimonio ||
    registro?.codigo ||
    registro?.qr_code ||
    registro?.id ||
    '-'
  )
}

function obterDescricao(registro, modulo) {
  if (registro?.descricao) {
    return registro.descricao
  }

  const partes = [
    registro?.especie,
    registro?.marca,
    registro?.modelo,
    registro?.calibre
  ].filter(Boolean)

  if (partes.length > 0) {
    return partes.join(' ')
  }

  return modulo
}

function obterCategoria(registro, modulo) {
  return (
    registro?.categoria ||
    registro?.tipo ||
    registro?.especie ||
    modulo
  )
}

function obterLocal(registro) {
  return (
    registro?.local_atual ||
    registro?.local ||
    registro?.unidade ||
    registro?.setor ||
    '-'
  )
}

function obterStatus(registro) {
  return normalizarTexto(
    registro?.status ||
    registro?.situacao ||
    'SEM STATUS'
  )
}

function registroDisponivel(registro) {
  const status = obterStatus(registro)

  return [
    'DISPONÍVEL',
    'DISPONIVEL',
    'ATIVO'
  ].includes(status)
}

function normalizarRegistro(
  registro,
  fonte
) {
  return {
    ...registro,

    id: registro.id,

    patrimonio_id: registro.id,

    patrimonio:
      normalizarTexto(
        obterPatrimonio(registro)
      ),

    descricao:
      normalizarTexto(
        obterDescricao(
          registro,
          fonte.modulo
        )
      ),

    categoria:
      normalizarTexto(
        obterCategoria(
          registro,
          fonte.modulo
        )
      ),

    local_atual:
      normalizarTexto(
        obterLocal(registro)
      ),

    status:
      obterStatus(registro),

    modulo:
      fonte.modulo,

    tabela_origem:
      fonte.tabela,

    disponivel:
      registroDisponivel(registro)
  }
}

async function consultarFonte(fonte) {
  const { data, error } = await supabase
    .from(fonte.tabela)
    .select('*')
    .order('created_at', {
      ascending: false
    })
    .limit(500)

  if (error) {
    console.warn(
      `Fonte patrimonial indisponível: ${fonte.tabela}`,
      error
    )

    return []
  }

  return (data || []).map((registro) =>
    normalizarRegistro(
      registro,
      fonte
    )
  )
}

export async function listarPatrimoniosParaEntrega({
  busca = '',
  apenasDisponiveis = false
} = {}) {
  const resultados =
    await Promise.all(
      FONTES_PATRIMONIAIS.map(
        consultarFonte
      )
    )

  let itens = resultados.flat()

  if (apenasDisponiveis) {
    itens = itens.filter(
      (item) => item.disponivel
    )
  }

  const termo =
    normalizarTexto(busca)

  if (termo) {
    itens = itens.filter((item) =>
      [
        item.patrimonio,
        item.descricao,
        item.categoria,
        item.local_atual,
        item.status,
        item.modulo,
        item.numero_serie,
        item.qr_code
      ].some((valor) =>
        normalizarTexto(valor).includes(
          termo
        )
      )
    )
  }

  return itens.sort((a, b) =>
    String(a.descricao).localeCompare(
      String(b.descricao),
      'pt-BR'
    )
  )
}

export async function buscarPatrimonioPorQrCode(
  valorQrCode
) {
  const valor =
    normalizarTexto(valorQrCode)

  if (!valor) {
    return null
  }

  const itens =
    await listarPatrimoniosParaEntrega({
      busca: valor
    })

  return (
    itens.find((item) =>
      [
        item.qr_code,
        item.patrimonio,
        item.numero_patrimonio,
        item.codigo,
        item.id
      ].some(
        (campo) =>
          normalizarTexto(campo) ===
          valor
      )
    ) ||
    itens[0] ||
    null
  )
}