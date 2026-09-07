import { useEffect, useMemo, useState } from 'react'

import { supabase } from '../../../services/supabaseClient'
import { loadSessionToken } from '../../../services/authService'

import {
  listarPatrimoniosParaEntrega,
  montarKitUltimoRecebido
} from '../../../services/pagarMaterialService'

import {
  buscarUltimaCautelaRecebidaPolicial
} from '../../../services/cautelasUsuarioService'

import {
  criarMovimentacaoCompleta
} from '../../../services/movimentacaoEngine'

import {
  carregarMapaEmElaboracao,
  listarCautelasMapaForca,
  registrarCautelaMapaForca
} from '../../../services/mapaForcaService'

import {
  cautelarMunicaoParaPolicial
} from '../../../services/municoesMovimentacoesService'

const ORIGEM_SVDD = 'COFRE DO SVDD'
const DESTINO_CAUTELA = 'CAUTELA INDIVIDUAL'

const TIPOS_MATERIAL = [
  { id: 'ARMAS', label: 'Armas' },
  { id: 'HT', label: 'HT' },
  { id: 'TASER', label: 'Taser' },
  { id: 'TPD', label: 'TPD' },
  { id: 'COP', label: 'COP' },
  { id: 'MUNICAO', label: 'Munição' },
  { id: 'TONFA', label: 'Tonfa' },
  { id: 'CASSETETE', label: 'Cassetete' }
]

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    policial?.re ||
    'POLICIAL'
  )
}

function criarChaveItem(item) {
  return [
    item?.tabela_origem || 'material',
    item?.id
  ].join(':')
}

function ehArma(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tipo_patrimonio,
    item?.tabela_origem
  ].map(normalizarTexto)

  return (
    campos.includes('ARMA') ||
    campos.includes('ARMAS') ||
    campos.includes('SIGMO_ARMAS')
  )
}

function ehHT(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ].map(normalizarTexto)

  return (
    campos.includes('HT') ||
    campos.includes('HTS') ||
    campos.includes('SIGMO_HTS')
  )
}

function ehTaser(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ].map(normalizarTexto)

  const descricao =
    normalizarTexto(
      item?.descricao
    )

  return (
    campos.includes('TASER') ||
    campos.includes('TASERS') ||
    campos.includes('SIGMO_TASERS') ||
    descricao.startsWith('TASER')
  )
}

function ehTPD(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ].map(normalizarTexto)

  const descricao =
    normalizarTexto(
      item?.descricao
    )

  return (
    campos.includes('TPD') ||
    campos.includes('TPDS') ||
    campos.includes('SIGMO_TPDS') ||
    descricao.startsWith('TPD')
  )
}

function ehCOP(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ].map(normalizarTexto)

  const descricao =
    normalizarTexto(
      item?.descricao
    )

  return (
    campos.includes('COP') ||
    campos.includes('COPS') ||
    campos.includes('SIGMO_COPS') ||
    descricao.startsWith('COP ')
  )
}

function ehMunicao(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ].map(normalizarTexto)

  const descricao =
    normalizarTexto(
      item?.descricao
    )

  return (
    Boolean(item?.municao_id) ||
    campos.includes('MUNICAO') ||
    campos.includes('MUNICOES') ||
    campos.includes('SIGMO_MUNICOES') ||
    descricao.startsWith('MUNICAO ')
  )
}

function ehTonfa(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.descricao
  ].map(normalizarTexto)

  return campos.some(
    (valor) =>
      valor.includes('TONFA')
  )
}

function ehCassetete(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.descricao
  ].map(normalizarTexto)

  return campos.some(
    (valor) =>
      valor.includes('CASSETETE')
  )
}

function correspondeTipo(item, tipo) {
  switch (tipo) {
    case 'ARMAS':
      return ehArma(item)
    case 'HT':
      return ehHT(item)
    case 'TASER':
      return ehTaser(item)
    case 'TPD':
      return ehTPD(item)
    case 'COP':
      return ehCOP(item)
    case 'MUNICAO':
      return ehMunicao(item)
    case 'TONFA':
      return ehTonfa(item)
    case 'CASSETETE':
      return ehCassetete(item)
    default:
      return false
  }
}

function rotuloItem(item) {
  if (ehMunicao(item)) {
    return (
      item?.descricao ||
      `MUNIÇÃO ${item?.calibre || ''}`.trim()
    )
  }

  if (ehArma(item)) {
    return [
      item?.especie || 'ARMA',
      item?.marca,
      item?.modelo,
      item?.patrimonio ||
        item?.numero_serie
    ]
      .map((valor) =>
        String(valor ?? '').trim()
      )
      .filter(Boolean)
      .join(' • ')
  }

  return (
    item?.descricao ||
    item?.categoria ||
    item?.patrimonio ||
    'MATERIAL'
  )
}

function obterCalibreItem(item) {
  return (
    item?.calibre ||
    item?.calibre_arma ||
    item?.calibre_municao ||
    item?.dados?.calibre ||
    ''
  )
}

function calibreCanonico(valor) {
  const texto =
    normalizarTexto(valor)
      .replace(
        /^CALIBRE\s+/,
        ''
      )

  if (!texto) {
    return ''
  }

  if (
    /(^|\D)5[.,]?56(\D|$)/.test(
      texto
    ) ||
    texto.includes('556X45')
  ) {
    return '556'
  }

  if (
    /(^|\D)7[.,]?62(\D|$)/.test(
      texto
    )
  ) {
    return '762'
  }

  if (
    texto.includes('380')
  ) {
    return '380'
  }

  if (
    texto.includes('40 S&W') ||
    texto.includes('40SW') ||
    /(^|\D)\.?40(\D|$)/.test(
      texto
    )
  ) {
    return '40'
  }

  if (
    texto.includes('45 ACP') ||
    /(^|\D)\.?45(\D|$)/.test(
      texto
    )
  ) {
    return '45'
  }

  if (
    texto.includes('38 SPL') ||
    texto.includes('38 SPECIAL') ||
    /(^|\D)\.?38(\D|$)/.test(
      texto
    )
  ) {
    return '38'
  }

  if (
    texto.includes('9X19') ||
    /(^|\D)9\s*MM(\D|$)/.test(
      texto
    ) ||
    /(^|\D)9(\D|$)/.test(
      texto
    )
  ) {
    return '9'
  }

  if (
    texto.includes('CAL 12') ||
    texto.includes('GAUGE 12') ||
    /(^|\D)12(\D|$)/.test(
      texto
    )
  ) {
    return '12'
  }

  return texto.replace(
    /[^A-Z0-9]/g,
    ''
  )
}

function calibresCompativeis(
  arma,
  municao
) {
  const calibreArma =
    calibreCanonico(
      obterCalibreItem(
        arma
      )
    )

  const calibreMunicao =
    calibreCanonico(
      obterCalibreItem(
        municao
      )
    )

  return Boolean(
    calibreArma &&
    calibreMunicao &&
    calibreArma ===
      calibreMunicao
  )
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(numero)
  )
}

function isoValido(valor) {
  if (!valor) {
    return null
  }

  const data =
    new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return null
  }

  return data.toISOString()
}

function formatarHora(valor) {
  if (!valor) {
    return '—'
  }

  const data =
    new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return '—'
  }

  return data.toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  )
}



function normalizarComparacao(valor) {
  return normalizarTexto(valor)
    .replace(/\s+/g, ' ')
}

