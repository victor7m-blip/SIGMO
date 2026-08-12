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
        Boolean(
          arma?.carga_policial_id
        )

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
        return true
      }

      if (
        status.includes(
          'MANUTENCAO'
        ) ||
        local.includes(
          'MANUTENCAO'
        )
      ) {
        return true
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

        const armasFiltradas =
  filtrarArmasPorPerfil(
    armasResultado?.data || [],
    user
  )

const tonfasResumoOriginal =
  resumirTonfas(
    tonfasResultado?.data || []
  )

const tonfasResumo =
  ajustarTonfasPorPerfil(
    tonfasResumoOriginal,
    user
  )

setDados({
  armas:
    resumirArmas(
      armasFiltradas
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
