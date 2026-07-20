import { useEffect, useRef } from 'react'
import './sigmoHorizontalScroll.css'

export default function SigmoHorizontalScroll({
  targetRef,
  width = 0
}) {
  const scrollRef = useRef(null)
  const sincronizando = useRef(false)

  useEffect(() => {
    const barra = scrollRef.current
    const tabela = targetRef?.current

    if (!barra || !tabela) return

    function atualizarLargura() {
      const conteudo =
        tabela.querySelector('table')

      if (!conteudo) return

      barra.firstChild.style.width =
        `${conteudo.scrollWidth}px`
    }

    function barraParaTabela() {
      if (sincronizando.current) return

      sincronizando.current = true

      tabela.scrollLeft =
        barra.scrollLeft

      requestAnimationFrame(() => {
        sincronizando.current = false
      })
    }

    function tabelaParaBarra() {
      if (sincronizando.current) return

      sincronizando.current = true

      barra.scrollLeft =
        tabela.scrollLeft

      requestAnimationFrame(() => {
        sincronizando.current = false
      })
    }

    atualizarLargura()

    barra.addEventListener(
      'scroll',
      barraParaTabela
    )

    tabela.addEventListener(
      'scroll',
      tabelaParaBarra
    )

    window.addEventListener(
      'resize',
      atualizarLargura
    )

    return () => {
      barra.removeEventListener(
        'scroll',
        barraParaTabela
      )

      tabela.removeEventListener(
        'scroll',
        tabelaParaBarra
      )

      window.removeEventListener(
        'resize',
        atualizarLargura
      )
    }
  }, [targetRef, width])

  return (
    <div
      className="sigmo-horizontal-scroll"
      ref={scrollRef}
    >
      <div />
    </div>
  )
}