import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarTimelinePatrimonio,
  normalizarEventoTimeline
} from '../../../services/timelinePatrimonioService'

import {
  dataHora
} from '../../../utils/centralPatrimonioUtils'

function classeEvento(tipo) {
  const valor = String(tipo || '').toUpperCase()

  if (
    valor.includes('BAIXA') ||
    valor.includes('EXCLUSAO')
  ) {
    return 'central-evento-baixa'
  }

  if (
    valor.includes('TRANSFER') ||
    valor.includes('MOVIMENT')
  ) {
    return 'central-evento-transferencia'
  }

  if (
    valor.includes('RECEB') ||
    valor.includes('DEVOL')
  ) {
    return 'central-evento-recebimento'
  }

  if (
    valor.includes('FOTO') ||
    valor.includes('QR')
  ) {
    return 'central-evento-midia'
  }

  return 'central-evento-padrao'
}

export default function TimelinePatrimonio({
  patrimonio
}) {
  const [
    eventos,
    setEventos
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    erro,
    setErro
  ] = useState('')

  async function carregar() {
    try {
      setLoading(true)
      setErro('')

      const resultado =
        await listarTimelinePatrimonio({
          patrimonio,
          limite: 100
        })

      setEventos(
        resultado.map(
          normalizarEventoTimeline
        )
      )
    } catch (error) {
      console.error(error)

      setErro(
        error?.message ||
          'Não foi possível carregar o histórico.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [
    patrimonio?.id,
    patrimonio?.referencia_id
  ])

  const totalEventos =
    useMemo(
      () => eventos.length,
      [eventos]
    )

  return (
    <section className="central-detalhe-secao">

      <div className="central-secao-titulo">

        <div>

          <span>
            HISTÓRICO
          </span>

          <h3>
            Timeline Patrimonial
          </h3>

        </div>

        <strong>
          {totalEventos}
        </strong>

      </div>

      {loading && (
        <div className="central-estado">
          Carregando histórico...
        </div>
      )}

      {!loading && erro && (
        <div className="central-estado central-estado-erro">

          <strong>
            Erro ao carregar timeline
          </strong>

          <span>
            {erro}
          </span>

          <button
            type="button"
            onClick={carregar}
          >
            Atualizar
          </button>

        </div>
      )}

      {!loading &&
        !erro &&
        totalEventos === 0 && (
          <div className="central-estado">
            Nenhum evento patrimonial encontrado.
          </div>
        )}

      {!loading &&
        !erro &&
        totalEventos > 0 && (

          <div className="central-timeline-real">

            {eventos.map(
              (
                evento,
                index
              ) => (

                <article
                  key={
                    evento.id ||
                    `${evento.data}-${index}`
                  }
                  className={`central-timeline-item ${classeEvento(
                    evento.tipo
                  )}`}
                >

                  <span className="central-timeline-real-ponto" />

                  <div className="central-timeline-card">

                    <header>

                      <strong>
                        {evento.titulo}
                      </strong>

                      <span className="central-timeline-tag">
                        {evento.tipo}
                      </span>

                    </header>

                    {evento.descricao && (
                      <p>
                        {evento.descricao}
                      </p>
                    )}

                    <div className="central-timeline-info">

                      <span>

                        👤 {evento.autor}

                      </span>

                      <span>

                        🕒 {dataHora(evento.data)}

                      </span>

                    </div>

                  </div>

                </article>

              )
            )}

          </div>

        )}

    </section>
  )
}