import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  obterPerfilEfetivo,
  PERFIS
} from '../services/permissionService'

import {
  supabase
} from '../services/supabaseClient'

import {
  listarArmas
} from '../services/armasService'

import {
  listarTonfas
} from '../services/tonfasService'

import {
  listarManutencoes
} from '../services/manutencoesService'

const LIMITE = 5000

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function statusArma(arma) {
  return normalizar(
    arma?.status_operacional ||
      arma?.status ||
      arma?.situacao_operacional
  )
}

function localArma(arma) {
  return normalizar(
    arma?.local_atual ||
      arma?.localizacao_atual ||
      arma?.localizacao ||
      arma?.local ||
      arma?.guardiao_nome
  )
}


function origemCautelaEhSvdd(valor) {
  const origem = normalizar(valor)

  return (
    origem.includes('SVDD') ||
    origem.includes('SERVICO DE DIA') ||
    origem.includes('COFRE DO SVDD')
  )
}

function origemCautelaEhP4(valor) {
  const origem = normalizar(valor)

  return (
    origem.includes('P4') ||
    origem.includes('DEPOSITO DO P4') ||
    origem.includes('GUARDA DO P4') ||
    origem.includes('COFRE DO P4')
  )
}

async function carregarOrigemCautelaPorPatrimonio(patrimonioIds = []) {
  const ids = [
    ...new Set(
      (patrimonioIds || [])
        .filter(Boolean)
        .map(String)
    )
  ]

  const resultado = new Map()

  if (ids.length === 0) {
    return resultado
  }

  const { data: itens, error: itensError } =
    await supabase
      .from('sigmo_movimentacao_itens')
      .select('patrimonio_id, movimentacao_id')
      .in('patrimonio_id', ids)

  if (itensError) {
    throw itensError
  }

  const movimentacaoIds = [
    ...new Set(
      (itens || [])
        .map((item) => item?.movimentacao_id)
        .filter(Boolean)
    )
  ]

  if (movimentacaoIds.length === 0) {
    return resultado
  }

  const { data: movimentacoes, error: movimentacoesError } =
    await supabase
      .from('sigmo_movimentacoes')
      .select(
        'id, tipo_movimentacao, origem_local, destino_local, status, created_at'
      )
      .in('id', movimentacaoIds)
      .eq('tipo_movimentacao', 'CAUTELA')
      .eq('status', 'finalizada')
      .order('created_at', {
        ascending: false
      })

  if (movimentacoesError) {
    throw movimentacoesError
  }

  const patrimoniosPorMovimentacao = new Map()

  for (const item of itens || []) {
    const movimentacaoId =
      String(item?.movimentacao_id || '')

    const patrimonioId =
      String(item?.patrimonio_id || '')

    if (!movimentacaoId || !patrimonioId) {
      continue
    }

    if (!patrimoniosPorMovimentacao.has(movimentacaoId)) {
      patrimoniosPorMovimentacao.set(
        movimentacaoId,
        []
      )
    }

    patrimoniosPorMovimentacao
      .get(movimentacaoId)
      .push(patrimonioId)
  }

  // `movimentacoes` já vem ordenado da mais recente para a mais antiga.
  // Percorrer nessa ordem é essencial: o patrimônio pode ter cautelas
  // históricas tanto do SVDD quanto do P4, e deve valer somente a última.
  for (const movimentacao of movimentacoes || []) {
    if (
      normalizar(
        movimentacao?.destino_local
      ) !== 'CAUTELA INDIVIDUAL'
    ) {
      continue
    }

    const patrimonioIds =
      patrimoniosPorMovimentacao.get(
        String(movimentacao?.id || '')
      ) || []

    for (const patrimonioId of patrimonioIds) {
      if (!resultado.has(patrimonioId)) {
        resultado.set(
          patrimonioId,
          movimentacao
        )
      }
    }
  }

  return resultado
}

