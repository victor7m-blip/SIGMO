import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  STATUS_COP
} from '../../constants/cops'

import COPForm from './components/COPForm'
import COPTable from './components/COPTable'
import COPDetalhesModal from './components/COPDetalhesModal'
import COPManutencaoModal from './components/COPManutencaoModal'

import {
  cadastrarSuportesCOP,
  enviarCOPParaManutencao,
  listarCOPs,
  listarCOPsDisponiveisManutencao,
  obterResumoCOPs,
  obterResumoSuportesCOP
} from '../../services/copsService'

import {
  listarFotosCOP
} from '../../services/copsFotosService'

import {
  aceitarTransferenciaCOP,
  criarTransferenciaCOPPendente,
  listarTransferenciasCOPCriadasPendentes,
  listarTransferenciasCOPPendentes
} from '../../services/copsTransferenciaService'

import './styles/COP.css'

const LIMITE = 20

const RESUMO_INICIAL = {
  total: 0,
  reserva: 0,
  emServico: 0,
  manutencao: 0,
  baixadas: 0,
  inativas: 0,
  outros: 0
}

const RESUMO_SUPORTES_INICIAL = {
  modular: {
    total: 0,
    disponivel: 0,
    emServico: 0
  },
  comum: {
    total: 0,
    disponivel: 0,
    emServico: 0
  },
  total: 0,
  disponivel: 0,
  emServico: 0
}

