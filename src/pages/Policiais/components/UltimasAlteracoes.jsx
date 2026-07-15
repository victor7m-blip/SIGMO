import {
  useEffect,
  useState
} from 'react'

import {
  listarUltimasAlteracoesPoliciais
} from '../../../services/auditoriaService'

import '../styles/ultimasAlteracoes.css'

const LIMITE = 10

function texto(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return ''
  }

  if (
    typeof valor === 'object'
  ) {
    try {
      return JSON.stringify(
        valor
      )
    } catch {
      return String(valor)
    }
  }

  const resultado =
    String(valor).trim()

  if (
    resultado === '[object Object]'
  ) {
    return (
      'Alteração registrada no cadastro.'
    )
  }

  return resultado
}

function formatarDataHora(
  valor
) {
  if (!valor) {
    return 'Data não informada'
  }

  const data =
    new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return 'Data não informada'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(data)
}

function obterNomeAtor(
  item
) {
  return (
    texto(item?.ator_nome) ||
    'SIGMO'
  )
}

function obterDescricao(
  item
) {
  const descricao =
    texto(
      item?.descricao
    )

  if (
    descricao &&
    descricao !==
      'Evento registrado no sistema.'
  ) {
    return descricao
  }

  const acao =
    texto(
      item?.acao
    )
      .replace(
        /_/g,
        ' '
      )
      .toLowerCase()

  if (!acao) {
    return (
      'Realizou uma alteração no cadastro.'
    )
  }

  return (
    `Realizou a ação ${acao}.`
  )
}

function obterTituloAcao(
  acao
) {
  const chave =
    texto(acao)
      .toUpperCase()

  const titulos = {
    CREATE:
      'Cadastro realizado',

    CADASTRAR:
      'Cadastro realizado',

    CADASTRO:
      'Cadastro realizado',

    UPDATE:
      'Cadastro atualizado',

    ATUALIZAR:
      'Cadastro atualizado',

    EDICAO:
      'Cadastro atualizado',

    DELETE:
      'Cadastro excluído',

    EXCLUSAO:
      'Cadastro excluído',

    FOTO_ADICIONADA:
      'Foto adicionada',

    FOTO_REMOVIDA:
      'Foto removida',

    FOTO_PRINCIPAL:
      'Foto principal alterada',

    FOTO_BAIXADA:
      'Foto baixada',

    PIN_GERADO:
      'Novo PIN gerado',

    NOVO_PIN:
      'Novo PIN gerado',

    QR_CODE_GERADO:
      'QR Code gerado',

    VISUALIZACAO:
      'Cadastro visualizado',

    PESQUISA:
      'Pesquisa realizada'
  }

  return (
    titulos[chave] ||
    chave
      .replace(
        /_/g,
        ' '
      )
      .toLowerCase()
      .replace(
        /(^|\s)\S/g,
        (letra) =>
          letra.toUpperCase()
      ) ||
    'Alteração registrada'
  )
}

function obterClasseAcao(
  acao
) {
  const chave =
    texto(acao)
      .toUpperCase()

  if (
    chave.includes(
      'DELETE'
    ) ||
    chave.includes(
      'EXCL'
    ) ||
    chave.includes(
      'REMOVID'
    )
  ) {
    return 'danger'
  }

  if (
    chave.includes(
      'FOTO'
    )
  ) {
    return 'photo'
  }

  if (
    chave.includes(
      'CREATE'
    ) ||
    chave.includes(
      'CADAST'
    )
  ) {
    return 'success'
  }

  if (
    chave.includes(
      'PIN'
    ) ||
    chave.includes(
      'QR'
    )
  ) {
    return 'security'
  }

  return 'update'
}