async function enriquecerArmasComOrigemCautela(lista = []) {
  const armas = Array.isArray(lista) ? lista : []

  const referencias = [
    ...new Set(
      armas
        .map((arma) => arma?.id)
        .filter(Boolean)
        .map(String)
    )
  ]

  if (referencias.length === 0) {
    return armas
  }

  const { data: patrimonios, error } =
    await supabase
      .from('sigmo_patrimonios')
      .select('id, referencia_id')
      .eq('tipo', 'arma')
      .in('referencia_id', referencias)

  if (error) {
    throw error
  }

  const patrimonioPorReferencia = new Map(
    (patrimonios || []).map((item) => [
      String(item.referencia_id),
      item
    ])
  )

  const origemPorPatrimonio =
    await carregarOrigemCautelaPorPatrimonio(
      (patrimonios || []).map((item) => item.id)
    )

  return armas.map((arma) => {
    const patrimonio =
      patrimonioPorReferencia.get(
        String(arma?.id || '')
      )

    const movimentacao =
      patrimonio
        ? origemPorPatrimonio.get(
            String(patrimonio.id)
          )
        : null

    return {
      ...arma,
      patrimonio_id_central:
        patrimonio?.id ||
        arma?.patrimonio_id_central ||
        null,
      origem_cautela:
        movimentacao?.origem_local ||
        arma?.origem_cautela ||
        null,
      cautela_movimentacao_id:
        movimentacao?.id ||
        arma?.cautela_movimentacao_id ||
        null
    }
  })
}

function resumirArmas(lista) {
  const resumo = {
    total: 0,
    p4:0,
    svdd:0,
    carga:0,
    cautelas:0,
    manutencao:0,
    naoLocalizadas:0,
    particulares:0
}

  lista.forEach((arma) => {
    const status =
      statusArma(arma)
    const local =
      localArma(arma)

    if (
      normalizar(
        arma?.propriedade
      ) === 'PARTICULAR'
    ) {
      resumo.particulares += 1
      return
    }

    if (
      status.includes(
        'MANUTENCAO'
      ) ||
      local.includes(
        'MANUTENCAO'
      )
    ) {
      resumo.manutencao += 1
      return
    }

    if (
      status.includes(
        'NAO LOCALIZ'
      ) ||
      local.includes(
        'NAO LOCALIZ'
      )
    ) {
      resumo.naoLocalizadas += 1
      return
    }

    if (
      status.includes('CAUTELA')
    ) {
      resumo.cautelas += 1
      return
    }

    if (
      status === 'CARGA' ||
      status.includes(
        'CARGA PERMANENTE'
      )
    ) {
      resumo.carga += 1
      return
    }

    if (
      local.includes('SVDD') ||
      local.includes(
        'SERVICO DE DIA'
      )
    ) {
      resumo.svdd += 1
      return
    }

    if (
      status === 'RESERVA' ||
      status === 'RECOLHIDO' ||
      local.includes('P4') ||
      local.includes('RESERVA') ||
      local.includes('DEPOSITO')
    ) {
      resumo.p4 += 1
      return
    }

    resumo.naoLocalizadas += 1
  })

  resumo.total =
    resumo.p4 +
    resumo.svdd +
    resumo.carga +
    resumo.cautelas +
    resumo.manutencao +
    resumo.naoLocalizadas +
    resumo.particulares

return resumo
}

function quantidade(item) {
  const valor = Number(
    item?.quantidade_total ??
      item?.quantidade ??
      item?.saldo_total ??
      1
  )

  return Number.isFinite(valor) &&
    valor > 0
    ? valor
    : 1
}

function somar(lista, campo) {
  return lista.reduce(
    (total, item) =>
      total +
      Number(
        item?.[campo] || 0
      ),
    0
  )
}

function resumoTipo(lista) {
  return {
    total: lista.reduce(
      (total, item) =>
        total +
        quantidade(item),
      0
    ),
    p4: somar(
      lista,
      'quantidade_p4'
    ),
    svdd: somar(
      lista,
      'quantidade_svdd'
    ),
    emServico: somar(
      lista,
      'quantidade_em_servico'
    ),
    manutencao: somar(
      lista,
      'quantidade_manutencao'
    )
  }
}