function cautelaPertenceAoContexto(
  cautela,
  policial,
  funcao,
  unidade
) {
  if (
    !cautela?.ativa ||
    !policial?.id ||
    String(cautela?.policial_id || '') !==
      String(policial.id)
  ) {
    return false
  }

  const usAtual =
    String(
      unidade?.id ||
      ''
    )

  const usCautela =
    String(
      cautela?.us_id ||
      ''
    )

  /*
   * US já salva: vínculo exato pelo UUID.
   * Isso impede uma nova escala de herdar uma cautela antiga
   * somente porque o policial/função/prefixo são iguais.
   */
  if (
    usAtual &&
    !usAtual.startsWith('nova-')
  ) {
    return Boolean(
      usCautela &&
      usAtual === usCautela
    )
  }

  /*
   * US ainda não salva:
   * criarUnidade() usa "nova-<Date.now()>". A cautela só pode
   * pertencer a esta montagem se tiver sido criada depois desse
   * instante e ainda não possuir us_id definitivo.
   */
  if (
    !usAtual.startsWith('nova-') ||
    usCautela
  ) {
    return false
  }

  const criadaEmMs =
    Number(
      usAtual.replace(
        /^nova-/,
        ''
      )
    )

  const cautelaCriadaEmMs =
    new Date(
      cautela?.created_at ||
      0
    ).getTime()

  if (
    !Number.isFinite(criadaEmMs) ||
    criadaEmMs <= 0 ||
    !Number.isFinite(cautelaCriadaEmMs) ||
    cautelaCriadaEmMs < criadaEmMs
  ) {
    return false
  }

  const funcaoAtual =
    normalizarComparacao(
      funcao
    )

  const funcaoCautela =
    normalizarComparacao(
      cautela?.funcao
    )

  const prefixoAtual =
    normalizarComparacao(
      unidade?.prefixo
    )

  const prefixoCautela =
    normalizarComparacao(
      cautela?.prefixo_us
    )

  const mesmaFuncao =
    !funcaoAtual ||
    !funcaoCautela ||
    funcaoAtual ===
      funcaoCautela

  const mesmoPrefixo =
    !prefixoAtual ||
    !prefixoCautela ||
    prefixoAtual ===
      prefixoCautela

  return (
    mesmaFuncao &&
    mesmoPrefixo
  )
}

function rotuloResumoPago(item) {
  const quantidade =
    Math.max(
      1,
      Number(
        item?.quantidade ||
        1
      ) || 1
    )

  const descricao =
    String(
      item?.descricao ||
      item?.categoria ||
      item?.tipo ||
      'MATERIAL'
    ).trim()

  return quantidade > 1
    ? `${descricao} • ${quantidade} UN`
    : descricao
}


function mesmoItemJaPago(
  atual,
  pago
) {
  if (!atual || !pago) {
    return false
  }

  if (
    atual?.patrimonio_id &&
    pago?.patrimonio_id &&
    String(atual.patrimonio_id) ===
      String(pago.patrimonio_id)
  ) {
    return true
  }

  const atualEhMunicao =
    ehMunicao(atual)

  const pagoEhMunicao =
    ehMunicao(pago)

  if (
    atualEhMunicao &&
    pagoEhMunicao
  ) {
    const idAtual =
      String(
        atual?.municao_id ||
        atual?.referencia_id ||
        ''
      )

    const idPago =
      String(
        pago?.municao_id ||
        pago?.referencia_id ||
        ''
      )

    if (
      idAtual &&
      idPago &&
      idAtual === idPago
    ) {
      return true
    }

    return Boolean(
      calibreCanonico(
        obterCalibreItem(atual)
      ) &&
      calibreCanonico(
        obterCalibreItem(atual)
      ) ===
        calibreCanonico(
          obterCalibreItem(pago)
        )
    )
  }

  const atualTonfa =
    atual?.tonfa_id ||
    (
      ehTonfa(atual) ||
      ehCassetete(atual)
        ? atual?.referencia_id
        : null
    )

  const pagoTonfa =
    pago?.tonfa_id ||
    (
      ehTonfa(pago) ||
      ehCassetete(pago)
        ? pago?.referencia_id
        : null
    )

  if (
    atualTonfa &&
    pagoTonfa &&
    String(atualTonfa) ===
      String(pagoTonfa)
  ) {
    return true
  }

  return false
}

function retirarQuantidadeJaPaga({
  selecionados,
  itensJaPagos
}) {
  const pagos =
    Array.isArray(itensJaPagos)
      ? itensJaPagos
      : []

  return (selecionados || [])
    .map((item) => {
      const correspondentes =
        pagos.filter(
          (pago) =>
            mesmoItemJaPago(
              item,
              pago
            )
        )

      if (
        correspondentes.length === 0
      ) {
        return item
      }

      if (
        !item?.controla_quantidade
      ) {
        return null
      }

      const quantidadePaga =
        correspondentes.reduce(
          (total, pago) =>
            total +
            Math.max(
              1,
              numeroInteiro(
                pago?.quantidade ||
                1
              ) || 1
            ),
          0
        )

      const quantidadeRestante =
        Math.max(
          0,
          numeroInteiro(
            item?.quantidade ||
            1
          ) -
          quantidadePaga
        )

      if (
        quantidadeRestante <= 0
      ) {
        return null
      }

      return {
        ...item,
        quantidade:
          quantidadeRestante
      }
    })
    .filter(Boolean)
}

function rotuloIndisponivelUltimo(
  item
) {
  const quantidade =
    Math.max(
      1,
      numeroInteiro(
        item?.quantidade ||
        1
      ) || 1
    )

  const descricao =
    String(
      item?.descricao ||
      item?.tipo ||
      'MATERIAL'
    ).trim()

  return quantidade > 1
    ? `${descricao} • ${quantidade} UN`
    : descricao
}

async function listarDisponibilidadeAtualMunicoesSvdd() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_disponiveis_svdd',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data
    : []
}

function aplicarDisponibilidadeMunicoes(
  lista,
  disponibilidades
) {
  const mapa =
    new Map(
      (disponibilidades || [])
        .map((registro) => [
          String(
            registro?.municao_id ||
            ''
          ),
          registro
        ])
        .filter(
          ([id]) =>
            Boolean(id)
        )
    )

  return (lista || []).map(
    (item) => {
      if (!ehMunicao(item)) {
        return item
      }

      const municaoId =
        String(
          item?.municao_id ||
          item?.referencia_id ||
          item?.id ||
          ''
        )

      const disponibilidade =
        mapa.get(
          municaoId
        )

      if (!disponibilidade) {
        return {
          ...item,
          quantidade_disponivel:
            0,
          quantidade_maxima:
            0,
          quantidade_fisica:
            0,
          quantidade_reservada:
            0,
          disponivel:
            false
        }
      }

      const fisica =
        numeroInteiro(
          disponibilidade
            ?.quantidade_fisica
        )

      const reservada =
        numeroInteiro(
          disponibilidade
            ?.quantidade_reservada
        )

      const disponivel =
        numeroInteiro(
          disponibilidade
            ?.quantidade_disponivel
        )

      return {
        ...item,

        quantidade_fisica:
          fisica,

        quantidade_reservada:
          reservada,

        quantidade_disponivel:
          disponivel,

        quantidade_maxima:
          disponivel,

        disponivel:
          disponivel > 0
      }
    }
  )
}