function obterSigla(
  acao
) {
  const titulo =
    obterTituloAcao(
      acao
    )

  const palavras =
    titulo
      .split(/\s+/)
      .filter(Boolean)

  if (
    palavras.length === 0
  ) {
    return 'AL'
  }

  if (
    palavras.length === 1
  ) {
    return palavras[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return (
    palavras[0][0] +
    palavras[1][0]
  ).toUpperCase()
}

export default function UltimasAlteracoes({
  reloadKey = 0,
  somenteProprio = false
}) {
  const [
    alteracoes,
    setAlteracoes
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(
    !somenteProprio
  )

  const [
    erro,
    setErro
  ] = useState('')

  useEffect(() => {
    /*
     * USUÁRIO não pode carregar nem
     * visualizar a auditoria global.
     *
     * O histórico próprio será criado
     * posteriormente com consulta
     * específica e segura.
     */
    if (somenteProprio) {
      setAlteracoes([])
      setLoading(false)
      setErro('')

      return
    }

    carregarAlteracoes()
  }, [
    reloadKey,
    somenteProprio
  ])

  async function carregarAlteracoes() {
    /*
     * Proteção adicional para impedir
     * chamadas manuais pelo componente.
     */
    if (somenteProprio) {
      return
    }

    try {
      setLoading(true)
      setErro('')

      const resultado =
        await listarUltimasAlteracoesPoliciais(
          LIMITE
        )

      setAlteracoes(
        resultado || []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar últimas alterações:',
        error
      )

      setAlteracoes([])

      setErro(
        'Não foi possível carregar as últimas alterações.'
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * Não renderiza o histórico global
   * para o perfil USUÁRIO.
   */
  if (somenteProprio) {
    return null
  }

  return (
    <section className="policiais-ultimas-alteracoes">
      <header className="policiais-ultimas-header">
        <div>
          <span>
            HISTÓRICO RECENTE
          </span>

          <h2>
            Últimas alterações
          </h2>

          <p>
            Dez registros mais recentes relacionados ao cadastro de policiais.
          </p>
        </div>

        <button
          type="button"
          onClick={
            carregarAlteracoes
          }
          disabled={
            loading
          }
        >
          {loading
            ? 'Atualizando...'
            : 'Atualizar'}
        </button>
      </header>

      {loading &&
        alteracoes.length === 0 && (
          <div className="policiais-ultimas-feedback">
            Carregando últimas alterações...
          </div>
        )}

      {erro && (
        <div className="policiais-ultimas-feedback policiais-ultimas-feedback-error">
          {erro}
        </div>
      )}

      {!loading &&
        !erro &&
        alteracoes.length === 0 && (
          <div className="policiais-ultimas-feedback">
            Nenhuma alteração de policiais encontrada.
          </div>
        )}

      {alteracoes.length > 0 && (
        <div className="policiais-ultimas-lista">
          {alteracoes.map(
            (
              item,
              index
            ) => {
              const classe =
                obterClasseAcao(
                  item.acao
                )

              return (
                <article
                  key={
                    item.id ||
                    `${item.data_hora}-${index}`
                  }
                  className="policiais-ultima-item"
                >
                  <div
                    className={
                      `policiais-ultima-icone ` +
                      `policiais-ultima-icone-${classe}`
                    }
                  >
                    {obterSigla(
                      item.acao
                    )}
                  </div>

                  <div className="policiais-ultima-conteudo">
                    <div className="policiais-ultima-linha">
                      <strong>
                        {obterTituloAcao(
                          item.acao
                        )}
                      </strong>

                      <time>
                        {formatarDataHora(
                          item.data_hora
                        )}
                      </time>
                    </div>

                    <p>
                      {obterDescricao(
                        item
                      )}
                    </p>

                    <div className="policiais-ultima-meta">
                      <span>
                        Por{' '}
                        <strong>
                          {obterNomeAtor(
                            item
                          )}
                        </strong>
                      </span>

                      {item.perfil && (
                        <span>
                          {texto(
                            item.perfil
                          )}
                        </span>
                      )}

                      {item.modulo && (
                        <span>
                          {texto(
                            item.modulo
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            }
          )}
        </div>
      )}
    </section>
  )
}