function resumirTonfas(lista) {
  const tonfas = lista.filter(
    (item) =>
      normalizar(item?.tipo) ===
      'TONFA'
  )

  const cassetetes =
    lista.filter(
      (item) =>
        normalizar(item?.tipo) ===
        'CASSETETE'
    )

  const tonfasDetalhe =
    resumoTipo(tonfas)

  const cassetetesDetalhe =
    resumoTipo(cassetetes)

  return {
    geral: {
      total:
        tonfasDetalhe.total +
        cassetetesDetalhe.total,
      tonfas:
        tonfasDetalhe.total,
      cassetetes:
        cassetetesDetalhe.total,
      p4:
        tonfasDetalhe.p4 +
        cassetetesDetalhe.p4,
      svdd:
        tonfasDetalhe.svdd +
        cassetetesDetalhe.svdd,
      emServico:
        tonfasDetalhe.emServico +
        cassetetesDetalhe.emServico,
      manutencao:
        tonfasDetalhe.manutencao +
        cassetetesDetalhe.manutencao
    },
    tonfasDetalhe,
    cassetetesDetalhe
  }
}


function itemIndividualEmServico(item) {
  if (item?.ativo === false) return false

  const status = normalizar(
    item?.status_operacional ||
    item?.status
  )

  const local = normalizar(
    item?.local_atual
  )

  return (
    status === 'CAUTELADO' ||
    status === 'EM SERVICO' ||
    status === 'EM_SERVICO' ||
    local.includes('CAUTELA') ||
    local.includes('EM SERVICO') ||
    local.includes('EM_SERVICO')
  )
}

function itemIndividualDisponivelSvdd(item) {
  if (item?.ativo === false) return false

  const status = normalizar(item?.status_operacional || item?.status)
  const local = normalizar(item?.local_atual)

  if ([
    'CAUTELADO',
    'CARGA',
    'EM SERVICO',
    'EM_SERVICO',
    'MANUTENCAO',
    'BAIXADO',
    'APREENDIDO'
  ].includes(status)) {
    return false
  }

  return local.includes('COFRE DO SVDD') || local === 'SVDD'
}

function resumirIndividuais(lista) {
  const ativos = (lista || []).filter(
    (item) => item?.ativo !== false
  )

  const resumo = {
    total: ativos.length,
    p4: 0,
    svdd: 0,
    emServico: 0,
    manutencao: 0,
    carga: 0,
    naoLocalizados: 0
  }

  for (const item of ativos) {
    const status = normalizar(
      item?.status_operacional ||
      item?.status
    )

    const local = normalizar(
      item?.local_atual
    )

    if (
      status.includes('MANUTENCAO') ||
      local.includes('MANUTENCAO')
    ) {
      resumo.manutencao += 1
      continue
    }

    if (
      status === 'CARGA' ||
      local.includes('CARGA PERMANENTE')
    ) {
      resumo.carga += 1
      continue
    }

    if (itemIndividualEmServico(item)) {
      resumo.emServico += 1
      continue
    }

    if (
      local.includes('COFRE DO SVDD') ||
      local === 'SVDD'
    ) {
      resumo.svdd += 1
      continue
    }

    if (
      local.includes('P4') ||
      local.includes('DEPOSITO DO P4') ||
      local.includes('GUARDA DO P4')
    ) {
      resumo.p4 += 1
      continue
    }

    resumo.naoLocalizados += 1
  }

  return resumo
}

function obterPolicialId(user) {
  return (
    user?.policial_id ||
    user?.id_policial ||
    user?.policial?.id ||
    null
  )
}

function armaPertenceAoUsuario(
  arma,
  user
) {
  const policialId =
    obterPolicialId(user)

  if (!policialId) {
    return false
  }

  return [
    arma?.carga_policial_id,
    arma?.proprietario_policial_id,
    arma?.responsavel_atual_id,
    arma?.recebedor_id
  ].some(
    (id) =>
      id &&
      String(id) ===
        String(policialId)
  )
}