function chaveReservaMaterial(item) {
  if (!item) {
    return ''
  }

  if (ehMunicao(item)) {
    const municaoId =
      String(
        item?.municao_id ||
        item?.referencia_id ||
        ''
      ).trim()

    if (municaoId) {
      return `MUNICAO:${municaoId}`
    }

    const calibre =
      calibreCanonico(
        obterCalibreItem(item)
      )

    return calibre
      ? `MUNICAO-CALIBRE:${calibre}`
      : ''
  }

  const tonfaId =
    item?.tonfa_id ||
    (
      ehTonfa(item) ||
      ehCassetete(item)
        ? item?.referencia_id
        : null
    )

  if (
    item?.controla_quantidade &&
    tonfaId
  ) {
    return `QUANTITATIVO:${String(
      tonfaId
    )}`
  }

  if (item?.patrimonio_id) {
    return `PATRIMONIO:${String(
      item.patrimonio_id
    )}`
  }

  if (item?.id) {
    return [
      'ITEM',
      item?.tabela_origem ||
        item?.modulo ||
        item?.categoria ||
        'MATERIAL',
      item.id
    ].join(':')
  }

  return ''
}

function quantidadeReservadaMapa(
  item,
  itensReservados
) {
  const chave =
    chaveReservaMaterial(
      item
    )

  if (!chave) {
    return 0
  }

  return (
    itensReservados ||
    []
  ).reduce(
    (total, reservado) => {
      if (
        chaveReservaMaterial(
          reservado
        ) !== chave
      ) {
        return total
      }

      return (
        total +
        Math.max(
          1,
          numeroInteiro(
            reservado?.quantidade ||
            1
          ) || 1
        )
      )
    },
    0
  )
}

function aplicarReservasLocaisMapa(
  lista,
  itensReservados
) {
  const reservas =
    Array.isArray(
      itensReservados
    )
      ? itensReservados
      : []

  if (
    reservas.length ===
    0
  ) {
    return lista || []
  }

  return (lista || []).map(
    (item) => {
      const reservada =
        quantidadeReservadaMapa(
          item,
          reservas
        )

      if (
        reservada <= 0
      ) {
        return item
      }

      if (
        item?.controla_quantidade
      ) {
        const disponivelBase =
          Math.max(
            0,
            numeroInteiro(
              item?.quantidade_disponivel ??
              item?.quantidade_maxima ??
              0
            )
          )

        const disponivel =
          Math.max(
            0,
            disponivelBase -
            reservada
          )

        return {
          ...item,
          quantidade_reservada_mapa:
            reservada,
          quantidade_disponivel:
            disponivel,
          quantidade_maxima:
            disponivel,
          disponivel:
            disponivel > 0
        }
      }

      return {
        ...item,
        quantidade_reservada_mapa:
          reservada,
        disponivel:
          false
      }
    }
  )
}

function mesclarSelecaoSemDuplicar(
  atuais,
  novos
) {
  const resultado = [
    ...(
      Array.isArray(atuais)
        ? atuais
        : []
    )
  ]

  for (
    const novo of
    Array.isArray(novos)
      ? novos
      : []
  ) {
    const chaveNovo =
      chaveReservaMaterial(
        novo
      ) ||
      criarChaveItem(
        novo
      )

    const existe =
      resultado.some(
        (item) =>
          (
            chaveReservaMaterial(
              item
            ) ||
            criarChaveItem(
              item
            )
          ) === chaveNovo
      )

    if (!existe) {
      resultado.push(
        novo
      )
    }
  }

  return resultado
}


function resumirItemPago(item) {
  return {
    id:
      item?.id ||
      null,

    patrimonio_id:
      item?.patrimonio_id ||
      null,

    referencia_id:
      item?.referencia_id ||
      null,

    municao_id:
      item?.municao_id ||
      null,

    tabela_origem:
      item?.tabela_origem ||
      null,

    modulo:
      item?.modulo ||
      null,

    categoria:
      item?.categoria ||
      item?.tipo ||
      null,

    tipo:
      item?.tipo ||
      null,

    descricao:
      rotuloItem(item),

    patrimonio:
      item?.patrimonio ||
      item?.numero_serie ||
      null,

    calibre:
      item?.calibre ||
      null,

    quantidade:
      Math.max(
        1,
        Number(
          item?.quantidade ||
          1
        ) || 1
      )
  }
}

function extrairIdsTransferenciaMunicao(resultado) {
  const ids =
    new Set()

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  function adicionar(valor) {
    if (
      typeof valor !== 'string'
    ) {
      return
    }

    const texto =
      valor.trim()

    if (
      uuidRegex.test(texto)
    ) {
      ids.add(texto)
    }
  }

  function visitar(valor) {
    if (!valor) {
      return
    }

    if (
      typeof valor === 'string'
    ) {
      adicionar(valor)
      return
    }

    if (
      Array.isArray(valor)
    ) {
      for (const item of valor) {
        visitar(item)
      }
      return
    }

    if (
      typeof valor !== 'object'
    ) {
      return
    }

    /*
     * O retorno da RPC de munição pode variar entre jsonb,
     * registro Supabase ou objeto já tratado pelo service.
     * Cada campo é lido isoladamente para que um formato
     * inesperado nunca interrompa uma cautela já criada.
     */
    const camposDiretos = [
      'transferencia_id',
      'transferenciaId',
      'id_transferencia'
    ]

    for (const campo of camposDiretos) {
      try {
        adicionar(
          valor?.[campo]
        )
      } catch (error) {
        console.warn(
          `Retorno de munição sem o campo ${campo}:`,
          error
        )
      }
    }

    try {
      const transferencia =
        valor?.transferencia

      if (
        typeof transferencia === 'string'
      ) {
        adicionar(
          transferencia
        )
      } else if (
        transferencia &&
        typeof transferencia === 'object'
      ) {
        try {
          adicionar(
            transferencia?.id
          )
        } catch (error) {
          console.warn(
            'Não foi possível ler o ID da transferência de munição:',
            error
          )
        }
      }
    } catch (error) {
      console.warn(
        'Retorno de munição sem objeto transferencia:',
        error
      )
    }

    /*
     * Só percorre estruturas conhecidas. Não faz mais varredura
     * recursiva indiscriminada do objeto retornado pela RPC.
     */
    for (const campo of [
      'data',
      'resultado',
      'transferencias'
    ]) {
      try {
        const interno =
          valor?.[campo]

        if (
          interno &&
          interno !== valor
        ) {
          visitar(
            interno
          )
        }
      } catch (error) {
        console.warn(
          `Não foi possível ler ${campo} do retorno da munição:`,
          error
        )
      }
    }
  }

  try {
    visitar(
      resultado
    )
  } catch (error) {
    /*
     * A ausência do ID no retorno não bloqueia o fluxo.
     * Para cautelas patrimoniais + munição, o SIGMO consulta
     * logo depois as transferências pelo movimentacao_principal_id.
     */
    console.warn(
      'Não foi possível extrair o ID diretamente do retorno da munição:',
      error
    )
  }

  return Array.from(
    ids
  )
}

