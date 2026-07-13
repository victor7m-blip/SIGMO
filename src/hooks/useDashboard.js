import {
  useEffect,
  useState
} from 'react'

import {
  carregarDashboard
} from '../services/dashboardEngine'

export default function useDashboard() {
  const [cards, setCards] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  async function atualizar() {
    setLoading(true)

    const dados =
      await carregarDashboard()

    setCards(dados.cards)

    setLoading(false)
  }

  useEffect(() => {
    atualizar()
  }, [])

  return {
    cards,
    loading,
    atualizar
  }
}