function filtrarArmasPorPerfil(
  lista,
  user
) {
  const perfil =
    obterPerfilEfetivo(user)

  if (
    perfil ===
      PERFIS.ADMINISTRADOR ||
    perfil ===
      PERFIS.COMANDANTE_CIA
  ) {
    return lista
  }

  if (perfil === PERFIS.P4) {
    // O P4 é o gestor patrimonial da Companhia e precisa enxergar
    // a distribuição completa: depósito, SVDD, cautelas, carga,
    // manutenção e demais situações.
    return lista
  }

  if (
    perfil ===
      PERFIS.ENCARREGADO_SVDD ||
    perfil ===
      PERFIS.AUXILIAR_SVDD
  ) {
    return lista.filter((arma) => {
      const status =
        statusArma(arma)

      const local =
        localArma(arma)

      const particular =
        normalizar(
          arma?.propriedade
        ) === 'PARTICULAR'

      const cargaPermanente =
        status === 'CARGA' ||
        local.includes('CARGA PERMANENTE')

      if (
        particular ||
        cargaPermanente
      ) {
        return false
      }

      if (
        local.includes('SVDD') ||
        local.includes(
          'SERVICO DE DIA'
        )
      ) {
        return true
      }

      if (
        status.includes('CAUTELA') ||
        local.includes('CAUTELA')
      ) {
        return origemCautelaEhSvdd(
          arma?.origem_cautela
        )
      }

      if (
        status.includes(
          'MANUTENCAO'
        ) ||
        local.includes(
          'MANUTENCAO'
        )
      ) {
        const origem =
          arma?.origem_cautela ||
          arma?.origem_local ||
          arma?.local_origem

        return origem
          ? origemCautelaEhSvdd(origem)
          : true
      }

      return false
    })
  }

  if (
    perfil === PERFIS.USUARIO ||
    perfil ===
      PERFIS.USUARIO_EXTERNO
  ) {
    return lista.filter(
      (arma) =>
        armaPertenceAoUsuario(
          arma,
          user
        )
    )
  }

  return lista
}

function ajustarTonfasPorPerfil(
  resumo,
  user
) {
  const perfil =
    obterPerfilEfetivo(user)

  if (
    perfil ===
      PERFIS.ADMINISTRADOR ||
    perfil ===
      PERFIS.COMANDANTE_CIA
  ) {
    return resumo
  }

  if (perfil === PERFIS.P4) {
    // O P4 acompanha todo o ciclo patrimonial da Companhia.
    // Mantém os saldos originais de P4, SVDD, em serviço e manutenção.
    return resumo
  }

  if (
    perfil ===
      PERFIS.ENCARREGADO_SVDD ||
    perfil ===
      PERFIS.AUXILIAR_SVDD
  ) {
    const ajustarDetalhe =
      (detalhe) => ({
        ...detalhe,

        total:
          Number(
            detalhe.svdd || 0
          ) +
          Number(
            detalhe.emServico || 0
          ) +
          Number(
            detalhe.manutencao || 0
          ),

        p4: 0
      })

    const tonfasDetalhe =
      ajustarDetalhe(
        resumo.tonfasDetalhe
      )

    const cassetetesDetalhe =
      ajustarDetalhe(
        resumo.cassetetesDetalhe
      )

    return {
      ...resumo,

      geral: {
        ...resumo.geral,

        total:
          tonfasDetalhe.total +
          cassetetesDetalhe.total,

        p4: 0,

        tonfas:
          tonfasDetalhe.total,

        cassetetes:
          cassetetesDetalhe.total
      },

      tonfasDetalhe,
      cassetetesDetalhe
    }
  }

  return resumo
}

