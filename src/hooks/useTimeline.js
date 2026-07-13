import {
  useEffect,
  useState
} from 'react'

import {
  carregarTimeline
} from '../services/timelineEngine'

export default function useTimeline() {
  const [timeline, setTimeline] =
    useState([])

  async function atualizar() {
    const dados =
      await carregarTimeline()

    setTimeline(dados)
  }

  useEffect(() => {
    atualizar()
  }, [])

  return {
    timeline,
    atualizar
  }
}