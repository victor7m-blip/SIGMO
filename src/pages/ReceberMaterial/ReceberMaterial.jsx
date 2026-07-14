import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarPatrimoniosResponsavel
} from '../../services/responsabilidadeService'

import {
  receberMateriais,
  LOCAL_RETORNO_PADRAO
} from '../../services/recebimentoService'

import RecebedorCard from '../PagarMaterial/components/RecebedorCard'
import CarrinhoMateriais from '../PagarMaterial/components/CarrinhoMateriais'

import '../PagarMaterial/PagarMaterial.css'

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
}

function somenteNumeros(valor) {
  return String(valor ?? '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

function obterNomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    ''
  )
}

function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function obterIdentificador(item) {
  return (
    item?.identificador ||
    item?.patrimonio ||
    item?.numero_patrimonio ||
    item?.numero_serie ||
    item?.serie ||
    item?.referencia_id ||
    item?.id ||
    'SEM IDENTIFICAÇÃO'
  )
}

function obterDescricao(item) {
  if (item?.descricao) {
    return item.descricao
  }

  const partes = [
    item?.tipo,
    item?.categoria,
    item?.marca,
    item?.modelo,
    item?.calibre
  ]
    .map((valor) =>
      String(valor ?? '').trim()
    )
    .filter(Boolean)

  return (
    partes.join(' ') ||
    'PATRIMÔNIO'
  )
}

function obterCategoria(item) {
  return normalizarTexto(
    item?.categoria ||
    item?.tipo ||
    item?.modulo ||
    'PATRIMÔNIO'
  )
}

function obterLocalOrigem(item) {
  return normalizarTexto(
    item?.local_origem ||
    item?.local_atual ||
    item?.local ||
    LOCAL_RETORNO_PADRAO
  )
}

function criarChaveItem(item) {
  return String(
    item?.patrimonio_id ||
    item?.id ||
    item?.referencia_id ||
    obterIdentificador(item)
  )
}

function normalizarItem(item) {
  return {
    ...item,

    id:
      item?.id ||
      item?.patrimonio_id ||
      item?.referencia_id,

    patrimonio_id:
      item?.patrimonio_id ||
      item?.id,

    referencia_id:
      item?.referencia_id ||
      null,

    patrimonio:
      obterIdentificador(item),

    descricao:
      normalizarTexto(
        obterDescricao(item)
      ),

    categoria:
      obterCategoria(item),

    modulo:
      normalizarTexto(
        item?.modulo ||
        item?.tipo ||
        item?.categoria ||
        'PATRIMÔNIO'
      ),

    local_origem:
      obterLocalOrigem(item),

    local_atual:
      obterLocalOrigem(item),

    quantidade: 1
  }
}

