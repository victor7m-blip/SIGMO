import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarPatrimoniosResponsavel
} from '../../../services/responsabilidadeService'

import {
  registrarEventoResponsavel
} from '../../../services/timelinePatrimonioService'

import {
  nomeCategoria,
  obterIdentificadorPatrimonio,
  obterDescricaoPatrimonio,
  obterStatusPatrimonio,
  classeStatusPatrimonio
} from '../../../utils/centralPatrimonioUtils'

function texto(valor) {
  return String(valor ?? '').trim()
}

function obterDadosPatrimonio(patrimonio) {
  if (
    patrimonio?.dados &&
    typeof patrimonio.dados === 'object'
  ) {
    return patrimonio.dados
  }

  return {}
}

function obterResponsavelPatrimonio(patrimonio) {
  const dados =
    obterDadosPatrimonio(patrimonio)

  return {
    re:
      patrimonio?.responsavel_re ||
      patrimonio?.re_responsavel ||
      dados.responsavel_re ||
      dados.re_responsavel ||
      dados.recebedor_re ||
      dados.policial_re ||
      '',

    nome:
      patrimonio?.responsavel_nome ||
      patrimonio?.nome_responsavel ||
      dados.responsavel_nome ||
      dados.nome_responsavel ||
      dados.recebedor_nome ||
      dados.policial_nome ||
      ''
  }
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

function iniciais(nome) {
  const partes = texto(nome)
    .split(/\s+/)
    .filter(Boolean)

  if (partes.length === 0) {
    return 'SR'
  }

  if (partes.length === 1) {
    return partes[0]
      .substring(0, 2)
      .toUpperCase()
  }

  return (
    partes[0][0] +
    partes[partes.length - 1][0]
  ).toUpperCase()
}

export default function ResponsavelPanel({
  re = '',
  nome = '',
  patrimonio = null,
  patrimonioAtual = null,
  responsavel = null,
  responsavelRe = '',
  responsavelNome = '',
  patrimonios: patrimoniosRecebidos = null,
  user = null,
  permitirAlteracao = false,
  onAbrirPatrimonio,
  onAlterarResponsavel,
  onRemoverResponsavel,
  onAtualizar
}) {
  const patrimonioSelecionado =
    patrimonioAtual ||
    patrimonio ||
    null

  const responsavelDoPatrimonio =
    useMemo(
      () =>
        obterResponsavelPatrimonio(
          patrimonioSelecionado
        ),
      [patrimonioSelecionado]
    )

  const reAtual = texto(
    responsavelRe ||
    re ||
    responsavel?.re ||
    responsavel?.responsavel_re ||
    responsavelDoPatrimonio.re
  )

  const nomeAtual = texto(
    responsavelNome ||
    nome ||
    responsavel?.nome ||
    responsavel?.responsavel_nome ||
    responsavelDoPatrimonio.nome
  )

  const [
    patrimonios,
    setPatrimonios
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    processando,
    setProcessando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    editando,
    setEditando
  ] = useState(false)

  const [
    novoRe,
    setNovoRe
  ] = useState('')

  const [
    novoNome,
    setNovoNome
  ] = useState('')

  const carregar = useCallback(
    async () => {
      if (
        Array.isArray(
          patrimoniosRecebidos
        )
      ) {
        setPatrimonios(
          patrimoniosRecebidos
        )

        setLoading(false)
        setErro('')
        return
      }

      if (!reAtual && !nomeAtual) {
        setPatrimonios([])
        setLoading(false)
        setErro('')
        return
      }

      try {
        setLoading(true)
        setErro('')

        const resultado =
          await listarPatrimoniosResponsavel({
            re: reAtual,
            nome: nomeAtual
          })

        setPatrimonios(
          resultado ?? []
        )
      } catch (error) {
        console.error(
          'Erro ao carregar responsabilidade patrimonial:',
          error
        )

        setErro(
          error?.message ||
          'Não foi possível carregar a carga patrimonial.'
        )
      } finally {
        setLoading(false)
      }
    },
    [
      nomeAtual,
      patrimoniosRecebidos,
      reAtual
    ]
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    setNovoRe(reAtual)
    setNovoNome(nomeAtual)
  }, [
    reAtual,
    nomeAtual
  ])

  const quantidade = useMemo(
    () => patrimonios.length,
    [patrimonios]
  )

  const abrirEdicao =
    useCallback(() => {
      setNovoRe(reAtual)
      setNovoNome(nomeAtual)
      setErro('')
      setEditando(true)
    }, [
      nomeAtual,
      reAtual
    ])

  const cancelarEdicao =
    useCallback(() => {
      setNovoRe(reAtual)
      setNovoNome(nomeAtual)
      setErro('')
      setEditando(false)
    }, [
      nomeAtual,
      reAtual
    ])

  const salvarResponsavel =
    useCallback(
      async () => {
        if (
          !patrimonioSelecionado ||
          !onAlterarResponsavel
        ) {
          return
        }

        const reNormalizado =
          texto(novoRe)

        const nomeNormalizado =
          texto(novoNome)

        if (
          !reNormalizado &&
          !nomeNormalizado
        ) {
          setErro(
            'Informe o RE ou o nome do novo responsável.'
          )

          return
        }

        const responsavelAnterior = {
          re: reAtual,
          nome: nomeAtual
        }

        const responsavelNovo = {
          re: reNormalizado,
          nome: nomeNormalizado
        }

        try {
          setProcessando(true)
          setErro('')

          await onAlterarResponsavel({
            patrimonio:
              patrimonioSelecionado,

            responsavelAnterior,

            responsavelAtual:
              responsavelNovo
          })

          await registrarEventoResponsavel({
            patrimonio:
              patrimonioSelecionado,

            responsavelAnterior,

            responsavelAtual:
              responsavelNovo,

            usuario:
              obterUsuarioTimeline(user)
          })

          setEditando(false)

          await onAtualizar?.()
          await carregar()
        } catch (error) {
          console.error(
            'Erro ao alterar responsável:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível alterar o responsável.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        carregar,
        nomeAtual,
        novoNome,
        novoRe,
        onAlterarResponsavel,
        onAtualizar,
        patrimonioSelecionado,
        reAtual,
        user
      ]
    )

  const removerResponsavel =
    useCallback(
      async () => {
        if (
          !patrimonioSelecionado ||
          !onRemoverResponsavel
        ) {
          return
        }

        const responsavelAnterior = {
          re: reAtual,
          nome: nomeAtual
        }

        try {
          setProcessando(true)
          setErro('')

          await onRemoverResponsavel({
            patrimonio:
              patrimonioSelecionado,

            responsavelAnterior
          })

          await registrarEventoResponsavel({
            patrimonio:
              patrimonioSelecionado,

            responsavelAnterior,

            responsavelAtual: null,

            usuario:
              obterUsuarioTimeline(user)
          })

          setEditando(false)
          setNovoRe('')
          setNovoNome('')

          await onAtualizar?.()
          await carregar()
        } catch (error) {
          console.error(
            'Erro ao remover responsável:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível remover o responsável.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        carregar,
        nomeAtual,
        onAtualizar,
        onRemoverResponsavel,
        patrimonioSelecionado,
        reAtual,
        user
      ]
    )

  return (
    <section className="central-detalhe-secao">
      <div className="central-secao-titulo">
        <div>
          <span>
            RESPONSABILIDADE
          </span>

          <h3>
            Carga Patrimonial
          </h3>
        </div>

        <div className="central-responsavel-acoes">
          <strong>
            {quantidade}
          </strong>

          {permitirAlteracao &&
            patrimonioSelecionado &&
            !editando &&
            onAlterarResponsavel && (
              <button
                type="button"
                className="central-link-button"
                onClick={abrirEdicao}
              >
                Alterar responsável
              </button>
            )}
        </div>
      </div>

      <div className="central-responsavel-resumo">
        <div className="central-responsavel-avatar">
          {iniciais(nomeAtual)}
        </div>

        <div>
          <strong>
            {nomeAtual ||
              'Sem responsável'}
          </strong>

          <span>
            {reAtual
              ? `RE ${reAtual}`
              : 'Sem RE'}
          </span>
        </div>
      </div>

      {editando && (
        <div className="central-responsavel-form">
          <div>
            <label
              htmlFor="central-responsavel-re"
            >
              RE do responsável
            </label>

            <input
              id="central-responsavel-re"
              type="text"
              inputMode="numeric"
              value={novoRe}
              onChange={(event) =>
                setNovoRe(
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 6)
                )
              }
              placeholder="000000"
              disabled={processando}
            />
          </div>

          <div>
            <label
              htmlFor="central-responsavel-nome"
            >
              Nome do responsável
            </label>

            <input
              id="central-responsavel-nome"
              type="text"
              value={novoNome}
              onChange={(event) =>
                setNovoNome(
                  event.target.value
                )
              }
              placeholder="Nome completo"
              disabled={processando}
            />
          </div>

          <div className="central-responsavel-form-acoes">
            <button
              type="button"
              className="central-botao-secundario"
              onClick={cancelarEdicao}
              disabled={processando}
            >
              Cancelar
            </button>

            {onRemoverResponsavel &&
              (reAtual || nomeAtual) && (
                <button
                  type="button"
                  className="central-botao-secundario"
                  onClick={
                    removerResponsavel
                  }
                  disabled={processando}
                >
                  Remover responsável
                </button>
              )}

            <button
              type="button"
              className="central-botao-primario"
              onClick={
                salvarResponsavel
              }
              disabled={processando}
            >
              {processando
                ? 'Salvando...'
                : 'Salvar responsável'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="central-estado">
          Carregando carga patrimonial...
        </div>
      )}

      {!loading && erro && (
        <div className="central-estado central-estado-erro">
          <strong>
            Erro ao consultar responsável
          </strong>

          <span>
            {erro}
          </span>

          <button
            type="button"
            onClick={carregar}
            disabled={processando}
          >
            Atualizar
          </button>
        </div>
      )}

      {!loading &&
        !erro &&
        quantidade === 0 && (
          <div className="central-estado">
            Nenhum patrimônio localizado.
          </div>
        )}

      {!loading &&
        !erro &&
        quantidade > 0 && (
          <div className="central-responsabilidade-lista">
            {patrimonios.map(
              (item) => {
                const status =
                  obterStatusPatrimonio(
                    item
                  )

                const atual =
                  patrimonioSelecionado &&
                  (
                    String(item.id) ===
                      String(
                        patrimonioSelecionado.id
                      ) ||
                    (
                      item.referencia_id &&
                      String(
                        item.referencia_id
                      ) ===
                        String(
                          patrimonioSelecionado
                            .referencia_id
                        )
                    )
                  )

                return (
                  <button
                    type="button"
                    key={
                      item.id ||
                      item.referencia_id
                    }
                    className={
                      atual
                        ? 'central-responsabilidade-item atual'
                        : 'central-responsabilidade-item'
                    }
                    onClick={() =>
                      onAbrirPatrimonio?.(
                        item
                      )
                    }
                  >
                    <div className="central-responsabilidade-info">
                      <span>
                        {nomeCategoria(
                          item.tipo
                        )}
                      </span>

                      <strong>
                        {obterIdentificadorPatrimonio(
                          item
                        )}
                      </strong>

                      <small>
                        {obterDescricaoPatrimonio(
                          item
                        )}
                      </small>
                    </div>

                    <span
                      className={`central-status ${classeStatusPatrimonio(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </button>
                )
              }
            )}
          </div>
        )}
    </section>
  )
}