async function resumirPatrimoniosIndividualizados(user) {
  const {
    data,
    error
  } = await supabase
    .from('sigmo_patrimonios')
    .select('id, tipo, status, local_atual, ativo')
    .eq('ativo', true)
    .in('tipo', ['arma', 'ht', 'tpd', 'taser', 'cop'])

  if (error) {
    throw error
  }

  const lista = data || []
  const perfil =
    obterPerfilEfetivo(user)

  const visaoSomenteSvdd =
    perfil === PERFIS.ENCARREGADO_SVDD ||
    perfil === PERFIS.AUXILIAR_SVDD

  const origemPorPatrimonio =
    await carregarOrigemCautelaPorPatrimonio(
      lista.map((item) => item?.id)
    )

  const resumo = {
    total: 0,
    noCofre: 0,
    emServico: 0,
    manutencao: 0,
    carga: 0,
    outros: 0,
    individuais: {
      total: 0,
      p4: 0,
      svdd: 0,
      emServico: 0,
      manutencao: 0,
      carga: 0,
      naoLocalizados: 0
    }
  }

  for (const item of lista) {
    const tipo = normalizar(item?.tipo)
    const status = normalizar(item?.status)
    const local = normalizar(item?.local_atual)

    const cautela =
      origemPorPatrimonio.get(
        String(item?.id || '')
      )

    const origemCautela =
      cautela?.origem_local ||
      ''

    const emServico =
      status === 'CAUTELADO' ||
      status === 'EM SERVICO' ||
      status === 'EM_SERVICO' ||
      local.includes('CAUTELA')

    if (
      visaoSomenteSvdd &&
      emServico &&
      !origemCautelaEhSvdd(
        origemCautela
      )
    ) {
      continue
    }

    resumo.total += 1

    let classificacao = 'outros'

    if (
      status.includes('MANUTENCAO') ||
      local.includes('MANUTENCAO')
    ) {
      resumo.manutencao += 1
      classificacao = 'manutencao'
    } else if (
      status === 'CARGA' ||
      local.includes('CARGA PERMANENTE')
    ) {
      resumo.carga += 1
      classificacao = 'carga'
    } else if (emServico) {
      resumo.emServico += 1
      classificacao = 'emServico'
    } else if (
      local.includes('COFRE DO SVDD') ||
      local === 'SVDD' ||
      local.includes('SERVICO DE DIA')
    ) {
      resumo.noCofre += 1
      classificacao = 'svdd'
    } else {
      resumo.outros += 1

      if (
        local.includes('P4') ||
        local.includes('DEPOSITO DO P4') ||
        local.includes('GUARDA DO P4') ||
        local.includes('COFRE DO P4')
      ) {
        classificacao = 'p4'
      }
    }

    if (tipo === 'ARMA') {
      continue
    }

    resumo.individuais.total += 1

    if (classificacao === 'manutencao') {
      resumo.individuais.manutencao += 1
    } else if (classificacao === 'carga') {
      resumo.individuais.carga += 1
    } else if (classificacao === 'emServico') {
      resumo.individuais.emServico += 1
    } else if (classificacao === 'svdd') {
      resumo.individuais.svdd += 1
    } else if (classificacao === 'p4') {
      resumo.individuais.p4 += 1
    } else {
      resumo.individuais.naoLocalizados += 1
    }
  }

  return resumo
}

const INICIAL = {
  armas: {
    total: 0,
    p4: 0,
    svdd: 0,
    carga: 0,
    cautelas: 0,
    manutencao: 0,
    naoLocalizadas: 0,
    particulares: 0
  },
  tonfas: {
    total: 0,
    tonfas: 0,
    cassetetes: 0,
    p4: 0,
    svdd: 0,
    emServico: 0,
    manutencao: 0
  },
  tonfasDetalhe: {
    total: 0,
    p4: 0,
    svdd: 0,
    emServico: 0,
    manutencao: 0
  },
  cassetetesDetalhe: {
    total: 0,
    p4: 0,
    svdd: 0,
    emServico: 0,
    manutencao: 0
  },
  individuais: {
    total: 0,
    p4: 0,
    svdd: 0,
    emServico: 0,
    manutencao: 0,
    carga: 0,
    naoLocalizados: 0
  },
  patrimonios: {
    total: 0,
    noCofre: 0,
    emServico: 0,
    manutencao: 0,
    carga: 0,
    outros: 0
  }
}

