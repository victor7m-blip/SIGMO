import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarCautelasAtivas
} from '../../../services/tonfasMovimentacoesService'

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
}

function formatarDataHora(valor) {
  if (!valor) {
    return 'NÃO INFORMADO'
  }

  const data =
    new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return 'NÃO INFORMADO'
  }

  return data.toLocaleString(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  )
}

function formatarData(valor) {
  if (!valor) {
    return 'SEM PREVISÃO'
  }

  const data =
    new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return 'SEM PREVISÃO'
  }

  return data.toLocaleDateString(
    'pt-BR'
  )
}

function cautelaVencida(item) {
  if (!item?.devolucao_prevista) {
    return false
  }

  const data =
    new Date(
      item.devolucao_prevista
    )

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return false
  }

  return (
    data.getTime() <
    Date.now()
  )
}

export default function TonfaCautelasModal({
  aberto,
  onClose,
  onVerHistorico = null
}) {
  const [
    cautelas,
    setCautelas
  ] = useState([])

  const [
    filtro,
    setFiltro
  ] = useState('TODOS')

  const [
    pesquisa,
    setPesquisa
  ] = useState('')

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const carregar =
    useCallback(
      async () => {
        if (!aberto) {
          return
        }

        try {
          setLoading(true)
          setErro('')

          const resultado =
            await listarCautelasAtivas()

          setCautelas(
            resultado ?? []
          )
        } catch (error) {
          console.error(
            'Erro ao carregar cautelas ativas:',
            error
          )

          setCautelas([])

          setErro(
            error?.message ||
            'Não foi possível carregar as cautelas ativas.'
          )
        } finally {
          setLoading(false)
        }
      },
      [aberto]
    )

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!aberto) {
      setFiltro('TODOS')
      setPesquisa('')
      setErro('')
    }
  }, [aberto])

  const cautelasFiltradas =
    useMemo(() => {
      const termo =
        normalizarTexto(
          pesquisa
        )

      return cautelas.filter(
        (item) => {
          const tipo =
            normalizarTexto(
              item.tipo_material
            )

          const passaTipo =
            filtro === 'TODOS' ||
            tipo === filtro

          const passaPesquisa =
            !termo ||
            [
              item.policial_nome,
              item.policial_re,
              item.tipo_material,
              item.retirado_por,
              item.observacoes
            ].some((valor) =>
              normalizarTexto(
                valor
              ).includes(termo)
            )

          return (
            passaTipo &&
            passaPesquisa
          )
        }
      )
    }, [
      cautelas,
      filtro,
      pesquisa
    ])

  const resumo =
    useMemo(() => {
      return {
        total:
          cautelas.reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.quantidade ||
                0
              ),
            0
          ),

        tonfas:
          cautelas
            .filter(
              (item) =>
                normalizarTexto(
                  item.tipo_material
                ) === 'TONFA'
            )
            .reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.quantidade ||
                  0
                ),
              0
            ),

        cassetetes:
          cautelas
            .filter(
              (item) =>
                normalizarTexto(
                  item.tipo_material
                ) ===
                'CASSETETE'
            )
            .reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.quantidade ||
                  0
                ),
              0
            )
      }
    }, [cautelas])

  if (!aberto) {
    return null
  }

  return (
    <div
      className="tonfa-modal-backdrop"
      onMouseDown={onClose}
    >
      <section
        className="tonfa-modal tonfa-cautelas-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="tonfa-modal-header">
          <div>
            <span>
              Controle operacional
            </span>

            <h2>
              Cautelas ativas
            </h2>

            <p className="tonfa-cautelas-subtitulo">
              Policiais com Tonfas ou
              Cassetetes em serviço.
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="tonfa-cautelas-resumo">
          <div>
            <span>
              Total em serviço
            </span>

            <strong>
              {resumo.total}
            </strong>
          </div>

          <div>
            <span>
              Tonfas
            </span>

            <strong>
              {resumo.tonfas}
            </strong>
          </div>

          <div>
            <span>
              Cassetetes
            </span>

            <strong>
              {resumo.cassetetes}
            </strong>
          </div>
        </div>

        <div className="tonfa-cautelas-toolbar">
          <input
            type="text"
            value={pesquisa}
            onChange={(event) =>
              setPesquisa(
                event.target.value
              )
            }
            placeholder="PESQUISAR POLICIAL, RE OU OPERADOR"
          />

          <div className="tonfa-cautelas-filtros">
            <button
              type="button"
              className={
                filtro ===
                'TODOS'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setFiltro('TODOS')
              }
            >
              Todos
            </button>

            <button
              type="button"
              className={
                filtro ===
                'TONFA'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setFiltro('TONFA')
              }
            >
              Tonfas
            </button>

            <button
              type="button"
              className={
                filtro ===
                'CASSETETE'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setFiltro(
                  'CASSETETE'
                )
              }
            >
              Cassetetes
            </button>
          </div>

          <button
            type="button"
            className="tonfa-btn-secondary"
            onClick={carregar}
            disabled={loading}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>
        </div>

        {erro && (
          <div className="tonfa-alert-error">
            {erro}
          </div>
        )}

        <div className="tonfa-cautelas-lista">
          {loading && (
            <div className="tonfa-cautelas-vazio">
              Carregando cautelas...
            </div>
          )}

          {!loading &&
            cautelasFiltradas.length ===
              0 && (
            <div className="tonfa-cautelas-vazio">
              Nenhuma cautela ativa
              localizada.
            </div>
          )}

          {!loading &&
            cautelasFiltradas.map(
              (item) => {
                const vencida =
                  cautelaVencida(
                    item
                  )

                return (
                  <article
                    key={item.id}
                    className={`tonfa-cautela-card ${
                      vencida
                        ? 'is-vencida'
                        : ''
                    }`}
                  >
                    <div className="tonfa-cautela-card-header">
                      <div>
                        <span>
                          Policial responsável
                        </span>

                        <h3>
                          {
                            item.policial_nome
                          }
                        </h3>

                        <p>
                          RE{' '}
                          {
                            item.policial_re
                          }
                        </p>
                      </div>

                      <span className="tonfa-cautela-status">
                        {vencida
                          ? 'VENCIDA'
                          : 'EM SERVIÇO'}
                      </span>
                    </div>

                    <div className="tonfa-cautela-dados">
                      <div>
                        <span>
                          Material
                        </span>

                        <strong>
                          {
                            item.tipo_material
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Quantidade
                        </span>

                        <strong>
                          {
                            item.quantidade
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Entregue em
                        </span>

                        <strong>
                          {formatarDataHora(
                            item.criado_em
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Operador
                        </span>

                        <strong>
                          {item.retirado_por ||
                            'NÃO INFORMADO'}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Previsão
                        </span>

                        <strong>
                          {formatarData(
                            item.devolucao_prevista
                          )}
                        </strong>
                      </div>
                    </div>

                    {item.observacoes && (
                      <div className="tonfa-cautela-observacao">
                        <span>
                          Observações
                        </span>

                        <p>
                          {
                            item.observacoes
                          }
                        </p>
                      </div>
                    )}

                    {typeof onVerHistorico ===
                      'function' && (
                      <div className="tonfa-cautela-acoes">
                        <button
                          type="button"
                          className="tonfa-btn-secondary"
                          onClick={() =>
                            onVerHistorico(
                              item
                            )
                          }
                        >
                          Ver histórico
                        </button>
                      </div>
                    )}
                  </article>
                )
              }
            )}
        </div>
      </section>
    </div>
  )
}