import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  listarArmas
} from '../services/armasService'

import {
  listarTonfas
} from '../services/tonfasService'

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

function resumirArmas(lista) {
  const resumo = {
    total: lista.length,
    p4: 0,
    svdd: 0,
    carga: 0,
    cautelas: 0,
    manutencao: 0,
    naoLocalizadas: 0,
    particulares: 0
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
  }
}

export default function useDashboardVitrine() {
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

        const [
          armasResultado,
          tonfasResultado
        ] = await Promise.all([
          listarArmas({
            pagina: 1,
            limite: LIMITE
          }),
          listarTonfas({
            pagina: 1,
            limite: LIMITE
          })
        ])

        const tonfasResumo =
          resumirTonfas(
            tonfasResultado?.data ||
              []
          )

        setDados({
          armas: resumirArmas(
            armasResultado?.data ||
              []
          ),
          tonfas:
            tonfasResumo.geral,
          tonfasDetalhe:
            tonfasResumo
              .tonfasDetalhe,
          cassetetesDetalhe:
            tonfasResumo
              .cassetetesDetalhe
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
    }, [])

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
