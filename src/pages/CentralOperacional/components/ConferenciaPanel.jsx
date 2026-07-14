import {
  useCallback,
  useMemo,
  useState
} from 'react'

import {
  cancelarConferencia,
  finalizarConferencia,
  iniciarConferencia,
  montarResumoConferencia,
  registrarLeituraConferencia
} from '../../../services/conferenciaService'

import {
  encontrarPatrimonioPorQr
} from '../../../services/qrScannerService'

import {
  registrarEventoConferencia
} from '../../../services/timelinePatrimonioService'

import {
  dataHora,
  nomeCategoria,
  obterDescricaoPatrimonio,
  obterIdentificadorPatrimonio,
  obterLocalPatrimonio
} from '../../../utils/centralPatrimonioUtils'

import QRScanner from './QRScanner'

function ResultadoLeitura({
  resultado
}) {
  if (!resultado) {
    return null
  }

  const classe =
    resultado.tipo === 'ERRO'
      ? 'central-leitura-erro'
      : resultado.tipo === 'DUPLICADA'
        ? 'central-leitura-aviso'
        : 'central-leitura-sucesso'

  return (
    <div
      className={`central-leitura-resultado ${classe}`}
    >
      <strong>
        {resultado.tipo === 'ERRO'
          ? 'Patrimônio não encontrado'
          : resultado.tipo === 'DUPLICADA'
            ? 'QR já conferido'
            : 'Patrimônio conferido'}
      </strong>

      <span>
        {resultado.mensagem ||
          (
            resultado.patrimonio
              ? obterIdentificadorPatrimonio(
                  resultado.patrimonio
                )
              : ''
          )}
      </span>

      {resultado.patrimonio && (
        <small>
          {obterDescricaoPatrimonio(
            resultado.patrimonio
          )}
        </small>
      )}
    </div>
  )
}

function obterUsuarioTimeline(user) {
  if (!user) {
    return null
  }

  return {
    id:
      user.id ||
      user.user_id ||
      null,

    nome:
      user.nome ||
      user.nome_completo ||
      user.user_metadata?.nome ||
      user.user_metadata?.full_name ||
      user.email ||
      'Usuário SIGMO',

    email:
      user.email ||
      null
  }
}

function obterIdsLeituras(conferencia) {
  const ids = new Set()

  for (
    const leitura
    of conferencia?.leituras ?? []
  ) {
    if (leitura.patrimonio_id) {
      ids.add(
        String(leitura.patrimonio_id)
      )
    }

    if (leitura.referencia_id) {
      ids.add(
        String(leitura.referencia_id)
      )
    }
  }

  return ids
}

function patrimonioFoiEncontrado(
  patrimonio,
  idsEncontrados
) {
  const ids = [
    patrimonio?.id,
    patrimonio?.referencia_id
  ]
    .filter(Boolean)
    .map(String)

  return ids.some(
    (id) => idsEncontrados.has(id)
  )
}

