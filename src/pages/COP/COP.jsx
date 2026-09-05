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

import {
  listarCOPs,
  obterResumoCOPs
} from '../../services/copsService'

import {
  listarFotosCOP
} from '../../services/copsFotosService'

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

export default function COP({ user }) {
  const [cops, setCOPs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] =
    useState(false)
  const [erro, setErro] = useState('')

  const [resumo, setResumo] =
    useState(RESUMO_INICIAL)

  const [formAberto, setFormAberto] =
    useState(false)
  const [copEditando, setCOPEditando] =
    useState(null)
  const [copVisualizando, setCOPVisualizando] =
    useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] =
    useState([])
  const [carregandoFotos, setCarregandoFotos] =
    useState(false)
  const [erroFotos, setErroFotos] =
    useState('')

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

  const totalPaginas = useMemo(
    () => Math.max(
      1,
      Math.ceil(total / LIMITE)
    ),
    [total]
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