export default function useDashboardVitrine(
  user
) {
  const [dados, setDados] =
    useState(INICIAL)

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const atualizar =
    useCallback(async () => {
      try {
        setLoading(true)
        setErro('')

        const resultados = await Promise.allSettled([
          listarArmas({
            pagina: 1,
            limite: LIMITE
          }).then(async (resultado) => ({
            ...resultado,
            data:
              await enriquecerArmasComOrigemCautela(
                resultado?.data || []
              )
          })),
          listarTonfas({
            pagina: 1,
            limite: LIMITE
          }),
          listarManutencoes({
            status: 'EM_MANUTENCAO',
            pagina: 1,
            limite: 200
          }),
          resumirPatrimoniosIndividualizados(user)
        ])

        const [
          armasRes,
          tonfasRes,
          manutencoesRes,
          patrimoniosRes
        ] = resultados

        const falhas = [
          ['armas', armasRes],
          ['tonfas/cassetetes', tonfasRes],
          ['manutenÃ§Ãµes', manutencoesRes],
          ['patrimÃ´nios individualizados', patrimoniosRes]
        ].filter(
          ([, resultado]) =>
            resultado.status === 'rejected'
        )

        if (falhas.length > 0) {
          falhas.forEach(
            ([origem, resultado]) => {
              console.warn(
                `Falha ao carregar ${origem} na Dashboard:`,
                resultado.reason
              )
            }
          )

          throw new Error(
            `Falha parcial na Dashboard: ${falhas
              .map(([origem]) => origem)
              .join(', ')}`
          )
        }

        const armasResultado =
          armasRes.value

        const tonfasResultado =
          tonfasRes.value

        const manutencoesResultado =
          manutencoesRes.value

        const patrimoniosResumo =
          patrimoniosRes.value

        const armasFiltradas =
  filtrarArmasPorPerfil(
    armasResultado?.data || [],
    user
  )

const tonfasResumoOriginal =
  resumirTonfas(
    tonfasResultado?.data || []
  )

const individuaisResumo = {
  ...(patrimoniosResumo?.individuais || {
    total: 0,
    p4: 0,
    svdd: 0,
    emServico: 0,
    manutencao: 0,
    carga: 0,
    naoLocalizados: 0
  })
}

const individuaisEmServico =
  individuaisResumo.emServico

const tonfasResumo =
  ajustarTonfasPorPerfil(
    tonfasResumoOriginal,
    user
  )

const manutencoesAtivasOriginais =
  manutencoesResultado?.data || []

const perfilDashboard =
  obterPerfilEfetivo(user)

const visaoManutencaoSomenteSvdd =
  perfilDashboard === PERFIS.ENCARREGADO_SVDD ||
  perfilDashboard === PERFIS.AUXILIAR_SVDD

const manutencoesAtivas =
  visaoManutencaoSomenteSvdd
    ? manutencoesAtivasOriginais.filter((item) =>
        normalizar(item?.origem_institucional) === 'SVDD'
      )
    : manutencoesAtivasOriginais

// A tabela de manutenções é a fonte de verdade para "EM MANUTENÇÃO".
// Alguns módulos individualizados (TASER/HT/TPD) ainda podem permanecer
// com local_atual no cofre enquanto a manutenção está ativa. Por isso,
// ajustamos a vitrine sem depender exclusivamente de sigmo_patrimonios.
const manutencoesPatrimoniaisAtivas =
  manutencoesAtivas.filter((item) =>
    ['ARMAS', 'HT', 'TPD', 'TASER', 'COP'].includes(
      normalizar(item?.modulo)
    )
  )

const manutencoesIndividuaisAtivas =
  manutencoesAtivas.filter((item) =>
    ['HT', 'TPD', 'TASER', 'COP'].includes(
      normalizar(item?.modulo)
    )
  )

const patrimonioIdsEmManutencao = [
  ...new Set(
    manutencoesPatrimoniaisAtivas
      .map((item) => item?.patrimonio_id)
      .filter(Boolean)
      .map(String)
  )
]

let manutencoesAindaContadasNoCofre = 0
let manutencoesIndividuaisAindaNoSvdd = 0
let manutencoesIndividuaisAindaNoP4 = 0

if (patrimonioIdsEmManutencao.length > 0) {
  const {
    data: patrimoniosEmManutencao,
    error: patrimoniosManutencaoError
  } = await supabase
    .from('sigmo_patrimonios')
    .select('id, tipo, status, local_atual')
    .in('id', patrimonioIdsEmManutencao)

  if (patrimoniosManutencaoError) {
    console.warn(
      'Não foi possível ajustar os locais dos itens em manutenção:',
      patrimoniosManutencaoError
    )
  } else {
    for (const patrimonio of patrimoniosEmManutencao || []) {
      const status = normalizar(patrimonio?.status)
      const local = normalizar(patrimonio?.local_atual)

      const jaClassificadoComoManutencao =
        status.includes('MANUTENCAO') ||
        local.includes('MANUTENCAO')

      if (jaClassificadoComoManutencao) {
        continue
      }

      if (
        local.includes('COFRE DO SVDD') ||
        local === 'SVDD' ||
        local.includes('SERVICO DE DIA')
      ) {
        manutencoesAindaContadasNoCofre += 1

        if (normalizar(patrimonio?.tipo) !== 'ARMA') {
          manutencoesIndividuaisAindaNoSvdd += 1
        }

        continue
      }

      if (
        local.includes('P4') ||
        local.includes('DEPOSITO DO P4') ||
        local.includes('GUARDA DO P4') ||
        local.includes('COFRE DO P4')
      ) {
        if (normalizar(patrimonio?.tipo) !== 'ARMA') {
          manutencoesIndividuaisAindaNoP4 += 1
        }
      }
    }
  }
}

const manutencaoPatrimonialTotal =
  manutencoesPatrimoniaisAtivas.reduce(
    (total, item) =>
      total + Number(item?.quantidade || 1),
    0
  )

const manutencaoIndividualTotal =
  manutencoesIndividuaisAtivas.reduce(
    (total, item) =>
      total + Number(item?.quantidade || 1),
    0
  )


individuaisResumo.manutencao =
  manutencaoIndividualTotal

individuaisResumo.svdd =
  Math.max(
    0,
    Number(individuaisResumo.svdd || 0) -
      manutencoesIndividuaisAindaNoSvdd
  )

individuaisResumo.p4 =
  Math.max(
    0,
    Number(individuaisResumo.p4 || 0) -
      manutencoesIndividuaisAindaNoP4
  )

const manutencaoArmas =
  manutencoesAtivas
    .filter(
      (item) =>
        normalizar(item?.modulo) ===
        'ARMAS'
    )
    .reduce(
      (total, item) =>
        total +
        Number(item?.quantidade || 1),
      0
    )

const manutencaoTonfas =
  manutencoesAtivas
    .filter(
      (item) =>
        normalizar(item?.modulo) ===
        'TONFAS'
    )
    .reduce(
      (total, item) =>
        total +
        Number(item?.quantidade || 1),
      0
    )

const armasResumo =
  resumirArmas(
    armasFiltradas
  )

armasResumo.manutencao =
  manutencaoArmas

armasResumo.total =
  Number(armasResumo.p4 || 0) +
  Number(armasResumo.svdd || 0) +
  Number(armasResumo.carga || 0) +
  Number(armasResumo.cautelas || 0) +
  Number(armasResumo.manutencao || 0) +
  Number(armasResumo.naoLocalizadas || 0) +
  Number(armasResumo.particulares || 0)

const tonfasGeral = {
  ...tonfasResumo.geral,
  manutencao:
    manutencaoTonfas
}

setDados({
  armas:
    armasResumo,

  tonfas: {
    ...tonfasGeral
  },

  tonfasDetalhe:
    tonfasResumo
      .tonfasDetalhe,

  cassetetesDetalhe:
    tonfasResumo
      .cassetetesDetalhe,

  individuais: {
    ...individuaisResumo,
    emServico:
      individuaisEmServico
  },

  patrimonios: {
    total:
      Number(patrimoniosResumo?.total || 0),
    noCofre:
      Math.max(
        0,
        Number(patrimoniosResumo?.noCofre || 0) -
          manutencoesAindaContadasNoCofre
      ),
    emServico:
      Number(patrimoniosResumo?.emServico || 0),
    manutencao:
      manutencaoPatrimonialTotal,
    carga:
      Number(patrimoniosResumo?.carga || 0),
    outros:
      Number(patrimoniosResumo?.outros || 0)
  }
})
      } catch (error) {
        console.error(
          'Erro ao carregar vitrine do dashboard:',
          error
        )

        setErro(
          error?.message ||
            'Não foi possível carregar os indicadores da Dashboard.'
        )
      } finally {
        setLoading(false)
      }
    }, [user])

  useEffect(() => {
    atualizar()
  }, [atualizar])

  return {
    ...dados,
    loading,
    erro,
    atualizar
  }
}