export default function ReceberMaterial({
  user,
  onVoltar = null,
  onConcluido = null
}) {
  const [
    reEntregador,
    setReEntregador
  ] = useState('')

  const [
    policialEntregador,
    setPolicialEntregador
  ] = useState(null)

  const [
    patrimonios,
    setPatrimonios
  ] = useState([])

  const [
    itensSelecionados,
    setItensSelecionados
  ] = useState([])

  const [
    busca,
    setBusca
  ] = useState('')

  const [
    documento,
    setDocumento
  ] = useState('')

  const [
    observacoes,
    setObservacoes
  ] = useState('')

  const [
    localRetorno,
    setLocalRetorno
  ] = useState(
    LOCAL_RETORNO_PADRAO
  )

  const [
    carregandoCarga,
    setCarregandoCarga
  ] = useState(false)

  const [
    salvando,
    setSalvando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    mensagem,
    setMensagem
  ] = useState('')

  const nomeEntregador =
    obterNomePolicial(
      policialEntregador
    )

  const carregarCargaPatrimonial =
    useCallback(
      async () => {
        if (
          !policialEntregador ||
          reEntregador.length !== 6
        ) {
          setPatrimonios([])
          setItensSelecionados([])
          return
        }

        try {
          setCarregandoCarga(true)
          setErro('')
          setMensagem('')

          const resultado =
            await listarPatrimoniosResponsavel({
              re: reEntregador,
              nome: nomeEntregador
            })

          const lista =
            (resultado ?? []).map(
              normalizarItem
            )

          setPatrimonios(lista)
          setItensSelecionados([])

          if (lista.length === 0) {
            setMensagem(
              'Nenhum patrimônio está vinculado a este policial.'
            )
          }
        } catch (error) {
          console.error(
            'Erro ao carregar carga patrimonial:',
            error
          )

          setPatrimonios([])
          setItensSelecionados([])

          setErro(
            error?.message ||
            'Não foi possível carregar a carga patrimonial.'
          )
        } finally {
          setCarregandoCarga(false)
        }
      },
      [
        nomeEntregador,
        policialEntregador,
        reEntregador
      ]
    )

  useEffect(() => {
    carregarCargaPatrimonial()
  }, [
    carregarCargaPatrimonial
  ])

  const patrimoniosFiltrados =
    useMemo(() => {
      const termo =
        normalizarTexto(busca)

      if (!termo) {
        return patrimonios
      }

      return patrimonios.filter(
        (item) =>
          [
            item.patrimonio,
            item.descricao,
            item.categoria,
            item.modulo,
            item.local_atual,
            item.numero_serie,
            item.serie,
            item.status
          ].some((valor) =>
            normalizarTexto(
              valor
            ).includes(termo)
          )
      )
    }, [
      busca,
      patrimonios
    ])

  const todosSelecionados =
    patrimonios.length > 0 &&
    patrimonios.every(
      (item) =>
        itensSelecionados.some(
          (selecionado) =>
            criarChaveItem(
              selecionado
            ) ===
            criarChaveItem(item)
        )
    )

  function alterarRe(valor) {
    const re =
      somenteNumeros(valor)

    setReEntregador(re)
    setPolicialEntregador(null)
    setPatrimonios([])
    setItensSelecionados([])
    setBusca('')
    setErro('')
    setMensagem('')
  }

  function selecionarEntregador(
    policial
  ) {
    setPolicialEntregador(
      policial
    )

    setPatrimonios([])
    setItensSelecionados([])
    setBusca('')
    setErro('')
    setMensagem('')
  }

  function itemEstaSelecionado(item) {
    const chave =
      criarChaveItem(item)

    return itensSelecionados.some(
      (selecionado) =>
        criarChaveItem(
          selecionado
        ) === chave
    )
  }

  function adicionarItem(item) {
    if (
      itemEstaSelecionado(item)
    ) {
      return
    }

    setItensSelecionados(
      (listaAtual) => [
        ...listaAtual,
        item
      ]
    )

    setErro('')
    setMensagem('')
  }

  function removerItem(itemId) {
    setItensSelecionados(
      (listaAtual) =>
        listaAtual.filter(
          (item) =>
            String(item.id) !==
              String(itemId) &&
            String(
              item.patrimonio_id
            ) !== String(itemId)
        )
    )
  }

  function alternarTodos() {
    if (todosSelecionados) {
      setItensSelecionados([])
      return
    }

    setItensSelecionados(
      patrimonios.map(
        normalizarItem
      )
    )
  }

  function limpar() {
    setReEntregador('')
    setPolicialEntregador(null)
    setPatrimonios([])
    setItensSelecionados([])
    setBusca('')
    setDocumento('')
    setObservacoes('')
    setLocalRetorno(
      LOCAL_RETORNO_PADRAO
    )
    setErro('')
    setMensagem('')
  }

  async function confirmarRecebimento() {
    if (!policialEntregador) {
      setErro(
        'Informe o RE de quem está entregando.'
      )
      return
    }

    if (
      reEntregador.length !== 6
    ) {
      setErro(
        'O RE de quem está entregando deve possuir 6 dígitos.'
      )
      return
    }

    if (
      itensSelecionados.length === 0
    ) {
      setErro(
        'Selecione pelo menos um patrimônio para receber.'
      )
      return
    }

    if (
      !localRetorno.trim()
    ) {
      setErro(
        'Informe o local de retorno.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')
      setMensagem('')

      const resultado =
        await receberMateriais({
          itens:
            itensSelecionados,

          entregadorRE:
            reEntregador,

          entregadorNome:
            nomeEntregador,

          localDestino:
            normalizarTexto(
              localRetorno
            ),

          documento:
            normalizarTexto(
              documento
            ),

          observacao:
            normalizarTexto(
              observacoes
            ),

          user
        })

      setMensagem(
        `${resultado.total} ${
          resultado.total === 1
            ? 'patrimônio recebido'
            : 'patrimônios recebidos'
        } com sucesso.`
      )

      const idsRecebidos =
        new Set(
          itensSelecionados.map(
            criarChaveItem
          )
        )

      setPatrimonios(
        (listaAtual) =>
          listaAtual.filter(
            (item) =>
              !idsRecebidos.has(
                criarChaveItem(item)
              )
          )
      )

      setItensSelecionados([])
      setBusca('')
      setDocumento('')
      setObservacoes('')

      onConcluido?.(
        resultado
      )
    } catch (error) {
      console.error(
        'Erro ao receber materiais:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível concluir o recebimento.'
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="pagar-material-page">
      <header className="pagar-material-header">
        <div>
          <span className="pagar-material-kicker">
            SIGMO • MOVIMENTAÇÃO
          </span>

          <h1>
            Receber Material
          </h1>

          <p>
            Identifique quem está devolvendo,
            selecione os patrimônios e confirme
            o retorno à reserva.
          </p>
        </div>

        <div className="pagar-material-operador">
          <span>
            Operador responsável
          </span>

          <strong>
            {obterNomeUsuario(user)}
          </strong>
        </div>
      </header>

      {typeof onVoltar ===
        'function' && (
        <div className="pagar-material-top-actions">
          <button
            type="button"
            className="pagar-material-refresh"
            onClick={onVoltar}
            disabled={salvando}
          >
            Voltar
          </button>
        </div>
      )}

      {erro && (
        <div className="pagar-material-feedback pagar-material-feedback-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="pagar-material-feedback pagar-material-feedback-success">
          {mensagem}
        </div>
      )}

      <section className="pagar-material-layout">
        <div className="pagar-material-main">
          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>
                  ETAPA 1
                </span>

                <h2>
                  Identificar quem está entregando
                </h2>
              </div>

              <span className="pagar-material-status">
                {policialEntregador
                  ? 'IDENTIFICADO'
                  : 'AGUARDANDO RE'}
              </span>
            </div>

            <RecebedorCard
              re={reEntregador}
              onChangeRE={
                alterarRe
              }
              onSelecionado={
                selecionarEntregador
              }
            />

            <div className="pagar-material-form-grid pagar-material-form-grid-spaced">
              <label>
                Local de retorno

                <input
                  type="text"
                  value={
                    localRetorno
                  }
                  onChange={(event) =>
                    setLocalRetorno(
                      normalizarTexto(
                        event.target.value
                      )
                    )
                  }
                  placeholder="RESERVA DE MATERIAL"
                />
              </label>

              <label>
                Documento

                <input
                  type="text"
                  value={documento}
                  onChange={(event) =>
                    setDocumento(
                      normalizarTexto(
                        event.target.value
                      )
                    )
                  }
                  placeholder="NÚMERO OU REFERÊNCIA"
                />
              </label>

              <label className="pagar-material-field-full">
                Observações

                <textarea
                  value={observacoes}
                  onChange={(event) =>
                    setObservacoes(
                      normalizarTexto(
                        event.target.value
                      )
                    )
                  }
                  placeholder="INFORMAÇÕES ADICIONAIS SOBRE O RECEBIMENTO"
                />
              </label>
            </div>
          </section>

          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>
                  ETAPA 2
                </span>

                <h2>
                  Selecionar patrimônios
                </h2>
              </div>

              <div className="pagar-material-results-head">
                <strong className="pagar-material-count">
                  {
                    patrimoniosFiltrados.length
                  }{' '}
                  encontrados
                </strong>

                <button
                  type="button"
                  className="pagar-material-refresh"
                  disabled={
                    carregandoCarga ||
                    !policialEntregador
                  }
                  onClick={
                    carregarCargaPatrimonial
                  }
                >
                  {carregandoCarga
                    ? 'Atualizando...'
                    : 'Atualizar'}
                </button>
              </div>
            </div>

            <div className="pagar-material-search">
              <input
                type="text"
                value={busca}
                onChange={(event) =>
                  setBusca(
                    normalizarTexto(
                      event.target.value
                    )
                  )
                }
                placeholder="PESQUISAR PATRIMÔNIO, SÉRIE, DESCRIÇÃO OU CATEGORIA"
                disabled={
                  !policialEntregador
                }
              />

              <button
                type="button"
                onClick={alternarTodos}
                disabled={
                  patrimonios.length === 0
                }
              >
                {todosSelecionados
                  ? 'Desmarcar todos'
                  : 'Selecionar todos'}
              </button>
            </div>

            <div className="pagar-material-table-wrap">
              <table className="pagar-material-table">
                <thead>
                  <tr>
                    <th>
                      Patrimônio
                    </th>

                    <th>
                      Descrição
                    </th>

                    <th>
                      Categoria
                    </th>

                    <th>
                      Local atual
                    </th>

                    <th>
                      Status
                    </th>

                    <th aria-label="Ações" />
                  </tr>
                </thead>

                <tbody>
                  {carregandoCarga && (
                    <tr>
                      <td
                        colSpan={6}
                        className="pagar-material-table-empty"
                      >
                        Carregando carga patrimonial...
                      </td>
                    </tr>
                  )}

                  {!carregandoCarga &&
                    !policialEntregador && (
                    <tr>
                      <td
                        colSpan={6}
                        className="pagar-material-table-empty"
                      >
                        Informe o RE de quem está entregando.
                      </td>
                    </tr>
                  )}

                  {!carregandoCarga &&
                    policialEntregador &&
                    patrimoniosFiltrados.length ===
                      0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="pagar-material-table-empty"
                      >
                        Nenhum patrimônio localizado para este policial.
                      </td>
                    </tr>
                  )}

                  {!carregandoCarga &&
                    patrimoniosFiltrados.map(
                      (item) => {
                        const selecionado =
                          itemEstaSelecionado(
                            item
                          )

                        return (
                          <tr
                            key={
                              criarChaveItem(
                                item
                              )
                            }
                          >
                            <td>
                              <strong>
                                {
                                  item.patrimonio
                                }
                              </strong>
                            </td>

                            <td>
                              {
                                item.descricao
                              }
                            </td>

                            <td>
                              {
                                item.categoria
                              }
                            </td>

                            <td>
                              {
                                item.local_atual
                              }
                            </td>

                            <td>
                              <span className="pagar-material-badge is-warning">
                                {item.status ||
                                  'CAUTELADO'}
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="pagar-material-add"
                                disabled={
                                  selecionado
                                }
                                onClick={() =>
                                  adicionarItem(
                                    item
                                  )
                                }
                              >
                                {selecionado
                                  ? 'Adicionado'
                                  : 'Adicionar'}
                              </button>
                            </td>
                          </tr>
                        )
                      }
                    )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="pagar-material-summary">
          <section className="pagar-material-card pagar-material-summary-card">
            <div className="pagar-material-card-header">
              <div>
                <span>
                  ETAPA 3
                </span>

                <h2>
                  Resumo do recebimento
                </h2>
              </div>
            </div>

            <div className="pagar-material-summary-data">
              <div>
                <span>
                  Entregador
                </span>

                <strong>
                  {nomeEntregador ||
                    'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>
                  RE
                </span>

                <strong>
                  {reEntregador ||
                    'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>
                  Retorno
                </span>

                <strong>
                  {localRetorno ||
                    'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>
                  Total de itens
                </span>

                <strong>
                  {
                    itensSelecionados.length
                  }
                </strong>
              </div>
            </div>

            <CarrinhoMateriais
              itens={
                itensSelecionados
              }
              onRemover={
                removerItem
              }
            />

            <div className="pagar-material-actions">
              <button
                type="button"
                className="pagar-material-cancel"
                disabled={salvando}
                onClick={limpar}
              >
                Limpar
              </button>

              <button
                type="button"
                className="pagar-material-confirm"
                disabled={
                  salvando ||
                  !policialEntregador ||
                  itensSelecionados.length === 0
                }
                onClick={
                  confirmarRecebimento
                }
              >
                {salvando
                  ? 'Recebendo...'
                  : 'Confirmar recebimento'}
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}