async function localizarTransferenciasMunicaoVinculadas(
  movimentacaoPrincipalId
) {
  if (!movimentacaoPrincipalId) {
    return []
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_municoes_listar_vinculadas_movimentacoes',
      {
        p_token:
          token,

        p_movimentacao_ids: [
          movimentacaoPrincipalId
        ]
      }
    )

  if (error) {
    console.warn(
      'Não foi possível complementar os IDs das munições vinculadas:',
      error
    )

    return []
  }

  return (data || [])
    .map(
      (registro) =>
        registro?.transferencia_id ||
        registro?.id ||
        null
    )
    .filter(Boolean)
}

async function resolverPatrimonioIdItem(
  item
) {
  if (item?.patrimonio_id) {
    return item.patrimonio_id
  }

  if (
    !item?.controla_quantidade ||
    !item?.tonfa_id
  ) {
    return null
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_patrimonios')
    .select('id')
    .eq(
      'tipo',
      'tonfa'
    )
    .eq(
      'referencia_id',
      item.tonfa_id
    )
    .eq(
      'ativo',
      true
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      `O registro patrimonial de ${rotuloItem(item)} não foi localizado.`
    )
  }

  return data.id
}

async function prepararItensPatrimoniais(
  itens
) {
  const preparados = []

  for (const item of itens) {
    const patrimonioId =
      await resolverPatrimonioIdItem(
        item
      )

    if (!patrimonioId) {
      throw new Error(
        `Não foi possível identificar ${rotuloItem(item)} para a cautela.`
      )
    }

    preparados.push({
      ...item,

      patrimonio_id:
        patrimonioId,

      quantidade:
        Number(
          item?.quantidade ||
          1
        ),

      observacao:
        item?.controla_quantidade
          ? JSON.stringify({
              tipo_registro:
                'TONFA_QUANTIDADE',

              tonfa_id:
                item.tonfa_id,

              categoria:
                item.categoria,

              quantidade:
                Number(
                  item?.quantidade ||
                  1
                )
            })
          : (
              item?.observacao ||
              ''
            )
    })
  }

  return preparados
}


async function registrarPagamentoDiretoNoMapa({
  policial,
  funcao,
  unidade,
  resumo
}) {
  const mapaAtual =
    await carregarMapaEmElaboracao()

  const mapaId =
    mapaAtual?.mapa?.id ||
    null

  if (!mapaId) {
    throw new Error(
      'A cautela foi criada, mas o Mapa Força em elaboração não foi localizado para registrar o vínculo.'
    )
  }

  await registrarCautelaMapaForca({
    mapaId,

    usId:
      unidade?.id ||
      null,

    policial,

    funcao,

    prefixoUs:
      unidade?.prefixo ||
      '',

    movimentacaoPrincipalId:
      resumo?.movimentacaoPrincipalId ||
      null,

    transferenciasMunicaoIds:
      resumo?.transferenciasMunicaoIds ||
      [],

    resumoItens:
      resumo?.resumoItens ||
      [],

    quantidadeItens:
      resumo?.quantidadeItens ||
      0
  })

  return mapaId
}

