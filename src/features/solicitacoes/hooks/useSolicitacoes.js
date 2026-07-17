import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarSolicitacoes,
  criarSolicitacao,
  atualizarSolicitacaoPendente,
  cancelarSolicitacao
} from '../services/solicitacoesService'

import {
  aprovarSolicitacao,
  reprovarSolicitacao
} from '../engine/aprovacoesEngine'

const FILTROS_INICIAIS = {
  status: '',
  tipo: '',
  busca: '',
  prioridade: ''
}

const PAGINACAO_INICIAL = {
  pagina: 1,
  limite: 20,
  total: 0
}

export default function useSolicitacoes(
  filtrosIniciais = {}
) {
  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    sucesso,
    setSucesso
  ] = useState('')

  const [
    solicitacoes,
    setSolicitacoes
  ] = useState([])

  const [
    selecionada,
    setSelecionada
  ] = useState(null)

  const [
    filtros,
    setFiltros
  ] = useState({
    ...FILTROS_INICIAIS,
    ...filtrosIniciais
  })

  const [
    paginacao,
    setPaginacao
  ] = useState(
    PAGINACAO_INICIAL
  )

  const limparMensagens =
    useCallback(() => {
      setErro('')
      setSucesso('')
    }, [])

  const carregarSolicitacoes =
    useCallback(
      async (
        filtrosExtras = {}
      ) => {
        try {
          setLoading(true)
          setErro('')

          const resposta =
            await listarSolicitacoes({
              ...filtros,
              ...filtrosExtras,
              pagina:
                paginacao.pagina,
              limite:
                paginacao.limite
            })

          setSolicitacoes(
            resposta?.itens || []
          )

          setPaginacao(
            (estadoAnterior) => ({
              ...estadoAnterior,
              total:
                resposta?.total || 0
            })
          )
        } catch (error) {
          console.error(
            'Erro ao carregar solicitações:',
            error
          )

          setSolicitacoes([])

          setPaginacao(
            (estadoAnterior) => ({
              ...estadoAnterior,
              total: 0
            })
          )

          setErro(
            error?.message ||
            'Não foi possível carregar as solicitações.'
          )
        } finally {
          setLoading(false)
        }
      },
      [
        filtros,
        paginacao.pagina,
        paginacao.limite
      ]
    )

  useEffect(() => {
    carregarSolicitacoes()
  }, [
    carregarSolicitacoes
  ])

  const atualizarFiltros =
    useCallback(
      (novosFiltros) => {
        limparMensagens()

        setFiltros(
          (estadoAnterior) => ({
            ...estadoAnterior,
            ...novosFiltros
          })
        )

        setPaginacao(
          (estadoAnterior) => ({
            ...estadoAnterior,
            pagina: 1
          })
        )
      },
      [
        limparMensagens
      ]
    )

  const alterarPagina =
    useCallback(
      (novaPagina) => {
        setPaginacao(
          (estadoAnterior) => ({
            ...estadoAnterior,
            pagina:
              Math.max(
                1,
                Number(novaPagina) || 1
              )
          })
        )
      },
      []
    )

  const selecionar =
    useCallback(
      (item) => {
        setSelecionada(item)
      },
      []
    )

  const limparSelecao =
    useCallback(() => {
      setSelecionada(null)
    }, [])

  const criar =
    useCallback(
      async (dados) => {
        try {
          setLoading(true)
          limparMensagens()

          const resposta =
            await criarSolicitacao(
              dados
            )

          setSucesso(
            'Solicitação criada com sucesso.'
          )

          await carregarSolicitacoes()

          return resposta
        } catch (error) {
          console.error(error)

          setErro(
            error?.message ||
            'Não foi possível criar a solicitação.'
          )

          throw error
        } finally {
          setLoading(false)
        }
      },
      [
        carregarSolicitacoes,
        limparMensagens
      ]
    )

  const atualizar =
    useCallback(
      async (
        id,
        dados = {}
      ) => {
        try {
          setLoading(true)
          limparMensagens()

          const resposta =
            await atualizarSolicitacaoPendente({
              id,
              ...dados
            })

          setSucesso(
            'Solicitação atualizada.'
          )

          await carregarSolicitacoes()

          return resposta
        } catch (error) {
          console.error(error)

          setErro(
            error?.message ||
            'Não foi possível atualizar a solicitação.'
          )

          throw error
        } finally {
          setLoading(false)
        }
      },
      [
        carregarSolicitacoes,
        limparMensagens
      ]
    )

  const aprovar =
    useCallback(
      async (
        id,
        dados = {}
      ) => {
        try {
          setLoading(true)
          limparMensagens()

          const resposta =
            await aprovarSolicitacao({
              solicitacaoId: id,
              responsavel:
                dados.responsavel,
              observacao:
                dados.observacao || ''
            })

          setSucesso(
            'Solicitação aprovada com sucesso.'
          )

          await carregarSolicitacoes()

          return resposta
        } catch (error) {
          console.error(error)

          setErro(
            error?.message ||
            'Não foi possível aprovar a solicitação.'
          )

          throw error
        } finally {
          setLoading(false)
        }
      },
      [
        carregarSolicitacoes,
        limparMensagens
      ]
    )

  const reprovar =
    useCallback(
      async (
        id,
        dados = {}
      ) => {
        try {
          setLoading(true)
          limparMensagens()

          const resposta =
            await reprovarSolicitacao({
              solicitacaoId: id,
              responsavel:
                dados.responsavel,
              motivo:
                dados.motivo || ''
            })

          setSucesso(
            'Solicitação reprovada.'
          )

          await carregarSolicitacoes()

          return resposta
        } catch (error) {
          console.error(error)

          setErro(
            error?.message ||
            'Não foi possível reprovar a solicitação.'
          )

          throw error
        } finally {
          setLoading(false)
        }
      },
      [
        carregarSolicitacoes,
        limparMensagens
      ]
    )

  const cancelar =
    useCallback(
      async (
        id,
        dados = {}
      ) => {
        try {
          setLoading(true)
          limparMensagens()

          const resposta =
            await cancelarSolicitacao({
              id,
              canceladoPorRe:
                dados.canceladoPorRe,
              canceladoPorNome:
                dados.canceladoPorNome,
              motivo:
                dados.motivo || ''
            })

          setSucesso(
            'Solicitação cancelada.'
          )

          await carregarSolicitacoes()

          return resposta
        } catch (error) {
          console.error(error)

          setErro(
            error?.message ||
            'Não foi possível cancelar a solicitação.'
          )

          throw error
        } finally {
          setLoading(false)
        }
      },
      [
        carregarSolicitacoes,
        limparMensagens
      ]
    )

  const totalPaginas =
    useMemo(
      () =>
        Math.max(
          Math.ceil(
            paginacao.total /
            paginacao.limite
          ),
          1
        ),
      [
        paginacao.total,
        paginacao.limite
      ]
    )

  return {
    loading,
    erro,
    sucesso,
    solicitacoes,
    selecionada,
    filtros,
    paginacao,
    totalPaginas,
    carregarSolicitacoes,
    atualizarFiltros,
    alterarPagina,
    selecionar,
    limparSelecao,
    criar,
    atualizar,
    aprovar,
    reprovar,
    cancelar,
    limparMensagens,
    setSolicitacoes,
    setSelecionada
  }
}