import {
  useCallback,
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

function texto(valor) {
  return String(valor ?? '').trim()
}

function textoMaiusculo(valor) {
  return texto(valor).toUpperCase()
}

function classeEvento(tipo) {
  const valor = textoMaiusculo(tipo)

  if (
    valor.includes('BAIXA') ||
    valor.includes('EXCLUSAO') ||
    valor.includes('EXCLUSÃO') ||
    valor.includes('INATIV')
  ) {
    return 'central-evento-baixa'
  }

  if (
    valor.includes('TRANSFER') ||
    valor.includes('MOVIMENT') ||
    valor.includes('LOCAL')
  ) {
    return 'central-evento-transferencia'
  }

  if (
    valor.includes('RECEB') ||
    valor.includes('DEVOL') ||
    valor.includes('RECOLH')
  ) {
    return 'central-evento-recebimento'
  }

  if (
    valor.includes('FOTO') ||
    valor.includes('QR') ||
    valor.includes('ETIQUETA')
  ) {
    return 'central-evento-midia'
  }

  if (
    valor.includes('CONFERENCIA_DIVERGENTE') ||
    valor.includes('CONFERÊNCIA_DIVERGENTE') ||
    valor.includes('DIVERGEN')
  ) {
    return 'central-evento-divergencia'
  }

  if (
    valor.includes('CONFERENCIA') ||
    valor.includes('CONFERÊNCIA') ||
    valor.includes('APROV') ||
    valor.includes('CONFIRM')
  ) {
    return 'central-evento-conferencia'
  }

  if (
    valor.includes('RESPONSAVEL') ||
    valor.includes('RESPONSÁVEL') ||
    valor.includes('CAUTELA') ||
    valor.includes('POLICIAL')
  ) {
    return 'central-evento-responsavel'
  }

  if (
    valor.includes('STATUS') ||
    valor.includes('ALTERACAO') ||
    valor.includes('ALTERAÇÃO') ||
    valor.includes('EDICAO') ||
    valor.includes('EDIÇÃO')
  ) {
    return 'central-evento-alteracao'
  }

  if (
    valor.includes('CADASTR') ||
    valor.includes('CRIACAO') ||
    valor.includes('CRIAÇÃO')
  ) {
    return 'central-evento-cadastro'
  }

  return 'central-evento-padrao'
}

function iconeEvento(tipo) {
  const valor = textoMaiusculo(tipo)

  if (
    valor.includes('BAIXA') ||
    valor.includes('EXCLUSAO') ||
    valor.includes('EXCLUSÃO') ||
    valor.includes('INATIV')
  ) {
    return '↓'
  }

  if (
    valor.includes('TRANSFER') ||
    valor.includes('MOVIMENT') ||
    valor.includes('LOCAL')
  ) {
    return '↔'
  }

  if (
    valor.includes('RECEB') ||
    valor.includes('DEVOL') ||
    valor.includes('RECOLH')
  ) {
    return '↙'
  }

  if (valor.includes('FOTO')) {
    return '▣'
  }

  if (
    valor.includes('QR') ||
    valor.includes('ETIQUETA')
  ) {
    return '⌗'
  }

  if (
    valor.includes('DIVERGEN')
  ) {
    return '!'
  }

  if (
    valor.includes('CONFERENCIA') ||
    valor.includes('CONFERÊNCIA') ||
    valor.includes('APROV') ||
    valor.includes('CONFIRM')
  ) {
    return '✓'
  }

  if (
    valor.includes('RESPONSAVEL') ||
    valor.includes('RESPONSÁVEL') ||
    valor.includes('CAUTELA') ||
    valor.includes('POLICIAL')
  ) {
    return '●'
  }

  if (
    valor.includes('STATUS') ||
    valor.includes('ALTERACAO') ||
    valor.includes('ALTERAÇÃO') ||
    valor.includes('EDICAO') ||
    valor.includes('EDIÇÃO')
  ) {
    return '✎'
  }

  if (
    valor.includes('CADASTR') ||
    valor.includes('CRIACAO') ||
    valor.includes('CRIAÇÃO')
  ) {
    return '+'
  }

  return '•'
}

function tituloTipo(tipo) {
  const valor = textoMaiusculo(tipo)

  const titulos = {
    BAIXA: 'Baixa',
    BAIXADO: 'Baixado',
    FOTO_ADICIONADA: 'Foto adicionada',
    FOTO_REMOVIDA: 'Foto removida',
    QRCODE_GERADO: 'QR Code gerado',
    ETIQUETA_IMPRESSA: 'Etiqueta impressa',
    CONFERENCIA_REALIZADA: 'Conferência realizada',
    CONFERENCIA_DIVERGENTE: 'Conferência divergente',
    RESPONSAVEL_ALTERADO: 'Responsável alterado',
    STATUS_ALTERADO: 'Status alterado',
    LOCAL_ALTERADO: 'Local alterado',
    RECEBIMENTO: 'Recebimento',
    TRANSFERENCIA: 'Transferência',
    MOVIMENTACAO: 'Movimentação',
    CADASTRO: 'Cadastro',
    EDICAO: 'Edição'
  }

  return (
    titulos[valor] ||
    valor
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(
        /^\w/,
        (letra) => letra.toUpperCase()
      )
  )
}

function valorInformado(valor) {
  const normalizado = texto(valor)

  if (!normalizado) {
    return null
  }

  return normalizado
}

function DetalhesEvento({ evento }) {
  const detalhes = [
    {
      label: 'Status anterior',
      valor: valorInformado(
        evento.status_anterior
      )
    },
    {
      label: 'Status atual',
      valor: valorInformado(
        evento.status_atual
      )
    },
    {
      label: 'Local anterior',
      valor: valorInformado(
        evento.local_anterior
      )
    },
    {
      label: 'Local atual',
      valor: valorInformado(
        evento.local_atual
      )
    },
    {
      label: 'RE responsável',
      valor: valorInformado(
        evento.responsavel_re
      )
    },
    {
      label: 'Responsável',
      valor: valorInformado(
        evento.responsavel_nome
      )
    }
  ].filter((detalhe) => detalhe.valor)

  if (detalhes.length === 0) {
    return null
  }

  return (
    <div className="central-timeline-detalhes">
      {detalhes.map((detalhe) => (
        <div
          key={detalhe.label}
          className="central-timeline-detalhe"
        >
          <span>{detalhe.label}</span>
          <strong>{detalhe.valor}</strong>
        </div>
      ))}
    </div>
  )
}

export default function TimelinePatrimonio({
  patrimonio,
  limite = 100,
  atualizarEm = null
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
    atualizando,
    setAtualizando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const carregar = useCallback(
    async ({
      silencioso = false
    } = {}) => {
      if (!patrimonio) {
        setEventos([])
        setLoading(false)
        setAtualizando(false)
        return
      }

      try {
        if (silencioso) {
          setAtualizando(true)
        } else {
          setLoading(true)
        }

        setErro('')

        const resultado =
          await listarTimelinePatrimonio({
            patrimonio,
            limite
          })

        setEventos(
          (resultado ?? []).map(
            normalizarEventoTimeline
          )
        )
      } catch (error) {
        console.error(
          'Erro ao carregar timeline patrimonial:',
          error
        )

        setErro(
          error?.message ||
          'Não foi possível carregar o histórico patrimonial.'
        )
      } finally {
        setLoading(false)
        setAtualizando(false)
      }
    },
    [
      patrimonio,
      limite
    ]
  )

  useEffect(() => {
    carregar()
  }, [
    carregar,
    patrimonio?.id,
    patrimonio?.referencia_id,
    atualizarEm
  ])

  const totalEventos = useMemo(
    () => eventos.length,
    [eventos]
  )

  const ultimoEvento = useMemo(
    () => eventos[0] ?? null,
    [eventos]
  )

  return (
    <section className="central-detalhe-secao">
      <div className="central-secao-titulo">
        <div>
          <span>HISTÓRICO</span>

          <h3>
            Timeline Patrimonial
          </h3>

          {ultimoEvento?.data && (
            <p>
              Última atividade em{' '}
              {dataHora(ultimoEvento.data)}
            </p>
          )}
        </div>

        <div className="central-timeline-acoes">
          <strong>
            {totalEventos}
          </strong>

          <button
            type="button"
            className="central-link-button"
            onClick={() =>
              carregar({
                silencioso: true
              })
            }
            disabled={
              loading ||
              atualizando
            }
          >
            {atualizando
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>
        </div>
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
            onClick={() => carregar()}
          >
            Tentar novamente
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
                    [
                      evento.origem,
                      evento.data,
                      evento.tipo,
                      index
                    ].join('-')
                  }
                  className={`central-timeline-item ${classeEvento(
                    evento.tipo
                  )}`}
                >
                  <div className="central-timeline-real-ponto">
                    <span>
                      {iconeEvento(
                        evento.tipo
                      )}
                    </span>
                  </div>

                  <div className="central-timeline-card">
                    <header>
                      <div>
                        <strong>
                          {evento.titulo ||
                            tituloTipo(
                              evento.tipo
                            )}
                        </strong>

                        {evento.origem && (
                          <small>
                            {tituloTipo(
                              evento.origem
                            )}
                          </small>
                        )}
                      </div>

                      <span className="central-timeline-tag">
                        {tituloTipo(
                          evento.tipo
                        )}
                      </span>
                    </header>

                    {evento.descricao && (
                      <p>
                        {evento.descricao}
                      </p>
                    )}

                    <DetalhesEvento
                      evento={evento}
                    />

                    <div className="central-timeline-info">
                      <span>
                        <strong>
                          Responsável:
                        </strong>{' '}
                        {evento.autor ||
                          'Sistema'}
                      </span>

                      <span>
                        <strong>
                          Data:
                        </strong>{' '}
                        {evento.data
                          ? dataHora(
                              evento.data
                            )
                          : 'Não informada'}
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