import {
  useCallback,
  useMemo,
  useState
} from 'react'

import {
  registrarEventoFoto,
  registrarEventoTimelinePatrimonial
} from '../../../services/timelinePatrimonioService'

function normalizarFoto(foto, index) {
  if (!foto) {
    return null
  }

  if (typeof foto === 'string') {
    return {
      id: `foto-${index}`,
      url: foto,
      nome: `Foto ${index + 1}`,
      legenda: '',
      principal: index === 0
    }
  }

  return {
    ...foto,

    id:
      foto.id ||
      foto.foto_id ||
      `foto-${index}`,

    url:
      foto.url ||
      foto.public_url ||
      foto.foto_url ||
      foto.arquivo_url ||
      '',

    nome:
      foto.nome ||
      foto.filename ||
      foto.arquivo ||
      `Foto ${index + 1}`,

    legenda:
      foto.legenda ||
      foto.descricao ||
      '',

    principal:
      foto.principal === true ||
      foto.foto_principal === true
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

export default function GaleriaFotos({
  patrimonio = null,
  fotos = [],
  titulo = 'Galeria Patrimonial',
  user = null,
  permitirUpload = false,
  permitirExclusao = false,
  permitirPrincipal = false,
  onAdicionarFoto,
  onRemoverFoto,
  onDefinirPrincipal,
  onAtualizar
}) {
  const [
    fotoAtual,
    setFotoAtual
  ] = useState(-1)

  const [
    processando,
    setProcessando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const lista = useMemo(
    () =>
      fotos
        .map(normalizarFoto)
        .filter(
          (foto) =>
            foto &&
            foto.url
        ),
    [fotos]
  )

  const abrir = useCallback(
    (indice) => {
      setFotoAtual(indice)
    },
    []
  )

  const fechar = useCallback(
    () => {
      setFotoAtual(-1)
    },
    []
  )

  const anterior = useCallback(
    (event) => {
      event.stopPropagation()

      setFotoAtual((atual) =>
        atual <= 0
          ? lista.length - 1
          : atual - 1
      )
    },
    [lista.length]
  )

  const proxima = useCallback(
    (event) => {
      event.stopPropagation()

      setFotoAtual((atual) =>
        atual >= lista.length - 1
          ? 0
          : atual + 1
      )
    },
    [lista.length]
  )

  const registrarAdicaoTimeline =
    useCallback(
      async (foto) => {
        if (!patrimonio) {
          return
        }

        await registrarEventoFoto({
          patrimonio,
          foto,
          usuario:
            obterUsuarioTimeline(user)
        })
      },
      [
        patrimonio,
        user
      ]
    )

  const registrarRemocaoTimeline =
    useCallback(
      async (foto) => {
        if (!patrimonio) {
          return
        }

        await registrarEventoTimelinePatrimonial({
          patrimonioId:
            patrimonio.id,

          referenciaId:
            patrimonio.referencia_id,

          tipo:
            'FOTO_REMOVIDA',

          titulo:
            'Foto removida',

          descricao:
            'Uma foto foi removida do patrimônio.',

          usuarioId:
            user?.id ||
            user?.user_id ||
            null,

          usuarioNome:
            user?.nome ||
            user?.nome_completo ||
            user?.email ||
            'Usuário SIGMO',

          dados: {
            foto_id:
              foto?.id,

            foto_url:
              foto?.url,

            arquivo:
              foto?.nome
          }
        })
      },
      [
        patrimonio,
        user
      ]
    )

  const registrarPrincipalTimeline =
    useCallback(
      async (foto) => {
        if (!patrimonio) {
          return
        }

        await registrarEventoTimelinePatrimonial({
          patrimonioId:
            patrimonio.id,

          referenciaId:
            patrimonio.referencia_id,

          tipo:
            'FOTO_PRINCIPAL_ALTERADA',

          titulo:
            'Foto principal alterada',

          descricao:
            'A foto principal do patrimônio foi alterada.',

          usuarioId:
            user?.id ||
            user?.user_id ||
            null,

          usuarioNome:
            user?.nome ||
            user?.nome_completo ||
            user?.email ||
            'Usuário SIGMO',

          dados: {
            foto_id:
              foto?.id,

            foto_url:
              foto?.url,

            arquivo:
              foto?.nome
          }
        })
      },
      [
        patrimonio,
        user
      ]
    )

  const adicionarFoto =
    useCallback(
      async (event) => {
        const arquivo =
          event.target.files?.[0]

        event.target.value = ''

        if (!arquivo) {
          return
        }

        try {
          setProcessando(true)
          setErro('')

          const fotoCriada =
            await onAdicionarFoto?.({
              arquivo,
              patrimonio
            })

          if (fotoCriada) {
            await registrarAdicaoTimeline(
              normalizarFoto(
                fotoCriada,
                lista.length
              )
            )
          }

          onAtualizar?.()
        } catch (error) {
          console.error(
            'Erro ao adicionar foto:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível adicionar a foto.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        lista.length,
        onAdicionarFoto,
        onAtualizar,
        patrimonio,
        registrarAdicaoTimeline
      ]
    )

  const removerFoto =
    useCallback(
      async (
        event,
        foto,
        indice
      ) => {
        event.stopPropagation()

        try {
          setProcessando(true)
          setErro('')

          await onRemoverFoto?.({
            foto,
            patrimonio
          })

          await registrarRemocaoTimeline(
            foto
          )

          if (
            fotoAtual === indice
          ) {
            setFotoAtual(-1)
          }

          onAtualizar?.()
        } catch (error) {
          console.error(
            'Erro ao remover foto:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível remover a foto.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        fotoAtual,
        onAtualizar,
        onRemoverFoto,
        patrimonio,
        registrarRemocaoTimeline
      ]
    )

  const definirPrincipal =
    useCallback(
      async (
        event,
        foto
      ) => {
        event.stopPropagation()

        try {
          setProcessando(true)
          setErro('')

          await onDefinirPrincipal?.({
            foto,
            patrimonio
          })

          await registrarPrincipalTimeline(
            foto
          )

          onAtualizar?.()
        } catch (error) {
          console.error(
            'Erro ao definir foto principal:',
            error
          )

          setErro(
            error?.message ||
            'Não foi possível alterar a foto principal.'
          )
        } finally {
          setProcessando(false)
        }
      },
      [
        onAtualizar,
        onDefinirPrincipal,
        patrimonio,
        registrarPrincipalTimeline
      ]
    )

  const fotoSelecionada =
    fotoAtual >= 0
      ? lista[fotoAtual]
      : null

  return (
    <section className="central-detalhe-secao">
      <div className="central-secao-titulo">
        <div>
          <span>
            FOTOS
          </span>

          <h3>
            {titulo}
          </h3>
        </div>

        <div className="central-galeria-acoes">
          <strong>
            {lista.length}
          </strong>

          {permitirUpload &&
            onAdicionarFoto && (
              <label className="central-link-button">
                {processando
                  ? 'Processando...'
                  : 'Adicionar foto'}

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={
                    adicionarFoto
                  }
                  disabled={
                    processando
                  }
                  hidden
                />
              </label>
            )}
        </div>
      </div>

      {patrimonio && (
        <div className="central-galeria-info">
          <strong>
            {patrimonio.identificador ||
              patrimonio.numero_patrimonio ||
              patrimonio.patrimonio ||
              patrimonio.numero_serie ||
              patrimonio.serie ||
              'Patrimônio'}
          </strong>

          <span>
            Registro fotográfico do patrimônio
          </span>
        </div>
      )}

      {erro && (
        <div className="central-estado central-estado-erro">
          <strong>
            Erro na galeria
          </strong>

          <span>
            {erro}
          </span>
        </div>
      )}

      {lista.length === 0 && (
        <div className="central-estado">
          Nenhuma foto cadastrada.
        </div>
      )}

      {lista.length > 0 && (
        <div className="central-galeria">
          {lista.map(
            (
              foto,
              index
            ) => (
              <article
                key={
                  foto.id ||
                  `${foto.url}-${index}`
                }
                className="central-galeria-item-wrapper"
              >
                <button
                  type="button"
                  className="central-galeria-item"
                  onClick={() =>
                    abrir(index)
                  }
                >
                  <img
                    src={foto.url}
                    alt={
                      foto.legenda ||
                      `Foto ${index + 1}`
                    }
                    loading="lazy"
                  />

                  <div>
                    <span>
                      {foto.nome ||
                        `Foto ${index + 1}`}
                    </span>

                    {foto.principal && (
                      <strong>
                        Principal
                      </strong>
                    )}
                  </div>
                </button>

                {(permitirPrincipal ||
                  permitirExclusao) && (
                  <div className="central-galeria-item-acoes">
                    {permitirPrincipal &&
                      onDefinirPrincipal &&
                      !foto.principal && (
                        <button
                          type="button"
                          onClick={(event) =>
                            definirPrincipal(
                              event,
                              foto
                            )
                          }
                          disabled={
                            processando
                          }
                        >
                          Tornar principal
                        </button>
                      )}

                    {permitirExclusao &&
                      onRemoverFoto && (
                        <button
                          type="button"
                          onClick={(event) =>
                            removerFoto(
                              event,
                              foto,
                              index
                            )
                          }
                          disabled={
                            processando
                          }
                        >
                          Remover
                        </button>
                      )}
                  </div>
                )}
              </article>
            )
          )}
        </div>
      )}

      {fotoSelecionada && (
        <div
          className="central-foto-modal"
          onClick={fechar}
        >
          <button
            type="button"
            className="central-foto-modal-fechar"
            onClick={fechar}
          >
            ×
          </button>

          {lista.length > 1 && (
            <button
              type="button"
              className="central-foto-anterior"
              onClick={anterior}
            >
              ‹
            </button>
          )}

          <img
            src={fotoSelecionada.url}
            alt={
              fotoSelecionada.legenda ||
              `Foto ${fotoAtual + 1}`
            }
            onClick={(event) =>
              event.stopPropagation()
            }
          />

          {lista.length > 1 && (
            <button
              type="button"
              className="central-foto-proxima"
              onClick={proxima}
            >
              ›
            </button>
          )}

          <div className="central-foto-indice">
            {fotoAtual + 1} / {lista.length}
          </div>

          {(fotoSelecionada.nome ||
            fotoSelecionada.legenda) && (
            <div className="central-foto-legenda">
              <strong>
                {fotoSelecionada.nome}
              </strong>

              {fotoSelecionada.legenda && (
                <span>
                  {fotoSelecionada.legenda}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}