export default function PagarMaterialMapaForca({
  open = true,
  user,
  policial,
  funcao = '',
  unidade = null,
  itensPreparados = [],
  itensReservadosMapa = [],
  onClose = null,
  onConcluido = null
}) {
  const [tipoAtivo, setTipoAtivo] =
    useState('ARMAS')

  const [materiais, setMateriais] =
    useState([])

  const [
    itensSelecionados,
    setItensSelecionados
  ] = useState([])

  const [busca, setBusca] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [salvando, setSalvando] =
    useState(false)

  const [erro, setErro] =
    useState('')

  const [
    cautelasExistentes,
    setCautelasExistentes
  ] = useState([])

  const [
    carregandoUltimoRecebido,
    setCarregandoUltimoRecebido
  ] = useState(false)

  const [
    indisponiveisUltimoRecebido,
    setIndisponiveisUltimoRecebido
  ] = useState([])

  useEffect(() => {
    if (!open) {
      return
    }

    let ativo = true

    async function carregar() {
      try {
        setLoading(true)
        setErro('')

        const [
          lista,
          disponibilidadesMunicoes,
          mapaAtual
        ] =
          await Promise.all([
            listarPatrimoniosParaEntrega({
              origemLocal:
                ORIGEM_SVDD,

              apenasDisponiveis:
                true
            }),

            listarDisponibilidadeAtualMunicoesSvdd(),

            carregarMapaEmElaboracao()
          ])

        const listaAtualizada =
          aplicarReservasLocaisMapa(
            aplicarDisponibilidadeMunicoes(
              Array.isArray(lista)
                ? lista
                : [],
              disponibilidadesMunicoes
            ),
            itensReservadosMapa
          )

        let cautelasDoContexto =
          []

        if (mapaAtual?.mapa?.id) {
          const cautelas =
            await listarCautelasMapaForca({
              mapaId:
                mapaAtual.mapa.id
            })

          cautelasDoContexto =
            (cautelas || []).filter(
              (cautela) =>
                cautelaPertenceAoContexto(
                  cautela,
                  policial,
                  funcao,
                  unidade
                )
            )
        }

        if (ativo) {
          setMateriais(
            listaAtualizada
          )

          setCautelasExistentes(
            cautelasDoContexto
          )

          setItensSelecionados(
            Array.isArray(
              itensPreparados
            )
              ? itensPreparados
              : []
          )
        }
      } catch (error) {
        console.error(
          'Erro ao carregar materiais do Mapa Força:',
          error
        )

        if (ativo) {
          setErro(
            error?.message ||
            'Não foi possível carregar os materiais disponíveis.'
          )
        }
      } finally {
        if (ativo) {
          setLoading(false)
        }
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setItensSelecionados([])
      setBusca('')
      setErro('')
      setCautelasExistentes([])
      setIndisponiveisUltimoRecebido([])
    }
  }, [open])

  const itensJaPagos =
    useMemo(
      () =>
        cautelasExistentes.flatMap(
          (cautela) =>
            Array.isArray(
              cautela?.resumo_itens
            )
              ? cautela.resumo_itens
              : []
        ),
      [cautelasExistentes]
    )

  const possuiMaterialJaPago =
    itensJaPagos.length > 0

  const contagemPorTipo =
    useMemo(() => {
      const contagem = {}

      for (
        const tipo of
        TIPOS_MATERIAL
      ) {
        contagem[tipo.id] =
          materiais.filter(
            (item) =>
              correspondeTipo(
                item,
                tipo.id
              )
          ).length
      }

      return contagem
    }, [materiais])

  const resultados =
    useMemo(() => {
      const termo =
        normalizarTexto(
          busca
        )

      return materiais.filter(
        (item) => {
          if (
            !correspondeTipo(
              item,
              tipoAtivo
            )
          ) {
            return false
          }

          if (!termo) {
            return true
          }

          return [
            rotuloItem(item),
            item?.patrimonio,
            item?.descricao,
            item?.categoria,
            item?.calibre,
            item?.marca,
            item?.modelo,
            item?.numero_serie
          ].some(
            (valor) =>
              normalizarTexto(
                valor
              ).includes(
                termo
              )
          )
        }
      )
    }, [
      materiais,
      tipoAtivo,
      busca
    ])

  function estaSelecionado(
    item
  ) {
    const chave =
      criarChaveItem(
        item
      )

    return itensSelecionados.some(
      (selecionado) =>
        criarChaveItem(
          selecionado
        ) === chave
    )
  }

  function adicionarItem(
    item
  ) {
    if (
      !item?.disponivel ||
      estaSelecionado(item)
    ) {
      return
    }

    const itemNovo = {
      ...item,
      quantidade:
        1
    }

    if (!ehArma(item)) {
      setItensSelecionados(
        (atuais) => [
          ...atuais,
          itemNovo
        ]
      )

      setErro('')
      return
    }

    const calibreArma =
      obterCalibreItem(
        item
      )

    const municoesCompativeis =
      materiais
        .filter(
          (material) =>
            ehMunicao(
              material
            ) &&
            material?.disponivel &&
            calibresCompativeis(
              item,
              material
            )
        )
        .sort(
          (a, b) =>
            numeroInteiro(
              b?.quantidade_disponivel
            ) -
            numeroInteiro(
              a?.quantidade_disponivel
            )
        )

    const municaoCompativel =
      municoesCompativeis[0] ||
      null

    setItensSelecionados(
      (atuais) => {
        const resultado = [
          ...atuais,
          itemNovo
        ]

        if (
          !municaoCompativel
        ) {
          return resultado
        }

        const chaveMunicao =
          criarChaveItem(
            municaoCompativel
          )

        const jaTemMunicao =
          atuais.some(
            (selecionado) =>
              criarChaveItem(
                selecionado
              ) ===
                chaveMunicao
          )

        if (jaTemMunicao) {
          return resultado
        }

        return [
          ...resultado,
          {
            ...municaoCompativel,

            quantidade:
              1,

            adicionada_automaticamente:
              true,

            arma_vinculada_id:
              item?.id ||
              null
          }
        ]
      }
    )

    if (
      !String(
        calibreArma ||
        ''
      ).trim()
    ) {
      setErro(
        'A arma foi adicionada, mas o calibre não está informado no cadastro. A munição deverá ser selecionada manualmente.'
      )
      return
    }

    if (
      !municaoCompativel
    ) {
      setErro(
        `A arma foi adicionada, mas não há munição compatível com ${calibreArma} disponível no SVDD.`
      )
      return
    }

    setErro('')
  }

  function removerItem(
    item
  ) {
    const chave =
      criarChaveItem(
        item
      )

    setItensSelecionados(
      (atuais) =>
        atuais.filter(
          (selecionado) =>
            criarChaveItem(
              selecionado
            ) !== chave
        )
    )
  }

  function alterarQuantidade(
    item,
    valor
  ) {
    const chave =
      criarChaveItem(
        item
      )

    setItensSelecionados(
      (atuais) =>
        atuais.map(
          (selecionado) => {
            if (
              criarChaveItem(
                selecionado
              ) !== chave
            ) {
              return selecionado
            }

            const maxima =
              Math.max(
                1,
                numeroInteiro(
                  selecionado
                    ?.quantidade_maxima ||
                  selecionado
                    ?.quantidade_disponivel ||
                  1
                )
              )

            const quantidade =
              Math.max(
                1,
                Math.min(
                  numeroInteiro(
                    valor
                  ) || 1,
                  maxima
                )
              )

            return {
              ...selecionado,
              quantidade
            }
          }
        )
    )
  }

  async function atualizarLista() {
    const [
      lista,
      disponibilidadesMunicoes
    ] =
      await Promise.all([
        listarPatrimoniosParaEntrega({
          origemLocal:
            ORIGEM_SVDD,

          apenasDisponiveis:
            true
        }),

        listarDisponibilidadeAtualMunicoesSvdd()
      ])

    setMateriais(
      aplicarReservasLocaisMapa(
        aplicarDisponibilidadeMunicoes(
          Array.isArray(lista)
            ? lista
            : [],
          disponibilidadesMunicoes
        ),
        itensReservadosMapa
      )
    )
  }


  async function pagarUltimoRecebido() {
    if (!policial?.id) {
      setErro(
        'O policial da US não foi identificado.'
      )
      return
    }

    try {
      setCarregandoUltimoRecebido(
        true
      )
      setErro('')
      setIndisponiveisUltimoRecebido([])

      const [
        historico,
        listaAtual,
        disponibilidadesMunicoes
      ] =
        await Promise.all([
          buscarUltimaCautelaRecebidaPolicial({
            policialId:
              policial.id,
            policial
          }),

          listarPatrimoniosParaEntrega({
            origemLocal:
              ORIGEM_SVDD,
            apenasDisponiveis:
              true
          }),

          listarDisponibilidadeAtualMunicoesSvdd()
        ])

      if (
        !historico ||
        !Array.isArray(
          historico?.itens
        ) ||
        historico.itens.length === 0
      ) {
        setErro(
          `${nomePolicial(policial)} ainda não possui uma cautela recebida anteriormente para reutilizar.`
        )
        return
      }

      const materiaisAtuais =
        aplicarReservasLocaisMapa(
          aplicarDisponibilidadeMunicoes(
            Array.isArray(listaAtual)
              ? listaAtual
              : [],
            disponibilidadesMunicoes
          ),
          itensReservadosMapa
        )

      setMateriais(
        materiaisAtuais
      )

      const kit =
        montarKitUltimoRecebido({
          itensHistorico:
            historico.itens,
          materiaisDisponiveis:
            materiaisAtuais
        })

      const selecionadosPendentes =
        retirarQuantidadeJaPaga({
          selecionados:
            kit?.selecionados || [],
          itensJaPagos: [
            ...itensJaPagos,
            ...itensSelecionados
          ]
        })

      const indisponiveis =
        Array.isArray(
          kit?.indisponiveis
        )
          ? kit.indisponiveis
          : []

      setIndisponiveisUltimoRecebido(
        indisponiveis
      )

      if (
        selecionadosPendentes.length === 0 &&
        indisponiveis.length === 0
      ) {
        setErro(
          'Todos os materiais do último recebimento já estão pagos ou preparados nesta US.'
        )
        return
      }

      if (
        indisponiveis.length > 0
      ) {
        setItensSelecionados(
          (atuais) =>
            mesclarSelecaoSemDuplicar(
              atuais,
              selecionadosPendentes
            )
        )

        const detalhe =
          indisponiveis
            .map(
              (item) =>
                `${rotuloIndisponivelUltimo(item)} — ${item?.motivo || 'INDISPONÍVEL'}`
            )
            .join(' • ')

        setErro(
          `O último kit não está totalmente disponível. ${detalhe}. Os itens disponíveis foram carregados no carrinho; escolha os substitutos e confirme.`
        )
        return
      }

      /*
       * Kit completo e disponível:
       * carrega no carrinho para o SVDD revisar antes de confirmar.
       * Assim é possível marcar itens que NÃO serão pagos neste serviço.
       */
      setItensSelecionados(
        (atuais) =>
          mesclarSelecaoSemDuplicar(
            atuais,
            selecionadosPendentes
          )
      )

      setErro('')
    } catch (error) {
      console.error(
        'Erro ao pagar o último material recebido:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível reutilizar o último material recebido.'
      )
    } finally {
      setCarregandoUltimoRecebido(
        false
      )
    }
  }

  async function confirmar(itensForcados = null) {
    const itensOperacao =
      Array.isArray(itensForcados)
        ? itensForcados
        : itensSelecionados

    if (!policial?.id) {
      setErro(
        'O policial da US não foi identificado.'
      )
      return
    }

    if (
      itensOperacao.length ===
      0
    ) {
      setErro(
        'Selecione pelo menos um material.'
      )
      return
    }

    const fimTurnoServico =
      isoValido(
        unidade?.fimUs
      )

    if (!fimTurnoServico) {
      setErro(
        'A US não possui horário de término válido.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      /*
       * O modal só PREPARA o kit.
       * Nenhuma cautela real, movimentação patrimonial
       * ou transferência PENDENTE de munição é criada aqui.
       * A efetivação acontece exclusivamente no Salvar US.
       */
      const reservadosOutros =
        Array.isArray(
          itensReservadosMapa
        )
          ? itensReservadosMapa
          : []

      for (const item of itensOperacao) {
        const chave =
          chaveReservaMaterial(
            item
          )

        if (
          !chave ||
          item?.controla_quantidade
        ) {
          continue
        }

        const reservadoParaOutro =
          reservadosOutros.some(
            (reservado) =>
              chaveReservaMaterial(
                reservado
              ) === chave
          )

        if (reservadoParaOutro) {
          throw new Error(
            `${rotuloItem(item)} já foi preparado para outro policial desta US.`
          )
        }
      }

      const municoes =
        itensOperacao.filter(
          ehMunicao
        )

      if (municoes.length > 0) {
        const disponibilidadesAtuais =
          await listarDisponibilidadeAtualMunicoesSvdd()

        const porMunicao =
          new Map(
            disponibilidadesAtuais.map(
              (registro) => [
                String(
                  registro?.municao_id ||
                  ''
                ),
                numeroInteiro(
                  registro
                    ?.quantidade_disponivel
                )
              ]
            )
          )

        for (const item of municoes) {
          const municaoId =
            String(
              item?.municao_id ||
              item?.referencia_id ||
              ''
            )

          const solicitado =
            Math.max(
              1,
              numeroInteiro(
                item?.quantidade ||
                1
              )
            )

          const reservadoNaUs =
            quantidadeReservadaMapa(
              item,
              reservadosOutros
            )

          const disponivelBanco =
            Math.max(
              0,
              numeroInteiro(
                porMunicao.get(
                  municaoId
                ) || 0
              )
            )

          const disponivel =
            Math.max(
              0,
              disponivelBanco -
              reservadoNaUs
            )

          if (
            solicitado >
            disponivel
          ) {
            throw new Error(
              `${
                item?.calibre ||
                rotuloItem(item)
              }: foram selecionadas ${solicitado} UN, mas existem somente ${disponivel} UN livres para esta US.`
            )
          }
        }
      }

      const resumoItens =
        itensOperacao.map(
          resumirItemPago
        )

      const resumo = {
        preparado: true,

        policial,
        funcao,
        unidade,

        itensPreparados:
          itensOperacao.map(
            (item) => ({
              ...item,
              quantidade:
                Math.max(
                  1,
                  Number(
                    item?.quantidade ||
                    1
                  ) || 1
                )
            })
          ),

        resumoItens,

        quantidadeItens:
          itensOperacao.length,

        complemento:
          possuiMaterialJaPago,

        preparadoEm:
          new Date().toISOString()
      }

      await Promise.resolve(
        onConcluido?.(
          resumo
        )
      )

      setItensSelecionados([])
      onClose?.()
    } catch (error) {
      console.error(
        'Erro ao preparar material pelo Mapa Força:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível preparar os materiais da US.'
      )
    } finally {
      setSalvando(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10030,
        display: 'grid',
        placeItems: 'center',
        padding: '18px',
        background:
          'rgba(2, 12, 27, .78)',
        backdropFilter:
          'blur(4px)'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pagar-material-mapa-titulo"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        style={{
          width:
            'min(980px, 100%)',
          maxHeight:
            'calc(100vh - 36px)',
          overflow:
            'hidden',
          display:
            'flex',
          flexDirection:
            'column',
          border:
            '1px solid rgba(56, 189, 248, .25)',
          borderRadius:
            '18px',
          background:
            '#071b2e',
          color:
            '#e2e8f0',
          boxShadow:
            '0 28px 80px rgba(0,0,0,.42)'
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            gap: '12px',
            padding:
              '16px 18px',
            borderBottom:
              '1px solid rgba(148, 163, 184, .16)'
          }}
        >
          <div
            style={{
              minWidth: 0
            }}
          >
            <span
              style={{
                display:
                  'block',
                marginBottom:
                  '3px',
                color:
                  '#38bdf8',
                fontSize:
                  '11px',
                fontWeight:
                  900,
                letterSpacing:
                  '.09em'
              }}
            >
              MAPA FORÇA • PREPARAR MATERIAL
            </span>

            <h2
              id="pagar-material-mapa-titulo"
              style={{
                margin: 0,
                fontSize:
                  '18px',
                lineHeight:
                  1.2
              }}
            >
              {nomePolicial(
                policial
              )}
            </h2>

            <small
              style={{
                display:
                  'block',
                marginTop:
                  '5px',
                color:
                  '#94a3b8',
                fontWeight:
                  700
              }}
            >
              RE {policial?.re || '—'}
              {' • '}
              {funcao || 'EFETIVO'}
              {' • '}
              {unidade?.prefixo || 'US'}
              {' • '}
              devolução {formatarHora(unidade?.fimUs)}
            </small>
          </div>

          <button
            type="button"
            onClick={() =>
              onClose?.()
            }
            disabled={
              salvando
            }
            aria-label="Fechar"
            style={{
              width:
                '38px',
              height:
                '38px',
              flex:
                '0 0 38px',
              border:
                '1px solid rgba(248, 113, 113, .38)',
              borderRadius:
                '10px',
              background:
                'rgba(248, 113, 113, .08)',
              color:
                '#fca5a5',
              fontSize:
                '20px',
              cursor:
                salvando
                  ? 'not-allowed'
                  : 'pointer'
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            padding:
              '14px 18px 10px',
            borderBottom:
              '1px solid rgba(148, 163, 184, .12)'
          }}
        >
          <div
            style={{
              display:
                'flex',
              flexWrap:
                'wrap',
              gap:
                '7px'
            }}
          >
            {TIPOS_MATERIAL.map(
              (tipo) => {
                const ativo =
                  tipoAtivo ===
                  tipo.id

                return (
                  <button
                    type="button"
                    key={tipo.id}
                    onClick={() => {
                      setTipoAtivo(
                        tipo.id
                      )
                      setBusca('')
                    }}
                    aria-pressed={
                      ativo
                    }
                    style={{
                      minHeight:
                        '34px',
                      padding:
                        '6px 11px',
                      border:
                        ativo
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(148,163,184,.25)',
                      borderRadius:
                        '9px',
                      background:
                        ativo
                          ? 'rgba(56,189,248,.16)'
                          : 'rgba(15,23,42,.45)',
                      color:
                        ativo
                          ? '#7dd3fc'
                          : '#cbd5e1',
                      fontSize:
                        '12px',
                      fontWeight:
                        850,
                      cursor:
                        'pointer'
                    }}
                  >
                    {tipo.label}
                    {' '}
                    <span
                      style={{
                        opacity:
                          .7
                      }}
                    >
                      {contagemPorTipo[
                        tipo.id
                      ] || 0}
                    </span>
                  </button>
                )
              }
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '10px'
            }}
          >
            <button
              type="button"
              onClick={pagarUltimoRecebido}
              disabled={
                loading ||
                salvando ||
                carregandoUltimoRecebido
              }
              style={{
                minHeight: '36px',
                padding: '7px 12px',
                border: '1px solid rgba(52, 211, 153, .42)',
                borderRadius: '9px',
                background: 'rgba(16, 185, 129, .10)',
                color: '#6ee7b7',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '.03em',
                cursor:
                  loading ||
                  salvando ||
                  carregandoUltimoRecebido
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  loading ||
                  salvando ||
                  carregandoUltimoRecebido
                    ? .55
                    : 1
              }}
            >
              {carregandoUltimoRecebido
                ? 'Consultando último recebido...'
                : possuiMaterialJaPago
                  ? 'Carregar restante do último recebido'
                  : 'Carregar último recebido'}
            </button>
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            overflow:
              'auto',
            padding:
              '14px 18px 18px'
          }}
        >
          {erro && (
            <div
              style={{
                marginBottom:
                  '12px',
                padding:
                  '10px 12px',
                border:
                  '1px solid rgba(248,113,113,.32)',
                borderRadius:
                  '10px',
                background:
                  'rgba(127,29,29,.18)',
                color:
                  '#fecaca',
                fontWeight:
                  750,
                fontSize:
                  '13px'
              }}
            >
              {erro}
            </div>
          )}

          {indisponiveisUltimoRecebido.length > 0 && (
            <section
              style={{
                marginBottom: '12px',
                padding: '11px 12px',
                border: '1px solid rgba(251, 191, 36, .34)',
                borderRadius: '11px',
                background: 'rgba(120, 53, 15, .16)'
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#fde68a',
                  fontSize: '12px'
                }}
              >
                ÚLTIMO RECEBIDO • ITENS QUE PRECISAM DE SUBSTITUIÇÃO
              </strong>

              <div
                style={{
                  display: 'grid',
                  gap: '6px'
                }}
              >
                {indisponiveisUltimoRecebido.map(
                  (item, index) => (
                    <div
                      key={`ultimo-indisponivel-${index}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        color: '#fef3c7',
                        fontSize: '11px'
                      }}
                    >
                      <span>
                        {rotuloIndisponivelUltimo(item)}
                      </span>

                      <b
                        style={{
                          color: '#fbbf24',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item?.motivo || 'INDISPONÍVEL'}
                      </b>
                    </div>
                  )
                )}
              </div>

              <small
                style={{
                  display: 'block',
                  marginTop: '8px',
                  color: '#fde68a'
                }}
              >
                O SIGMO não troca patrimônio automaticamente. Escolha abaixo o substituto desejado e depois confirme a cautela.
              </small>
            </section>
          )}

          {possuiMaterialJaPago && (
            <section
              style={{
                marginBottom: '12px',
                padding: '11px 12px',
                border: '1px solid rgba(52, 211, 153, .30)',
                borderRadius: '11px',
                background: 'rgba(16, 185, 129, .08)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '8px'
                }}
              >
                <strong
                  style={{
                    color: '#6ee7b7',
                    fontSize: '12px',
                    letterSpacing: '.04em'
                  }}
                >
                  ✓ JÁ PAGO NESTA US
                </strong>

                <small
                  style={{
                    color: '#a7f3d0',
                    fontWeight: 800
                  }}
                >
                  {itensJaPagos.length} item(ns)
                </small>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}
              >
                {itensJaPagos.map(
                  (item, index) => (
                    <span
                      key={`pago-${item?.id || item?.patrimonio_id || item?.municao_id || index}`}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid rgba(52, 211, 153, .24)',
                        borderRadius: '999px',
                        background: 'rgba(2, 44, 34, .38)',
                        color: '#d1fae5',
                        fontSize: '10px',
                        fontWeight: 800
                      }}
                    >
                      {rotuloResumoPago(item)}
                    </span>
                  )
                )}
              </div>

              <small
                style={{
                  display: 'block',
                  marginTop: '8px',
                  color: '#a7f3d0',
                  lineHeight: 1.4
                }}
              >
                Os itens acima já foram cautelados. Use a lista abaixo apenas para complementar o material deste policial.
              </small>
            </section>
          )}

          <input
            value={busca}
            onChange={(event) =>
              setBusca(
                event.target.value
              )
            }
            placeholder="Pesquisar nesta categoria..."
            style={{
              width:
                '100%',
              boxSizing:
                'border-box',
              minHeight:
                '40px',
              marginBottom:
                '12px',
              padding:
                '9px 12px',
              border:
                '1px solid rgba(148,163,184,.24)',
              borderRadius:
                '10px',
              background:
                '#0b2741',
              color:
                '#f8fafc',
              outline:
                'none'
            }}
          />

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'minmax(0, 1.45fr) minmax(260px, .75fr)',
              gap:
                '14px',
              alignItems:
                'start'
            }}
          >
            <div
              style={{
                minWidth: 0
              }}
            >
              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  marginBottom:
                    '8px'
                }}
              >
                <strong
                  style={{
                    fontSize:
                      '13px'
                  }}
                >
                  Disponíveis
                </strong>

                <small
                  style={{
                    color:
                      '#94a3b8'
                  }}
                >
                  {resultados.length} item(ns)
                </small>
              </div>

              {loading ? (
                <div
                  style={{
                    padding:
                      '18px',
                    textAlign:
                      'center',
                    color:
                      '#94a3b8'
                  }}
                >
                  Carregando...
                </div>
              ) : resultados.length ===
                0 ? (
                <div
                  style={{
                    padding:
                      '18px',
                    border:
                      '1px dashed rgba(148,163,184,.22)',
                    borderRadius:
                      '12px',
                    textAlign:
                      'center',
                    color:
                      '#94a3b8'
                  }}
                >
                  Nenhum item disponível nesta categoria.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      'grid',
                    gap:
                      '8px'
                  }}
                >
                  {resultados.map(
                    (item) => {
                      const selecionado =
                        estaSelecionado(
                          item
                        )

                      return (
                        <button
                          type="button"
                          key={
                            criarChaveItem(
                              item
                            )
                          }
                          onClick={() =>
                            adicionarItem(
                              item
                            )
                          }
                          disabled={
                            selecionado ||
                            !item?.disponivel
                          }
                          style={{
                            display:
                              'grid',
                            gridTemplateColumns:
                              'minmax(0,1fr) auto',
                            alignItems:
                              'center',
                            gap:
                              '10px',
                            width:
                              '100%',
                            padding:
                              '10px 12px',
                            border:
                              selecionado
                                ? '1px solid rgba(52,211,153,.38)'
                                : '1px solid rgba(148,163,184,.18)',
                            borderRadius:
                              '11px',
                            background:
                              selecionado
                                ? 'rgba(16,185,129,.08)'
                                : '#0b2741',
                            color:
                              '#f8fafc',
                            textAlign:
                              'left',
                            cursor:
                              selecionado
                                ? 'default'
                                : 'pointer'
                          }}
                        >
                          <span
                            style={{
                              minWidth:
                                0
                            }}
                          >
                            <strong
                              style={{
                                display:
                                  'block',
                                overflow:
                                  'hidden',
                                textOverflow:
                                  'ellipsis',
                                whiteSpace:
                                  'nowrap',
                                fontSize:
                                  '13px'
                              }}
                            >
                              {rotuloItem(
                                item
                              )}
                            </strong>

                            <small
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '4px',
                                color:
                                  '#94a3b8'
                              }}
                            >
                              {item?.controla_quantidade
                                ? `${item?.quantidade_disponivel || 0} UN disponível(is)`
                                : item?.patrimonio || '1 UN'}
                            </small>
                          </span>

                          <b
                            style={{
                              color:
                                selecionado
                                  ? '#6ee7b7'
                                  : '#7dd3fc',
                              fontSize:
                                '12px'
                            }}
                          >
                            {selecionado
                              ? 'ADICIONADO'
                              : 'ADICIONAR'}
                          </b>
                        </button>
                      )
                    }
                  )}
                </div>
              )}
            </div>

            <aside
              style={{
                minWidth: 0,
                padding:
                  '12px',
                border:
                  '1px solid rgba(148,163,184,.18)',
                borderRadius:
                  '12px',
                background:
                  'rgba(15,23,42,.38)'
              }}
            >
              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                  gap:
                    '8px',
                  marginBottom:
                    '10px'
                }}
              >
                <strong
                  style={{
                    fontSize:
                      '13px'
                  }}
                >
                  {possuiMaterialJaPago
                    ? 'Complemento'
                    : 'Selecionados'}
                </strong>

                <span
                  style={{
                    minWidth:
                      '24px',
                    padding:
                      '2px 7px',
                    borderRadius:
                      '999px',
                    background:
                      'rgba(56,189,248,.14)',
                    color:
                      '#7dd3fc',
                    textAlign:
                      'center',
                    fontSize:
                      '11px',
                    fontWeight:
                      900
                  }}
                >
                  {itensSelecionados.length}
                </span>
              </div>

              {Array.isArray(itensPreparados) &&
              itensPreparados.length > 0 && (
                <div
                  style={{
                    marginBottom: '9px',
                    padding: '8px 9px',
                    border: '1px solid rgba(251, 191, 36, .24)',
                    borderRadius: '8px',
                    background: 'rgba(120, 53, 15, .10)',
                    color: '#fde68a',
                    fontSize: '10px',
                    lineHeight: 1.4,
                    fontWeight: 800
                  }}
                >
                  MATERIAL PREPARADO NESTA US • ainda não foi liberado ao policial. Você pode ajustar os itens antes de salvar a US.
                </div>
              )}

              {itensSelecionados.some(
                (item) =>
                  item?.origem_ultimo_recebido
              ) && (
                <div
                  style={{
                    marginBottom: '9px',
                    padding: '8px 9px',
                    border: '1px solid rgba(52, 211, 153, .22)',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, .07)',
                    color: '#a7f3d0',
                    fontSize: '10px',
                    lineHeight: 1.4,
                    fontWeight: 700
                  }}
                >
                  Último recebido carregado. Use “Não pagar” nos itens que não serão entregues neste serviço e depois prepare o material da US.
                </div>
              )}

              {itensSelecionados.length ===
              0 ? (
                <div
                  style={{
                    padding:
                      '12px 0',
                    color:
                      '#94a3b8',
                    fontSize:
                      '12px',
                    textAlign:
                      'center'
                  }}
                >
                  Nenhum material selecionado.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      'grid',
                    gap:
                      '8px'
                  }}
                >
                  {itensSelecionados.map(
                    (item) => (
                      <div
                        key={
                          criarChaveItem(
                            item
                          )
                        }
                        style={{
                          padding:
                            '9px',
                          border:
                            '1px solid rgba(148,163,184,.16)',
                          borderRadius:
                            '9px',
                          background:
                            '#0b2741'
                        }}
                      >
                        <strong
                          style={{
                            display:
                              'block',
                            marginBottom:
                              '4px',
                            fontSize:
                              '12px'
                          }}
                        >
                          {rotuloItem(
                            item
                          )}
                        </strong>

                        {ehMunicao(item) && (
                          <small
                            style={{
                              display:
                                'block',
                              marginBottom:
                                '7px',
                              color:
                                '#7dd3fc',
                              fontSize:
                                '11px',
                              fontWeight:
                                800
                            }}
                          >
                            {item?.adicionada_automaticamente
                              ? 'Munição compatível com a arma • '
                              : ''}
                            Disponível no SVDD:{' '}
                            {numeroInteiro(
                              item?.quantidade_disponivel
                            )}{' '}
                            UN
                          </small>
                        )}

                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '7px'
                          }}
                        >
                          {item?.controla_quantidade ? (
                            <input
                              type="number"
                              min="1"
                              max={
                                item?.quantidade_maxima ||
                                item?.quantidade_disponivel ||
                                1
                              }
                              value={
                                item?.quantidade ||
                                1
                              }
                              onChange={(event) =>
                                alterarQuantidade(
                                  item,
                                  event.target.value
                                )
                              }
                              style={{
                                width:
                                  '74px',
                                height:
                                  '32px',
                                boxSizing:
                                  'border-box',
                                padding:
                                  '5px 8px',
                                border:
                                  '1px solid rgba(148,163,184,.24)',
                                borderRadius:
                                  '8px',
                                background:
                                  '#071b2e',
                                color:
                                  '#f8fafc'
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                color:
                                  '#94a3b8',
                                fontSize:
                                  '12px'
                              }}
                            >
                              1 UN
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              removerItem(
                                item
                              )
                            }
                            style={{
                              marginLeft:
                                'auto',
                              minHeight:
                                '32px',
                              padding:
                                '5px 9px',
                              border:
                                '1px solid rgba(248,113,113,.28)',
                              borderRadius:
                                '8px',
                              background:
                                'rgba(248,113,113,.07)',
                              color:
                                '#fca5a5',
                              fontSize:
                                '11px',
                              fontWeight:
                                800,
                              cursor:
                                'pointer'
                            }}
                          >
                            {item?.origem_ultimo_recebido
                              ? 'Não pagar'
                              : 'Remover'}
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        <footer
          style={{
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'flex-end',
            gap:
              '9px',
            padding:
              '12px 18px',
            borderTop:
              '1px solid rgba(148,163,184,.14)'
          }}
        >
          <button
            type="button"
            onClick={() =>
              onClose?.()
            }
            disabled={
              salvando
            }
            style={{
              minHeight:
                '38px',
              padding:
                '7px 14px',
              border:
                '1px solid rgba(148,163,184,.24)',
              borderRadius:
                '9px',
              background:
                'transparent',
              color:
                '#cbd5e1',
              fontWeight:
                800,
              cursor:
                salvando
                  ? 'not-allowed'
                  : 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() =>
              confirmar()
            }
            disabled={
              salvando ||
              itensSelecionados.length ===
                0
            }
            style={{
              minHeight:
                '38px',
              padding:
                '7px 15px',
              border:
                '1px solid #38bdf8',
              borderRadius:
                '9px',
              background:
                itensSelecionados.length ===
                  0
                  ? 'rgba(56,189,248,.08)'
                  : '#0ea5e9',
              color:
                '#ffffff',
              fontWeight:
                900,
              cursor:
                salvando ||
                itensSelecionados.length ===
                  0
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                salvando ||
                itensSelecionados.length ===
                  0
                  ? .55
                  : 1
            }}
          >
            {salvando
              ? 'Preparando...'
              : `${possuiMaterialJaPago
                  ? 'Preparar complemento'
                  : 'Preparar material'}${
                  itensSelecionados.length > 0
                    ? ` (${itensSelecionados.length})`
                    : ''
                }`}
          </button>
        </footer>
      </section>
    </div>
  )
}
