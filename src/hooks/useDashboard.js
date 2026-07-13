import {
  useCallback,
  useEffect,
  useState
} from 'react'

import {
  carregarDashboardPatrimonial
} from '../services/dashboardService'

const ESTADO_INICIAL = {
  cards: {
    total: 0,
    ativos: 0,
    disponiveis: 0,
    cautelados: 0,
    recolhidos: 0,
    baixados: 0,
    movimentacoesHoje: 0
  },

  movimentacoes: {
    recebimentos: 0,
    transferencias: 0,
    baixas: 0
  },

  indicadores: {
    operacionais: 0,
    percentualOperacional: 0
  },

  totaisPorModulo: [],
  timeline: [],
  atualizadoEm: null
}

export default function useDashboard() {
  const [dados, setDados] =
    useState(ESTADO_INICIAL)

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const atualizar = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado =
        await carregarDashboardPatrimonial()

      setDados({
        ...ESTADO_INICIAL,
        ...resultado,

        cards: {
          ...ESTADO_INICIAL.cards,
          ...(resultado?.cards ?? {})
        },

        movimentacoes: {
          ...ESTADO_INICIAL.movimentacoes,
          ...(resultado?.movimentacoes ?? {})
        },

        indicadores: {
          ...ESTADO_INICIAL.indicadores,
          ...(resultado?.indicadores ?? {})
        },

        totaisPorModulo:
          resultado?.totaisPorModulo ?? [],

        timeline:
          resultado?.timeline ?? []
      })
    } catch (error) {
      console.error(
        'Erro ao carregar dashboard:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar o painel operacional.'
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