export default function COP({ user }) {
  const [cops, setCOPs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] =
    useState(false)
  const [erro, setErro] = useState('')

  const [resumo, setResumo] =
    useState(RESUMO_INICIAL)

  const [
    resumoSuportes,
    setResumoSuportes
  ] = useState(
    RESUMO_SUPORTES_INICIAL
  )

  const [
    suportesModalAberto,
    setSuportesModalAberto
  ] = useState(false)

  const [
    quantidadeSuporteModular,
    setQuantidadeSuporteModular
  ] = useState('')

  const [
    quantidadeSuporteComum,
    setQuantidadeSuporteComum
  ] = useState('')

  const [
    salvandoSuportes,
    setSalvandoSuportes
  ] = useState(false)

  const [erroSuportes, setErroSuportes] =
    useState('')

  const [formAberto, setFormAberto] =
    useState(false)
  const [copEditando, setCOPEditando] =
    useState(null)
  const [copVisualizando, setCOPVisualizando] =
    useState(null)

  const [copManutencao, setCOPManutencao] =
    useState(null)

  const [salvandoManutencao, setSalvandoManutencao] =
    useState(false)

  const [seletorManutencaoAberto, setSeletorManutencaoAberto] =
    useState(false)

  const [buscaSeletorManutencao, setBuscaSeletorManutencao] =
    useState('')

  const [copsSeletorManutencao, setCOPsSeletorManutencao] =
    useState([])

  const [carregandoSeletorManutencao, setCarregandoSeletorManutencao] =
    useState(false)

  const [fotosVisualizacao, setFotosVisualizacao] =
    useState([])
  const [carregandoFotos, setCarregandoFotos] =
    useState(false)
  const [erroFotos, setErroFotos] =
    useState('')

  const [transferenciaModalAberta, setTransferenciaModalAberta] =
    useState(false)
  const [modoTransferencia, setModoTransferencia] =
    useState('ENVIAR')
  const [buscaTransferencia, setBuscaTransferencia] =
    useState('')
  const [copsTransferencia, setCOPsTransferencia] =
    useState([])
  const [transferenciasReceber, setTransferenciasReceber] =
    useState([])
  const [copsSelecionadasTransferencia, setCOPsSelecionadasTransferencia] =
    useState([])
  const [carregandoTransferencia, setCarregandoTransferencia] =
    useState(false)
  const [processandoTransferenciaId, setProcessandoTransferenciaId] =
    useState(null)

  const [sortBy, setSortBy] =
    useState('numero')
  const [sortDirection, setSortDirection] =
    useState('asc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    marca: '',
    status_operacional: '',
    local_atual: '',
    ativo: 'true'
  })

  const perfilNormalizado = normalizarPerfil(
    user?.perfil ||
    user?.profile ||
    user?.role ||
    user?.tipo_perfil ||
    ''
  )

  const podeEditar = [
    'ADMINISTRADOR',
    'P4'
  ].includes(perfilNormalizado)

  const podeManutencao = [
    'ADMINISTRADOR',
    'P4',
    'SVDD',
    'ENCARREGADO SVDD',
    'ENCARREGADO DO SVDD',
    'AUXILIAR SVDD',
    'AUXILIAR DO SVDD'
  ].includes(perfilNormalizado)

  const ehPerfilP4 = [
    'ADMINISTRADOR',
    'P4'
  ].includes(perfilNormalizado)

  const ehPerfilSVDD = [
    'SVDD',
    'ENCARREGADO SVDD',
    'ENCARREGADO DO SVDD',
    'AUXILIAR SVDD',
    'AUXILIAR DO SVDD'
  ].includes(perfilNormalizado)

  const podeTransferirCOP =
    ehPerfilP4 || ehPerfilSVDD

  const origemTransferencia =
    ehPerfilP4
      ? 'P4'
      : 'SVDD'

  const destinoTransferencia =
    ehPerfilP4
      ? 'SVDD'
      : 'P4'

  const localOrigemTransferencia =
    ehPerfilP4
      ? 'COFRE DO P4'
      : 'COFRE DO SVDD'

  const localDestinoTransferencia =
    ehPerfilP4
      ? 'COFRE DO SVDD'
      : 'COFRE DO P4'

  const totalPaginas = useMemo(
    () => Math.max(
      1,
      Math.ceil(total / LIMITE)
    ),
    [total]
  )

  const copsElegiveisManutencao = useMemo(
    () => {
      const termo = String(
        buscaSeletorManutencao || ''
      )
        .trim()
        .toUpperCase()

      return (
        copsSeletorManutencao || []
      )
        .filter((cop) => {
          const status = String(
            cop?.status_operacional || ''
          )
            .trim()
            .toUpperCase()

          return (
            cop?.ativo !== false &&
            status !== 'MANUTENCAO' &&
            status !== 'BAIXADA'
          )
        })
        .filter((cop) => {
          if (!termo) return true

          return [
            cop?.numero,
            cop?.identificacao_equipamento,
            cop?.marca,
            cop?.local_atual
          ].some((valor) =>
            String(valor || '')
              .toUpperCase()
              .includes(termo)
          )
        })
    },
    [
      copsSeletorManutencao,
      buscaSeletorManutencao
    ]
  )

  const copsTransferenciaFiltradas = useMemo(
    () => {
      const termo = String(
        buscaTransferencia || ''
      )
        .trim()
        .toUpperCase()

      return (
        copsTransferencia || []
      ).filter((cop) => {
        if (!termo) return true

        return [
          cop?.numero,
          cop?.identificacao_equipamento,
          cop?.marca,
          cop?.local_atual
        ].some((valor) =>
          String(valor || '')
            .toUpperCase()
            .includes(termo)
        )
      })
    },
    [
      copsTransferencia,
      buscaTransferencia
    ]
  )

  const carregarResumo = useCallback(
    async () => {
      try {
        const dados = await obterResumoCOPs()

        setResumo(
          dados || RESUMO_INICIAL
        )
      } catch (error) {
        console.error(
          'Erro ao carregar resumo das COPs:',
          error
        )
      }
    },
    []
  )

  const carregarResumoSuportes = useCallback(
    async () => {
      try {
        const dados =
          await obterResumoSuportesCOP()

        setResumoSuportes(
          dados ||
          RESUMO_SUPORTES_INICIAL
        )
      } catch (error) {
        console.error(
          'Erro ao carregar resumo dos suportes de COP:',
          error
        )

        setResumoSuportes(
          RESUMO_SUPORTES_INICIAL
        )
      }
    },
    []
  )

  const carregarCOPs = useCallback(
    async () => {
      try {
        setLoading(true)
        setErro('')

        const resultado = await listarCOPs({
          filtros: {
            pesquisa:
              filtros.pesquisa.trim(),
            marca: filtros.marca,
            status_operacional:
              filtros.status_operacional,
            local_atual:
              filtros.local_atual,
            ativo: filtros.ativo
          },
          pagina,
          limite: LIMITE,
          sortBy,
          sortDirection
        })

        setCOPs(resultado.data || [])
        setTotal(resultado.total || 0)
      } catch (error) {
        console.error(error)

        setErro(
          error.message ||
          'Erro ao carregar as COPs.'
        )
      } finally {
        setLoading(false)
      }
    },
    [
      filtros,
      pagina,
      sortBy,
      sortDirection
    ]
  )

  useEffect(() => {
    carregarCOPs()
  }, [carregarCOPs])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  useEffect(() => {
    carregarResumoSuportes()
  }, [carregarResumoSuportes])

  function handleFiltroChange(event) {
    const { name, value } = event.target

    setFiltros((prev) => ({
      ...prev,
      [name]: value
    }))

    setPagina(1)
  }

  function limparFiltros() {
    setFiltros({
      pesquisa: '',
      marca: '',
      status_operacional: '',
      local_atual: '',
      ativo: 'true'
    })

    setPagina(1)
  }

  function rolarParaFormulario() {
    requestAnimationFrame(() => {
      document
        .querySelector('.cop-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function limparVisualizacao() {
    setCOPVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirCadastroSuportes() {
    if (!podeEditar) return

    setQuantidadeSuporteModular('')
    setQuantidadeSuporteComum('')
    setErroSuportes('')
    setSuportesModalAberto(true)
  }

  function fecharCadastroSuportes() {
    if (salvandoSuportes) return

    setSuportesModalAberto(false)
    setQuantidadeSuporteModular('')
    setQuantidadeSuporteComum('')
    setErroSuportes('')
  }

  async function salvarCadastroSuportes(event) {
    event.preventDefault()

    const modular =
      Number(
        quantidadeSuporteModular ||
        0
      )

    const comum =
      Number(
        quantidadeSuporteComum ||
        0
      )

    if (
      !Number.isInteger(modular) ||
      !Number.isInteger(comum) ||
      modular < 0 ||
      comum < 0
    ) {
      setErroSuportes(
        'Informe quantidades inteiras maiores ou iguais a zero.'
      )
      return
    }

    if (
      modular === 0 &&
      comum === 0
    ) {
      setErroSuportes(
        'Informe ao menos uma quantidade de suporte para cadastrar.'
      )
      return
    }

    try {
      setSalvandoSuportes(true)
      setErroSuportes('')

      await cadastrarSuportesCOP({
        modular,
        comum
      })

      await carregarResumoSuportes()

      setSuportesModalAberto(false)
      setQuantidadeSuporteModular('')
      setQuantidadeSuporteComum('')

      window.alert(
        'Suportes de COP cadastrados com sucesso.'
      )
    } catch (error) {
      console.error(
        'Erro ao cadastrar suportes de COP:',
        error
      )

      setErroSuportes(
        error?.message ||
        'Não foi possível cadastrar os suportes de COP.'
      )
    } finally {
      setSalvandoSuportes(false)
    }
  }

  function abrirNovaCOP() {
    if (!podeEditar) return

    setCOPEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(cop) {
    if (!podeEditar) return

    setCOPEditando(cop)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(cop) {
    setCOPVisualizando(cop)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos = await listarFotosCOP(
        cop.id
      )

      setFotosVisualizacao(
        Array.isArray(fotos)
          ? fotos
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar fotos da COP:',
        error
      )

      setErroFotos(
        error.message ||
        'Não foi possível carregar as fotos da COP.'
      )
    } finally {
      setCarregandoFotos(false)
    }
  }

  function fecharVisualizacao() {
    limparVisualizacao()
  }

  function fecharFormulario() {
    setFormAberto(false)
    setCOPEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()

    await Promise.all([
      carregarCOPs(),
      carregarResumo()
    ])
  }

  async function abrirSeletorManutencao() {
    if (!podeManutencao) return

    setFormAberto(false)
    setCOPEditando(null)
    limparVisualizacao()

    setBuscaSeletorManutencao('')
    setSeletorManutencaoAberto(true)
    setCarregandoSeletorManutencao(true)

    try {
      const resultado =
        await listarCOPsDisponiveisManutencao()

      setCOPsSeletorManutencao(
        Array.isArray(resultado)
          ? resultado
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar COPs para manutenção:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível carregar as COPs disponíveis para manutenção.'
      )

      setCOPsSeletorManutencao([])
    } finally {
      setCarregandoSeletorManutencao(false)
    }
  }

  function selecionarCOPParaManutencao(cop) {
    setSeletorManutencaoAberto(false)
    setBuscaSeletorManutencao('')
    setCOPManutencao(cop)
  }

  async function confirmarManutencao(dados) {
    if (!copManutencao?.id) return

    try {
      setSalvandoManutencao(true)

      await enviarCOPParaManutencao({
        copId: copManutencao.id,
        ...dados,
        user
      })

      setCOPManutencao(null)

      await Promise.all([
        carregarCOPs(),
        carregarResumo()
      ])

      window.alert(
        'COP enviada para manutenção com sucesso.'
      )
    } catch (error) {
      console.error(
        'Erro ao enviar COP para manutenção:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível enviar a COP para manutenção.'
      )
    } finally {
      setSalvandoManutencao(false)
    }
  }

  function extrairDadosTransferenciaCOP(movimentacao) {
    return (
      movimentacao?.dados ||
      movimentacao?.metadata?.dados_engine ||
      {}
    )
  }

  function extrairCOPIdTransferencia(movimentacao) {
    const dados =
      extrairDadosTransferenciaCOP(
        movimentacao
      )

    return (
      dados?.cop_id ||
      dados?.referencia_id ||
      movimentacao?.metadata?.patrimonio?.referencia_id ||
      null
    )
  }

  async function abrirEnvioTransferenciaCOP() {
    if (!podeTransferirCOP) return

    setModoTransferencia('ENVIAR')
    setBuscaTransferencia('')
    setCOPsSelecionadasTransferencia([])
    setTransferenciasReceber([])
    setTransferenciaModalAberta(true)
    setCarregandoTransferencia(true)
    setErro('')

    try {
      const [
        resultado,
        pendentes
      ] = await Promise.all([
        listarCOPs({
          filtros: {
            ativo: 'true'
          },
          pagina: 1,
          limite: 5000,
          sortBy: 'numero',
          sortDirection: 'asc'
        }),
        listarTransferenciasCOPCriadasPendentes({
          origemCodigo:
            origemTransferencia,
          limite: 500
        })
      ])

      const idsPendentes =
        new Set(
          (pendentes || [])
            .map(
              extrairCOPIdTransferencia
            )
            .filter(Boolean)
            .map(String)
        )

      const elegiveis =
        (resultado?.data || [])
          .filter((cop) => {
            const status =
              String(
                cop?.status_operacional ||
                ''
              )
                .trim()
                .toUpperCase()

            const local =
              String(
                cop?.local_atual ||
                ''
              )
                .trim()
                .toUpperCase()

            const estaNaOrigem =
              origemTransferencia === 'P4'
                ? local.includes('P4')
                : (
                    local.includes('SVDD') ||
                    local.includes('SERVIÇO DE DIA') ||
                    local.includes('SERVICO DE DIA')
                  )

            return (
              cop?.ativo !== false &&
              status === 'RESERVA' &&
              estaNaOrigem &&
              !idsPendentes.has(
                String(cop.id)
              )
            )
          })

      setCOPsTransferencia(
        elegiveis
      )
    } catch (error) {
      console.error(
        'Erro ao carregar COPs para transferência:',
        error
      )

      setCOPsTransferencia([])
      setErro(
        error?.message ||
        'Não foi possível carregar as COPs disponíveis para transferência.'
      )
    } finally {
      setCarregandoTransferencia(false)
    }
  }

  async function abrirRecebimentoTransferenciaCOP() {
    if (!podeTransferirCOP) return

    setModoTransferencia('RECEBER')
    setBuscaTransferencia('')
    setCOPsSelecionadasTransferencia([])
    setCOPsTransferencia([])
    setTransferenciaModalAberta(true)
    setCarregandoTransferencia(true)
    setErro('')

    try {
      const pendentes =
        await listarTransferenciasCOPPendentes({
          destinoCodigo:
            origemTransferencia,
          limite: 500
        })

      setTransferenciasReceber(
        Array.isArray(pendentes)
          ? pendentes
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar transferências de COP:',
        error
      )

      setTransferenciasReceber([])
      setErro(
        error?.message ||
        'Não foi possível carregar as COPs aguardando recebimento.'
      )
    } finally {
      setCarregandoTransferencia(false)
    }
  }

  function alternarCOPTransferencia(copId) {
    setCOPsSelecionadasTransferencia(
      (atual) =>
        atual.includes(copId)
          ? atual.filter(
              (id) => id !== copId
            )
          : [
              ...atual,
              copId
            ]
    )
  }

  async function confirmarEnvioTransferenciaCOP() {
    if (
      copsSelecionadasTransferencia.length === 0
    ) {
      return
    }

    try {
      setProcessandoTransferenciaId(
        'LOTE'
      )
      setErro('')

      const selecionadas =
        copsTransferencia.filter(
          (cop) =>
            copsSelecionadasTransferencia.includes(
              cop.id
            )
        )

      for (const cop of selecionadas) {
        await criarTransferenciaCOPPendente({
          copId:
            cop.id,
          origemCodigo:
            origemTransferencia,
          destinoCodigo:
            destinoTransferencia,
          user
        })
      }

      setTransferenciaModalAberta(false)
      setCOPsSelecionadasTransferencia([])

      await Promise.all([
        carregarCOPs(),
        carregarResumo()
      ])

      window.alert(
        ehPerfilP4
          ? `${selecionadas.length} COP(s) encaminhada(s) para aprovação do Cmt de Cia. Após a aprovação, o SVDD poderá confirmar o recebimento.`
          : `${selecionadas.length} COP(s) enviada(s) ao P4. A movimentação ficará pendente até o recebimento pelo P4.`
      )
    } catch (error) {
      console.error(
        'Erro ao transferir COP:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível criar a transferência da COP.'
      )
    } finally {
      setProcessandoTransferenciaId(
        null
      )
    }
  }

  async function confirmarRecebimentoTransferenciaCOP(
    movimentacao
  ) {
    if (!movimentacao?.id) return

    try {
      setProcessandoTransferenciaId(
        movimentacao.id
      )
      setErro('')

      await aceitarTransferenciaCOP({
        movimentacaoId:
          movimentacao.id,
        user
      })

      const restantes =
        transferenciasReceber.filter(
          (item) =>
            item.id !==
            movimentacao.id
        )

      setTransferenciasReceber(
        restantes
      )

      await Promise.all([
        carregarCOPs(),
        carregarResumo()
      ])

      window.alert(
        `COP recebida no ${origemTransferencia} com sucesso.`
      )
    } catch (error) {
      console.error(
        'Erro ao receber transferência de COP:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível receber a COP.'
      )
    } finally {
      setProcessandoTransferenciaId(
        null
      )
    }
  }

  function fecharTransferenciaCOP() {
    if (processandoTransferenciaId) {
      return
    }

    setTransferenciaModalAberta(false)
    setBuscaTransferencia('')
    setCOPsSelecionadasTransferencia([])
    setCOPsTransferencia([])
    setTransferenciasReceber([])
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) =>
        prev === 'asc'
          ? 'desc'
          : 'asc'
      )

      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function filtrarPorResumo(status) {
    setFiltros((prev) => ({
      ...prev,
      status_operacional: status,
      ativo: status === 'BAIXADA'
        ? ''
        : 'true'
    }))

    setPagina(1)
  }

  function mostrarCOPsEmManutencao() {
    filtrarPorResumo('MANUTENCAO')

    requestAnimationFrame(() => {
      document
        .querySelector('.cop-list-card')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  const distribuicao = [
    {
      status: 'RESERVA',
      label: 'Reserva no SVDD',
      valor: resumo.reserva,
      classe: 'azul',
      cor: '#1677d2'
    },
    {
      status: 'EM_SERVICO',
      label: 'Em serviço',
      valor: resumo.emServico,
      classe: 'verde',
      cor: '#16a34a'
    },
    {
      status: 'MANUTENCAO',
      label: 'Em manutenção',
      valor: resumo.manutencao,
      classe: 'laranja',
      cor: '#e47c15'
    },
    {
      status: 'BAIXADA',
      label: 'Baixadas',
      valor: resumo.baixadas,
      classe: 'vermelho',
      cor: '#dc2626'
    }
  ]

  const totalDistribuicao =
    distribuicao.reduce(
      (soma, item) =>
        soma + Number(item.valor || 0),
      0
    )

  const totalGrafico = Math.max(
    1,
    totalDistribuicao
  )

  let acumuladoGrafico = 0

  const gradienteRosca =
    distribuicao
      .filter(
        (item) =>
          Number(item.valor || 0) > 0
      )
      .map((item) => {
        const inicio = acumuladoGrafico

        acumuladoGrafico +=
          (
            Number(item.valor || 0) /
            totalGrafico
          ) * 100

        return `${item.cor} ${inicio}% ${acumuladoGrafico}%`
      })
      .join(', ') ||
    '#d8e3ef 0% 100%'

  return (
    <main className="cop-page">
      <header className="cop-header">
        <div>
          <span className="cop-kicker">
            Gestão Patrimonial
          </span>

          <h1>COP</h1>

          <p>
            Cadastro, consulta e controle das
            Câmeras Operacionais Portáteis.
          </p>
        </div>

      </header>

      <section className="cop-resumo-grid">
        <article className="cop-resumo-card cop-resumo-total">
          <small>Carga cadastrada</small>
          <strong>{resumo.total}</strong>
          <span>Total de COPs</span>
        </article>

        <article className="cop-resumo-card">
          <small>Disponíveis</small>
          <strong>{resumo.reserva}</strong>
          <span>Na reserva do SVDD</span>
        </article>

        <article className="cop-resumo-card">
          <small>Em serviço</small>
          <strong>{resumo.emServico}</strong>
          <span>Vinculadas ao serviço</span>
        </article>

        <article className="cop-resumo-card">
          <small>Manutenção</small>
          <strong>{resumo.manutencao}</strong>
          <span>Temporariamente indisponíveis</span>
        </article>
      </section>

      <section
        aria-label="Acessórios e suportes das COPs"
        style={{
          marginTop: '14px',
          marginBottom: '18px',
          padding: '14px 16px',
          border: '1px solid #d9e2ec',
          borderRadius: '12px',
          background: '#ffffff'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <span
              style={{
                display: 'block',
                color: '#64748b',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em'
              }}
            >
              ACESSÓRIOS DO KIT
            </span>

            <strong
              style={{
                display: 'block',
                marginTop: '3px',
                color: '#0f172a',
                fontSize: '16px'
              }}
            >
              Suportes das COPs
            </strong>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                minWidth: '160px',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '9px',
                background: '#f8fafc'
              }}
            >
              <small
                style={{
                  display: 'block',
                  color: '#64748b',
                  fontWeight: 800
                }}
              >
                SUPORTE MODULAR
              </small>

              <strong
                style={{
                  display: 'block',
                  marginTop: '2px',
                  color: '#0f172a',
                  fontSize: '20px'
                }}
              >
                {resumoSuportes.modular.disponivel}
              </strong>

              <span
                style={{
                  color: '#64748b',
                  fontSize: '12px'
                }}
              >
                disponível(is) de {resumoSuportes.modular.total}
              </span>
            </div>

            <div
              style={{
                minWidth: '160px',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '9px',
                background: '#f8fafc'
              }}
            >
              <small
                style={{
                  display: 'block',
                  color: '#64748b',
                  fontWeight: 800
                }}
              >
                SUPORTE COMUM
              </small>

              <strong
                style={{
                  display: 'block',
                  marginTop: '2px',
                  color: '#0f172a',
                  fontSize: '20px'
                }}
              >
                {resumoSuportes.comum.disponivel}
              </strong>

              <span
                style={{
                  color: '#64748b',
                  fontSize: '12px'
                }}
              >
                disponível(is) de {resumoSuportes.comum.total}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="cop-distribuicao">
        <div className="cop-section-title">
          <div>
            <span>DISTRIBUIÇÃO ATUAL</span>
            <h2>Situação das COPs</h2>
          </div>
        </div>

        <div className="cop-distribuicao-cards">
          {distribuicao.map((item) => (
            <button
              type="button"
              key={item.status}
              className={`cop-local-card cop-local-${item.classe}`}
              onClick={() =>
                filtrarPorResumo(item.status)
              }
            >
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="cop-graficos-grid">
        <article className="cop-grafico-card">
          <div className="cop-grafico-titulo">
            <span>DISTRIBUIÇÃO</span>
            <h3>COPs por situação</h3>
          </div>

          <div className="cop-rosca-layout">
            <div
              className="cop-rosca"
              style={{
                background:
                  `conic-gradient(${gradienteRosca})`
              }}
            >
              <div>
                <strong>{totalDistribuicao}</strong>
                <small>TOTAL</small>
              </div>
            </div>

            <div className="cop-legenda">
              {distribuicao.map((item) => {
                const percentual =
                  totalGrafico > 0
                    ? (
                        Number(item.valor || 0) /
                        totalGrafico
                      ) * 100
                    : 0

                return (
                  <div
                    key={item.status}
                    className="cop-legenda-linha"
                  >
                    <i
                      className="cop-cor"
                      style={{
                        background: item.cor
                      }}
                    />
                    <span>{item.label}</span>
                    <b>{item.valor}</b>
                    <small>
                      {percentual.toLocaleString(
                        'pt-BR',
                        {
                          maximumFractionDigits: 1
                        }
                      )}%
                    </small>
                  </div>
                )
              })}
            </div>
          </div>
        </article>

        <article className="cop-grafico-card">
          <div className="cop-grafico-titulo">
            <span>COMPARATIVO</span>
            <h3>COPs por situação</h3>
          </div>

          <div className="cop-barras">
            {distribuicao.map((item) => {
              const percentual =
                totalGrafico > 0
                  ? (
                      Number(item.valor || 0) /
                      totalGrafico
                    ) * 100
                  : 0

              return (
                <div
                  key={item.status}
                  className="cop-barra-linha"
                >
                  <span>{item.label}</span>

                  <div className="cop-barra-trilho">
                    <i
                      className="cop-barra-preenchimento"
                      style={{
                        width: `${percentual}%`,
                        background: item.cor
                      }}
                    />
                  </div>

                  <b>{item.valor}</b>
                </div>
              )
            })}
          </div>
        </article>
      </section>

      <section
        aria-label="Operações patrimoniais da COP"
        style={{
          display: 'grid',
          gap: '14px',
          marginTop: '18px',
          marginBottom: '22px'
        }}
      >
        {podeTransferirCOP && (
          <article
            style={{
              overflow: 'hidden',
              border: '1px solid #d9e2ec',
              borderRadius: '14px',
              background: '#ffffff'
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 18px',
                borderBottom: '1px solid #d9e2ec'
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '42px',
                  height: '42px',
                  flex: '0 0 42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  background: '#062a52',
                  fontSize: '21px'
                }}
              >
                ↔️
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: '18px'
                  }}
                >
                  Movimentação interna
                </h2>

                <p
                  style={{
                    margin: '3px 0 0',
                    color: '#64748b',
                    fontSize: '13px'
                  }}
                >
                  Transferência de COPs entre os cofres do P4 e do SVDD.
                </p>
              </div>
            </header>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '14px'
              }}
            >
              <button
                type="button"
                onClick={abrirEnvioTransferenciaCOP}
                style={{
                  width: '310px',
                  maxWidth: '100%',
                  minHeight: '86px',
                  padding: '14px 16px',
                  border: '1px solid #cdd9e6',
                  borderRadius: '12px',
                  background: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: '#12346d',
                    fontSize: '14px'
                  }}
                >
                  {ehPerfilP4
                    ? 'Transferir para SVDD'
                    : 'Devolver ao P4'}
                </strong>

                <span
                  style={{
                    display: 'block',
                    color: '#64748b',
                    fontSize: '12px',
                    lineHeight: 1.45
                  }}
                >
                  {ehPerfilP4
                    ? 'Selecionar COPs do P4 e solicitar envio ao SVDD com aprovação do Cmt de Cia.'
                    : 'Selecionar COPs disponíveis no SVDD e encaminhar ao Cofre do P4.'}
                </span>
              </button>

              <button
                type="button"
                onClick={abrirRecebimentoTransferenciaCOP}
                style={{
                  width: '310px',
                  maxWidth: '100%',
                  minHeight: '86px',
                  padding: '14px 16px',
                  border: '1px solid #cdd9e6',
                  borderRadius: '12px',
                  background: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: '#12346d',
                    fontSize: '14px'
                  }}
                >
                  {ehPerfilP4
                    ? 'Receber do SVDD'
                    : 'Receber do P4'}
                </strong>

                <span
                  style={{
                    display: 'block',
                    color: '#64748b',
                    fontSize: '12px',
                    lineHeight: 1.45
                  }}
                >
                  {ehPerfilP4
                    ? 'Confirmar COPs devolvidas pelo SVDD e recolher para o Cofre do P4.'
                    : 'Confirmar COPs enviadas pelo P4 após a aprovação do Cmt de Cia.'}
                </span>
              </button>
            </div>
          </article>
        )}

        <article
          style={{
            overflow: 'hidden',
            border: '1px solid #d9e2ec',
            borderRadius: '14px',
            background: '#ffffff'
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 18px',
              borderBottom: '1px solid #d9e2ec'
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '42px',
                height: '42px',
                flex: '0 0 42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                background: '#062a52',
                fontSize: '21px'
              }}
            >
              🛠️
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '18px'
                }}
              >
                Condição do material
              </h2>

              <p
                style={{
                  margin: '3px 0 0',
                  color: '#64748b',
                  fontSize: '13px'
                }}
              >
                Manutenção e acompanhamento das Câmeras Operacionais Portáteis.
              </p>
            </div>
          </header>

          <div
            style={{
              padding: '14px'
            }}
          >
            <button
              type="button"
              onClick={abrirSeletorManutencao}
              disabled={
                !podeManutencao ||
                carregandoSeletorManutencao
              }
              style={{
                width: '310px',
                maxWidth: '100%',
                minHeight: '86px',
                padding: '14px 16px',
                border: '1px solid #cdd9e6',
                borderRadius: '12px',
                background: '#ffffff',
                textAlign: 'left',
                cursor:
                  !podeManutencao ||
                  carregandoSeletorManutencao
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  !podeManutencao
                    ? 0.55
                    : 1
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  color: '#12346d',
                  fontSize: '14px'
                }}
              >
                {carregandoSeletorManutencao
                  ? 'Carregando...'
                  : 'Enviar para manutenção'}
              </strong>

              <span
                style={{
                  display: 'block',
                  color: '#64748b',
                  fontSize: '12px',
                  lineHeight: 1.45
                }}
              >
                Selecionar uma COP disponível e registrar defeito, dano ou avaria.
              </span>
            </button>
          </div>
        </article>

        <article
          style={{
            overflow: 'hidden',
            border: '1px solid #d9e2ec',
            borderRadius: '14px',
            background: '#ffffff'
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 18px',
              borderBottom: '1px solid #d9e2ec'
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '42px',
                height: '42px',
                flex: '0 0 42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                background: '#062a52',
                fontSize: '21px'
              }}
            >
              📥
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '18px'
                }}
              >
                Entradas e recebimentos
              </h2>

              <p
                style={{
                  margin: '3px 0 0',
                  color: '#64748b',
                  fontSize: '13px'
                }}
              >
                Retorno e acompanhamento das COPs encaminhadas para reparo.
              </p>
            </div>
          </header>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '14px'
            }}
          >
            {podeEditar && (
              <button
                type="button"
                onClick={abrirCadastroSuportes}
                style={{
                  width: '310px',
                  maxWidth: '100%',
                  minHeight: '86px',
                  padding: '14px 16px',
                  border: '1px solid #cdd9e6',
                  borderRadius: '12px',
                  background: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: '#12346d',
                    fontSize: '14px'
                  }}
                >
                  Cadastrar suportes
                </strong>

                <span
                  style={{
                    display: 'block',
                    color: '#64748b',
                    fontSize: '12px',
                    lineHeight: 1.45
                  }}
                >
                  Informar entrada de suportes modular e comum do kit das COPs.
                </span>
              </button>
            )}

            {podeEditar && (
              <button
                type="button"
                onClick={abrirNovaCOP}
                style={{
                  width: '310px',
                  maxWidth: '100%',
                  minHeight: '86px',
                  padding: '14px 16px',
                  border: '1px solid #cdd9e6',
                  borderRadius: '12px',
                  background: '#ffffff',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: '#12346d',
                    fontSize: '14px'
                  }}
                >
                  Inserir nova COP
                </strong>

                <span
                  style={{
                    display: 'block',
                    color: '#64748b',
                    fontSize: '12px',
                    lineHeight: 1.45
                  }}
                >
                  Cadastrar uma nova Câmera Operacional Portátil no sistema.
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={mostrarCOPsEmManutencao}
              style={{
                width: '310px',
                maxWidth: '100%',
                minHeight: '86px',
                padding: '14px 16px',
                border: '1px solid #cdd9e6',
                borderRadius: '12px',
                background: '#ffffff',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  color: '#12346d',
                  fontSize: '14px'
                }}
              >
                Receber manutenção
              </strong>

              <span
                style={{
                  display: 'block',
                  color: '#64748b',
                  fontSize: '12px',
                  lineHeight: 1.45
                }}
              >
                Visualizar COPs em reparo e acompanhar o retorno para o SVDD.
              </span>
            </button>
          </div>
        </article>
      </section>

      {erro && (
        <div className="cop-alert-error">
          {erro}
        </div>
      )}

      <section className="cop-toolbar">
        <div className="cop-search">
          <label htmlFor="cop-pesquisa">
            Pesquisar
          </label>

          <input
            id="cop-pesquisa"
            name="pesquisa"
            type="search"
            value={filtros.pesquisa}
            onChange={handleFiltroChange}
            placeholder="Número, ID, marca ou local"
          />
        </div>

        <div className="cop-filter">
          <label htmlFor="cop-marca">
            Marca
          </label>

          <select
            id="cop-marca"
            name="marca"
            value={filtros.marca}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todas
            </option>
            <option value="MOTOROLA">
              MOTOROLA
            </option>
          </select>
        </div>

        <div className="cop-filter">
          <label htmlFor="cop-status">
            Status
          </label>

          <select
            id="cop-status"
            name="status_operacional"
            value={filtros.status_operacional}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {STATUS_COP.map((status) => (
              <option
                key={status}
                value={status}
              >
                {formatarStatus(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="cop-filter">
          <label htmlFor="cop-ativo">
            Cadastro
          </label>

          <select
            id="cop-ativo"
            name="ativo"
            value={filtros.ativo}
            onChange={handleFiltroChange}
          >
            <option value="true">
              Ativas
            </option>
            <option value="false">
              Inativas
            </option>
            <option value="">
              Todas
            </option>
          </select>
        </div>

        <button
          type="button"
          className="cop-btn-secondary cop-toolbar-clear"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && podeEditar && (
        <section className="cop-form-area">
          <COPForm
            user={user}
            copEditando={copEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="cop-list-card">
        <div className="cop-list-header">
          <div>
            <h2>
              COPs cadastradas
            </h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        <COPTable
          cops={cops}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={abrirEdicao}
          podeEditar={podeEditar}
        />

        <footer className="cop-pagination">
          <button
            type="button"
            disabled={
              pagina <= 1 || loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.max(1, prev - 1)
              )
            }
          >
            Anterior
          </button>

          <span>
            Página {pagina} de{' '}
            {totalPaginas}
          </span>

          <button
            type="button"
            disabled={
              pagina >= totalPaginas ||
              loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.min(
                  totalPaginas,
                  prev + 1
                )
              )
            }
          >
            Próxima
          </button>
        </footer>
      </section>

      {suportesModalAberto && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !salvandoSuportes
            ) {
              fecharCadastroSuportes()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(15, 23, 42, 0.58)'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Cadastrar suportes de COP"
            style={{
              width: 'min(560px, 100%)',
              overflow: 'hidden',
              borderRadius: '14px',
              background: '#ffffff',
              boxShadow:
                '0 24px 70px rgba(15, 23, 42, 0.28)'
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '20px',
                padding: '22px 24px',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.08em'
                  }}
                >
                  ACESSÓRIOS DO KIT
                </span>

                <h2
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: '22px'
                  }}
                >
                  Cadastrar suportes
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: '#64748b',
                    fontSize: '13px'
                  }}
                >
                  Os suportes são controlados apenas por quantidade e não ficam vinculados a uma COP específica.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={fecharCadastroSuportes}
                disabled={salvandoSuportes}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontSize: '28px',
                  lineHeight: 1,
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </header>

            <form
              onSubmit={salvarCadastroSuportes}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap: '14px',
                  padding: '22px 24px'
                }}
              >
                <label>
                  <span
                    style={{
                      display: 'block',
                      marginBottom: '7px',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 800
                    }}
                  >
                    SUPORTE MODULAR
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantidadeSuporteModular}
                    onChange={(event) =>
                      setQuantidadeSuporteModular(
                        event.target.value
                      )
                    }
                    placeholder="0"
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      font: 'inherit'
                    }}
                  />
                </label>

                <label>
                  <span
                    style={{
                      display: 'block',
                      marginBottom: '7px',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 800
                    }}
                  >
                    SUPORTE COMUM
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quantidadeSuporteComum}
                    onChange={(event) =>
                      setQuantidadeSuporteComum(
                        event.target.value
                      )
                    }
                    placeholder="0"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      font: 'inherit'
                    }}
                  />
                </label>

                {erroSuportes && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: '13px'
                    }}
                  >
                    {erroSuportes}
                  </div>
                )}
              </div>

              <footer
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  padding: '16px 24px',
                  borderTop: '1px solid #e5e7eb'
                }}
              >
                <button
                  type="button"
                  className="cop-btn-secondary"
                  onClick={fecharCadastroSuportes}
                  disabled={salvandoSuportes}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="cop-btn-secondary"
                  disabled={salvandoSuportes}
                  style={{
                    fontWeight: 800
                  }}
                >
                  {salvandoSuportes
                    ? 'Salvando...'
                    : 'Cadastrar'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {transferenciaModalAberta && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !processandoTransferenciaId
            ) {
              fecharTransferenciaCOP()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(15, 23, 42, 0.58)'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modoTransferencia === 'ENVIAR'
                ? 'Transferir COP'
                : 'Receber COP'
            }
            style={{
              width: 'min(820px, 100%)',
              maxHeight: '84vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '14px',
              background: '#ffffff',
              boxShadow:
                '0 24px 70px rgba(15, 23, 42, 0.28)'
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '20px',
                padding: '22px 24px',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.08em'
                  }}
                >
                  MOVIMENTAÇÃO INTERNA
                </span>

                <h2
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: '22px'
                  }}
                >
                  {modoTransferencia === 'ENVIAR'
                    ? `${origemTransferencia} → ${destinoTransferencia}`
                    : `Receber no ${origemTransferencia}`}
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: '#64748b',
                    fontSize: '13px'
                  }}
                >
                  {modoTransferencia === 'ENVIAR'
                    ? ehPerfilP4
                      ? 'A saída do P4 ficará pendente de aprovação do Cmt de Cia e posterior recebimento pelo SVDD.'
                      : 'A devolução ficará pendente até a confirmação de recebimento pelo P4.'
                    : `Movimentações disponíveis para entrada no ${localOrigemTransferencia}.`}
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={fecharTransferenciaCOP}
                disabled={Boolean(processandoTransferenciaId)}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontSize: '28px',
                  lineHeight: 1,
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </header>

            <div
              style={{
                padding: '20px 24px',
                overflow: 'auto'
              }}
            >
              {modoTransferencia === 'ENVIAR' && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(2, minmax(0, 1fr))',
                      gap: '10px',
                      marginBottom: '16px'
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '9px',
                        background: '#f8fafc'
                      }}
                    >
                      <small
                        style={{
                          display: 'block',
                          color: '#64748b',
                          fontWeight: 800
                        }}
                      >
                        ORIGEM
                      </small>
                      <strong
                        style={{
                          color: '#0f172a'
                        }}
                      >
                        {localOrigemTransferencia}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '9px',
                        background: '#f8fafc'
                      }}
                    >
                      <small
                        style={{
                          display: 'block',
                          color: '#64748b',
                          fontWeight: 800
                        }}
                      >
                        DESTINO
                      </small>
                      <strong
                        style={{
                          color: '#0f172a'
                        }}
                      >
                        {localDestinoTransferencia}
                      </strong>
                    </div>
                  </div>

                  <label
                    htmlFor="cop-transferencia-pesquisa"
                    style={{
                      display: 'block',
                      marginBottom: '7px',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 800
                    }}
                  >
                    Pesquisar equipamento
                  </label>

                  <input
                    id="cop-transferencia-pesquisa"
                    type="search"
                    value={buscaTransferencia}
                    onChange={(event) =>
                      setBuscaTransferencia(
                        event.target.value
                      )
                    }
                    placeholder="Número, ID da câmera, marca ou local"
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginBottom: '16px',
                      padding: '11px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      font: 'inherit'
                    }}
                  />
                </>
              )}

              {carregandoTransferencia ? (
                <div
                  style={{
                    padding: '28px 8px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  Carregando movimentações...
                </div>
              ) : modoTransferencia === 'ENVIAR' ? (
                copsTransferenciaFiltradas.length === 0 ? (
                  <div
                    style={{
                      padding: '28px 8px',
                      textAlign: 'center',
                      color: '#64748b'
                    }}
                  >
                    Nenhuma COP disponível no {localOrigemTransferencia}.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gap: '8px'
                    }}
                  >
                    {copsTransferenciaFiltradas.map((cop) => {
                      const selecionada =
                        copsSelecionadasTransferencia.includes(
                          cop.id
                        )

                      return (
                        <button
                          key={cop.id}
                          type="button"
                          onClick={() =>
                            alternarCOPTransferencia(
                              cop.id
                            )
                          }
                          disabled={Boolean(processandoTransferenciaId)}
                          style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns:
                              '24px 52px minmax(0, 1fr) auto',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            border:
                              selecionada
                                ? '2px solid #1d4ed8'
                                : '1px solid #e2e8f0',
                            borderRadius: '9px',
                            background:
                              selecionada
                                ? '#eff6ff'
                                : '#ffffff',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: '18px',
                              height: '18px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border:
                                selecionada
                                  ? '1px solid #1d4ed8'
                                  : '1px solid #94a3b8',
                              borderRadius: '4px',
                              background:
                                selecionada
                                  ? '#1d4ed8'
                                  : '#ffffff',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: 900
                            }}
                          >
                            {selecionada ? '✓' : ''}
                          </span>

                          {cop.foto_url ? (
                            <img
                              src={cop.foto_url}
                              alt={`COP ${cop.numero || ''}`}
                              style={{
                                width: '46px',
                                height: '46px',
                                objectFit: 'contain',
                                borderRadius: '7px',
                                background: '#f8fafc'
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                width: '46px',
                                height: '46px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '7px',
                                background: '#f1f5f9',
                                color: '#475569',
                                fontSize: '10px',
                                fontWeight: 900
                              }}
                            >
                              COP
                            </span>
                          )}

                          <span
                            style={{
                              minWidth: 0
                            }}
                          >
                            <strong
                              style={{
                                display: 'block',
                                color: '#0f172a'
                              }}
                            >
                              COP {cop.numero || '—'}
                            </strong>

                            <small
                              style={{
                                display: 'block',
                                marginTop: '3px',
                                color: '#64748b'
                              }}
                            >
                              {[
                                cop.identificacao_equipamento,
                                cop.marca
                              ]
                                .filter(Boolean)
                                .join(' · ') ||
                                'Sem identificação adicional'}
                            </small>
                          </span>

                          <small
                            style={{
                              color: '#475569',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {cop.local_atual || localOrigemTransferencia}
                          </small>
                        </button>
                      )
                    })}
                  </div>
                )
              ) : transferenciasReceber.length === 0 ? (
                <div
                  style={{
                    padding: '28px 8px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  Nenhuma COP aguardando recebimento no {origemTransferencia}.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: '8px'
                  }}
                >
                  {transferenciasReceber.map((movimentacao) => {
                    const dados =
                      extrairDadosTransferenciaCOP(
                        movimentacao
                      )

                    const origem =
                      movimentacao?.origem_guardiao_nome ||
                      movimentacao?.local_origem ||
                      dados?.local_origem ||
                      (
                        ehPerfilP4
                          ? 'COFRE DO SVDD'
                          : 'COFRE DO P4'
                      )

                    return (
                      <article
                        key={movimentacao.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'minmax(0, 1fr) auto',
                          gap: '14px',
                          alignItems: 'center',
                          padding: '12px 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '9px',
                          background: '#ffffff'
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: 'block',
                              color: '#0f172a'
                            }}
                          >
                            COP {dados?.numero || '—'}
                          </strong>

                          <span
                            style={{
                              display: 'block',
                              marginTop: '3px',
                              color: '#475569',
                              fontSize: '12px'
                            }}
                          >
                            {origem} → {localOrigemTransferencia}
                          </span>

                          {dados?.identificacao_equipamento && (
                            <small
                              style={{
                                display: 'block',
                                marginTop: '3px',
                                color: '#64748b'
                              }}
                            >
                              ID {dados.identificacao_equipamento}
                            </small>
                          )}
                        </div>

                        <button
                          type="button"
                          className="cop-btn-secondary"
                          onClick={() =>
                            confirmarRecebimentoTransferenciaCOP(
                              movimentacao
                            )
                          }
                          disabled={Boolean(processandoTransferenciaId)}
                          style={{
                            minWidth: '110px'
                          }}
                        >
                          {processandoTransferenciaId === movimentacao.id
                            ? 'Recebendo...'
                            : 'Receber'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <footer
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '16px 24px',
                borderTop: '1px solid #e5e7eb'
              }}
            >
              <span
                style={{
                  color: '#64748b',
                  fontSize: '12px'
                }}
              >
                {modoTransferencia === 'ENVIAR'
                  ? `${copsSelecionadasTransferencia.length} selecionada(s)`
                  : `${transferenciasReceber.length} pendente(s)`}
              </span>

              <div
                style={{
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <button
                  type="button"
                  className="cop-btn-secondary"
                  onClick={fecharTransferenciaCOP}
                  disabled={Boolean(processandoTransferenciaId)}
                >
                  Fechar
                </button>

                {modoTransferencia === 'ENVIAR' && (
                  <button
                    type="button"
                    className="cop-btn-secondary"
                    onClick={confirmarEnvioTransferenciaCOP}
                    disabled={
                      copsSelecionadasTransferencia.length === 0 ||
                      Boolean(processandoTransferenciaId)
                    }
                    style={{
                      fontWeight: 800
                    }}
                  >
                    {processandoTransferenciaId
                      ? 'Enviando...'
                      : ehPerfilP4
                        ? 'Solicitar transferência'
                        : 'Enviar ao P4'}
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}

      {seletorManutencaoAberto && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !carregandoSeletorManutencao
            ) {
              setSeletorManutencaoAberto(false)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'rgba(15, 23, 42, 0.58)'
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Selecionar COP para manutenção"
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '14px',
              background: '#ffffff',
              boxShadow:
                '0 24px 70px rgba(15, 23, 42, 0.28)'
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '20px',
                padding: '22px 24px',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.08em'
                  }}
                >
                  MANUTENÇÃO INDIVIDUAL
                </span>

                <h2
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: '22px'
                  }}
                >
                  Selecionar COP
                </h2>

                <p
                  style={{
                    margin: '5px 0 0',
                    color: '#64748b',
                    fontSize: '13px'
                  }}
                >
                  Escolha a câmera que será enviada para reparo.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setSeletorManutencaoAberto(false)
                }
                disabled={carregandoSeletorManutencao}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontSize: '28px',
                  lineHeight: 1,
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </header>

            <div
              style={{
                padding: '20px 24px',
                overflow: 'auto'
              }}
            >
              <label
                htmlFor="cop-seletor-manutencao"
                style={{
                  display: 'block',
                  marginBottom: '7px',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                Pesquisar equipamento
              </label>

              <input
                id="cop-seletor-manutencao"
                type="search"
                value={buscaSeletorManutencao}
                onChange={(event) =>
                  setBuscaSeletorManutencao(
                    event.target.value
                  )
                }
                placeholder="Número, ID da câmera, marca ou local"
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: '16px',
                  padding: '11px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  font: 'inherit'
                }}
              />

              {carregandoSeletorManutencao ? (
                <div
                  style={{
                    padding: '28px 8px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  Carregando COPs...
                </div>
              ) : copsElegiveisManutencao.length === 0 ? (
                <div
                  style={{
                    padding: '28px 8px',
                    textAlign: 'center',
                    color: '#64748b'
                  }}
                >
                  Nenhuma COP disponível para envio à manutenção.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: '8px'
                  }}
                >
                  {copsElegiveisManutencao.map((cop) => (
                    <button
                      key={cop.id}
                      type="button"
                      onClick={() =>
                        selecionarCOPParaManutencao(cop)
                      }
                      style={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns:
                          '52px minmax(0, 1fr) auto',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '9px',
                        background: '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {cop.foto_url ? (
                        <img
                          src={cop.foto_url}
                          alt={`COP ${cop.numero || ''}`}
                          style={{
                            width: '46px',
                            height: '46px',
                            objectFit: 'contain',
                            borderRadius: '7px',
                            background: '#f8fafc'
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: '46px',
                            height: '46px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '7px',
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: '10px',
                            fontWeight: 900
                          }}
                        >
                          COP
                        </span>
                      )}

                      <span
                        style={{
                          minWidth: 0
                        }}
                      >
                        <strong
                          style={{
                            display: 'block',
                            color: '#0f172a'
                          }}
                        >
                          COP {cop.numero || '—'}
                        </strong>

                        <small
                          style={{
                            display: 'block',
                            marginTop: '3px',
                            color: '#64748b'
                          }}
                        >
                          {[
                            cop.identificacao_equipamento,
                            cop.marca
                          ]
                            .filter(Boolean)
                            .join(' · ') ||
                            'Sem identificação adicional'}
                        </small>
                      </span>

                      <small
                        style={{
                          color: '#475569',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {cop.local_atual || 'SVDD'}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <footer
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '16px 24px',
                borderTop: '1px solid #e5e7eb'
              }}
            >
              <span
                style={{
                  color: '#64748b',
                  fontSize: '12px'
                }}
              >
                {copsElegiveisManutencao.length}{' '}
                equipamento(s) listado(s)
              </span>

              <button
                type="button"
                className="cop-btn-secondary"
                onClick={() =>
                  setSeletorManutencaoAberto(false)
                }
              >
                Cancelar
              </button>
            </footer>
          </section>
        </div>
      )}

      <COPManutencaoModal
        cop={copManutencao}
        salvando={salvandoManutencao}
        onClose={() => {
          if (!salvandoManutencao) {
            setCOPManutencao(null)
          }
        }}
        onConfirm={confirmarManutencao}
      />

      {copVisualizando && (
        <COPDetalhesModal
          cop={copVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={
            podeEditar
              ? () =>
                  abrirEdicao(
                    copVisualizando
                  )
              : undefined
          }
        />
      )}
    </main>
  )
}

function normalizarPerfil(perfil) {
  return String(perfil || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatarStatus(status) {
  return String(status || '')
    .trim()
    .replaceAll('_', ' ')
}