export default function ConferenciaPanel({
  categoria,
  patrimonio = null,
  patrimonios = [],
  user = null,
  aberto = true,
  onFechar,
  onConferenciaFinalizada
}) {
  const [
    conferencia,
    setConferencia
  ] = useState(null)

  const [
    resultadoLeitura,
    setResultadoLeitura
  ] = useState(null)

  const [
    resumoFinal,
    setResumoFinal
  ] = useState(null)

  const [
    processando,
    setProcessando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const listaPatrimonios = useMemo(() => {
    if (
      Array.isArray(patrimonios) &&
      patrimonios.length > 0
    ) {
      return patrimonios
    }

    if (patrimonio) {
      return [patrimonio]
    }

    return []
  }, [
    patrimonio,
    patrimonios
  ])

  const resumo = useMemo(
    () =>
      montarResumoConferencia(
        conferencia
      ),
    [conferencia]
  )

  const patrimonioMap = useMemo(() => {
    const mapa = new Map()

    listaPatrimonios.forEach(
      (item) => {
        if (item.id) {
          mapa.set(
            String(item.id),
            item
          )
        }

        if (item.referencia_id) {
          mapa.set(
            String(item.referencia_id),
            item
          )
        }
      }
    )

    return mapa
  }, [listaPatrimonios])

  const leituras = useMemo(() => {
    return (
      conferencia?.leituras ?? []
    )
      .map((item) => ({
        ...item,

        patrimonio:
          patrimonioMap.get(
            String(
              item.patrimonio_id
            )
          ) ||
          patrimonioMap.get(
            String(
              item.referencia_id
            )
          )
      }))
      .reverse()
  }, [
    conferencia,
    patrimonioMap
  ])

  const iniciar = useCallback(
    async () => {
      try {
        setProcessando(true)
        setErro('')

        const nova =
          await iniciarConferencia({
            categoria:
              categoria?.tipo ||
              categoria?.categoria ||
              patrimonio?.tipo,

            local:
              categoria?.local ||
              categoria?.local_atual ||
              patrimonio?.local_atual,

            usuario: user,

            patrimoniosEsperados:
              listaPatrimonios
          })

        setConferencia(nova)
        setResultadoLeitura(null)
        setResumoFinal(null)
      } catch (error) {
        console.error(
          'Erro ao iniciar conferência:',
          error
        )

        setErro(
          error?.message ||
          'Não foi possível iniciar a conferência.'
        )
      } finally {
        setProcessando(false)
      }
    },
    [
      categoria,
      listaPatrimonios,
      patrimonio,
      user
    ]
  )

  const registrar = useCallback(
    async ({ codigo }) => {
      if (!conferencia) {
        return
      }

      try {
        setErro('')

        const patrimonioEncontrado =
          encontrarPatrimonioPorQr({
            codigo,
            patrimonios:
              listaPatrimonios
          })

        if (!patrimonioEncontrado) {
          setResultadoLeitura({
            tipo: 'ERRO',

            mensagem:
              'QR não pertence a esta conferência.'
          })

          return
        }

        const resultado =
          await registrarLeituraConferencia({
            conferenciaId:
              conferencia.id,

            patrimonio:
              patrimonioEncontrado,

            codigoLido:
              codigo
          })

        setConferencia({
          ...resultado.conferencia
        })

        setResultadoLeitura({
          tipo:
            resultado.duplicada
              ? 'DUPLICADA'
              : 'SUCESSO',

          patrimonio:
            patrimonioEncontrado
        })
      } catch (error) {
        console.error(
          'Erro ao registrar leitura:',
          error
        )

        setResultadoLeitura({
          tipo: 'ERRO',

          mensagem:
            error?.message ||
            'Não foi possível registrar a leitura.'
        })
      }
    },
    [
      conferencia,
      listaPatrimonios
    ]
  )

  const registrarEventosTimeline =
    useCallback(
      async (
        resultadoConferencia
      ) => {
        const conferenciaFinal =
          resultadoConferencia
            ?.conferencia ||
          conferencia

        const idsEncontrados =
          obterIdsLeituras(
            conferenciaFinal
          )

        const usuarioTimeline =
          obterUsuarioTimeline(user)

        const registros =
          listaPatrimonios.map(
            (item) => {
              const encontrado =
                patrimonioFoiEncontrado(
                  item,
                  idsEncontrados
                )

              return registrarEventoConferencia({
                patrimonio: item,

                conferencia: {
                  id:
                    conferenciaFinal?.id,

                  resultado:
                    encontrado
                      ? 'CONFERIDO'
                      : 'DIVERGENTE',

                  status:
                    encontrado
                      ? 'CONFERIDO'
                      : 'DIVERGENTE',

                  local_atual:
                    obterLocalPatrimonio(
                      item
                    ),

                  observacao:
                    encontrado
                      ? 'Patrimônio localizado e conferido fisicamente.'
                      : 'Patrimônio previsto não foi localizado durante a conferência física.'
                },

                usuario:
                  usuarioTimeline
              })
            }
          )

        const resultados =
          await Promise.allSettled(
            registros
          )

        const falhas =
          resultados.filter(
            (resultado) =>
              resultado.status ===
              'rejected'
          )

        if (falhas.length > 0) {
          console.warn(
            'Alguns eventos da conferência não foram gravados na timeline:',
            falhas
          )
        }
      },
      [
        conferencia,
        listaPatrimonios,
        user
      ]
    )

  const finalizar =
    useCallback(
      async () => {
        if (!conferencia) {
          return
        }

        try {
          setProcessando(true)
          setErro('')

          const resultado =
            await finalizarConferencia(
              conferencia.id
            )

          setConferencia({
            ...resultado.conferencia
          })

          setResumoFinal(resultado)

          await registrarEventosTimeline(
            resultado
          )

          onConferenciaFinalizada?.(
            resultado
          )
        } catch (error) {
          console.error(
            'Erro ao finalizar conferência:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível finalizar a conferência.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        conferencia,
        onConferenciaFinalizada,
        registrarEventosTimeline
      ]
    )

  const cancelar =
    useCallback(
      async () => {
        try {
          setProcessando(true)
          setErro('')

          if (conferencia?.id) {
            await cancelarConferencia(
              conferencia.id
            )
          }

          setConferencia(null)
          setResultadoLeitura(null)
          setResumoFinal(null)

          onFechar?.()
        } catch (error) {
          console.error(
            'Erro ao cancelar conferência:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível cancelar a conferência.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        conferencia,
        onFechar
      ]
    )

  const fecharFinalizacao =
    useCallback(() => {
      setConferencia(null)
      setResultadoLeitura(null)
      setResumoFinal(null)
      setErro('')

      onFechar?.()
    }, [onFechar])

  if (!aberto) {
    return null
  }

  return (
    <section className="central-detalhe-secao">
      <div className="central-secao-titulo">
        <div>
          <span>
            CONFERÊNCIA
          </span>

          <h3>
            Conferência Física
          </h3>
        </div>
      </div>

      {erro && (
        <div className="central-estado central-estado-erro">
          <strong>
            Erro na conferência
          </strong>

          <span>
            {erro}
          </span>
        </div>
      )}

      {!conferencia && (
        <div className="central-conferencia-start">
          <h4>
            {nomeCategoria(
              categoria?.tipo ||
              categoria?.categoria ||
              patrimonio?.tipo
            )}
          </h4>

          <p>
            {listaPatrimonios.length}{' '}
            {listaPatrimonios.length === 1
              ? 'patrimônio previsto.'
              : 'patrimônios previstos.'}
          </p>

          <button
            type="button"
            className="central-botao-primario"
            onClick={iniciar}
            disabled={
              processando ||
              listaPatrimonios.length === 0
            }
          >
            {processando
              ? 'Iniciando...'
              : 'Iniciar Conferência'}
          </button>
        </div>
      )}

      {conferencia &&
        !resumoFinal && (
          <>
            <div className="central-conferencia-resumo">
              <article>
                <span>
                  Esperados
                </span>

                <strong>
                  {resumo.totalEsperado}
                </strong>
              </article>

              <article>
                <span>
                  Encontrados
                </span>

                <strong>
                  {resumo.encontrados}
                </strong>
              </article>

              <article>
                <span>
                  Ausentes
                </span>

                <strong>
                  {resumo.ausentes}
                </strong>
              </article>

              <article>
                <span>
                  Excedentes
                </span>

                <strong>
                  {resumo.excedentes}
                </strong>
              </article>
            </div>

            <div className="central-conferencia-barra">
              <div
                style={{
                  width:
                    `${resumo.percentual}%`
                }}
              />
            </div>

            <QRScanner
              onLeitura={registrar}
              desabilitado={
                processando
              }
            />

            <ResultadoLeitura
              resultado={
                resultadoLeitura
              }
            />

            <div className="central-leituras-lista">
              {leituras.length === 0 && (
                <div className="central-estado">
                  Nenhum patrimônio lido.
                </div>
              )}

              {leituras.map(
                (item) => (
                  <article
                    key={
                      item.id ||
                      [
                        item.codigo_lido,
                        item.lido_em
                      ].join('-')
                    }
                  >
                    <div>
                      <strong>
                        {item.patrimonio
                          ? obterIdentificadorPatrimonio(
                              item.patrimonio
                            )
                          : item.codigo_lido}
                      </strong>

                      <span>
                        {item.patrimonio
                          ? obterDescricaoPatrimonio(
                              item.patrimonio
                            )
                          : 'Patrimônio externo'}
                      </span>

                      <small>
                        {item.patrimonio
                          ? obterLocalPatrimonio(
                              item.patrimonio
                            )
                          : ''}
                      </small>
                    </div>

                    <div>
                      <span>
                        {item.esperado
                          ? 'Esperado'
                          : 'Excedente'}
                      </span>

                      <small>
                        {dataHora(
                          item.lido_em
                        )}
                      </small>
                    </div>
                  </article>
                )
              )}
            </div>

            <div className="central-conferencia-acoes">
              <button
                type="button"
                className="central-botao-secundario"
                onClick={cancelar}
                disabled={processando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="central-botao-primario"
                onClick={finalizar}
                disabled={processando}
              >
                {processando
                  ? 'Finalizando...'
                  : 'Finalizar'}
              </button>
            </div>
          </>
        )}

      {resumoFinal && (
        <div className="central-conferencia-final">
          <h3>
            Conferência Finalizada
          </h3>

          <p>
            {dataHora(
              resumoFinal
                .conferencia
                .finalizado_em
            )}
          </p>

          <div className="central-conferencia-resumo">
            <article>
              <span>
                Esperados
              </span>

              <strong>
                {resumoFinal.totalEsperado}
              </strong>
            </article>

            <article>
              <span>
                Encontrados
              </span>

              <strong>
                {resumoFinal.encontrados}
              </strong>
            </article>

            <article>
              <span>
                Ausentes
              </span>

              <strong>
                {resumoFinal.ausentes}
              </strong>
            </article>

            <article>
              <span>
                Excedentes
              </span>

              <strong>
                {resumoFinal.excedentes}
              </strong>
            </article>
          </div>

          <button
            type="button"
            className="central-botao-primario"
            onClick={
              fecharFinalizacao
            }
          >
            Fechar
          </button>
        </div>
      )}
    </section>
  )
}