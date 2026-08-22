import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  STATUS_TASER,
  TIPOS_TASER
} from '../../constants/tasers'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import TaserForm from './components/TaserForm'
import TaserTable from './components/TaserTable'
import TaserDetalhesModal from './components/TaserDetalhesModal'

import {
  excluirTaser,
  listarTasers
} from '../../services/tasersService'

import {
  listarFotosTaser
} from '../../services/tasersFotosService'

import './styles/Taser.css'

const LIMITE = 20
const LIMITE_RESUMO = 5000
const statusOptions = STATUS_TASER
const tipoOptions = TIPOS_TASER


function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function resumirTasers(lista = []) {
  const resumo = {
    total: lista.length,
    p4: 0,
    svdd: 0,
    cargaPermanente: 0,
    cautelas: 0,
    manutencao: 0,
    naoLocalizados: 0,
    baixados: 0,
    outros: 0
  }

  lista.forEach((taser) => {
    const status = normalizar(taser?.status_operacional || taser?.status)
    const local = normalizar(taser?.local_atual)

    if (status === 'BAIXADO') {
      resumo.baixados += 1
      return
    }

    if (status === 'MANUTENCAO' || local.includes('MANUTENCAO')) {
      resumo.manutencao += 1
      return
    }

    if (
      status.includes('NAO_LOCALIZ') ||
      local.includes('NAO_LOCALIZ') ||
      !local
    ) {
      resumo.naoLocalizados += 1
      return
    }

    if (status.includes('CAUTELA') || status === 'EM_SERVICO') {
      resumo.cautelas += 1
      return
    }

    if (status === 'CARGA' || status.includes('CARGA_PERMANENTE')) {
      resumo.cargaPermanente += 1
      return
    }

    if (local.includes('SVDD') || local.includes('SERVICO DE DIA')) {
      resumo.svdd += 1
      return
    }

    if (
      status === 'RESERVA' ||
      status === 'DISPONIVEL' ||
      local.includes('P4') ||
      local.includes('DEPOSITO') ||
      local.includes('RESERVA')
    ) {
      resumo.p4 += 1
      return
    }

    resumo.outros += 1
  })

  return resumo
}

function percentual(valor, total) {
  if (!Number(total)) return 0
  return Math.max(0, Math.min(100, (Number(valor || 0) / Number(total)) * 100))
}

function ResumoCard({ titulo, valor, detalhe, tone = 'blue' }) {
  return (
    <article className={`taser-summary-card taser-summary-${tone}`}>
      <span className="taser-summary-label">{titulo}</span>
      <strong>{Number(valor || 0).toLocaleString('pt-BR')}</strong>
      <small>{detalhe}</small>
    </article>
  )
}

function GraficoRoscaTaser({ total, itens }) {
  let acumulado = 0

  const segmentos = itens.map((item) => {
    const inicio = acumulado
    acumulado += percentual(item.valor, total)
    return `${item.cor} ${inicio}% ${acumulado}%`
  })

  if (acumulado < 100) {
    segmentos.push(`#e8edf4 ${acumulado}% 100%`)
  }

  return (
    <section className="taser-chart-card taser-chart-donut-card">
      <div className="taser-chart-header">
        <div>
          <span>Distribuição patrimonial</span>
          <h2>Situação dos Tasers</h2>
        </div>
      </div>

      <div className="taser-chart-donut-layout">
        <div
          className="taser-chart-donut"
          style={{ background: `conic-gradient(${segmentos.join(', ')})` }}
          aria-label={`Total de ${total} Tasers`}
        >
          <div>
            <strong>{Number(total || 0).toLocaleString('pt-BR')}</strong>
            <span>TOTAL</span>
          </div>
        </div>

        <div className="taser-chart-legend">
          {itens.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.cor }} />
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
              <small>
                {percentual(item.valor, total).toLocaleString('pt-BR', {
                  maximumFractionDigits: 1
                })}%
              </small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GraficoBarrasTaser({ total, itens }) {
  const maior = Math.max(1, ...itens.map((item) => Number(item.valor || 0)))

  return (
    <section className="taser-chart-card taser-chart-bars-card">
      <div className="taser-chart-header">
        <div>
          <span>Visão comparativa</span>
          <h2>Tasers por local e situação</h2>
        </div>
      </div>

      <div className="taser-chart-bars">
        {itens.map((item) => (
          <div className="taser-chart-bar-item" key={item.label}>
            <div className="taser-chart-bar-value">{item.valor}</div>
            <div className="taser-chart-bar-track">
              <i
                style={{
                  height: `${Math.max(
                    item.valor ? 9 : 2,
                    (Number(item.valor || 0) / maior) * 100
                  )}%`,
                  background: item.cor
                }}
              />
            </div>
            <strong>{item.label}</strong>
            <small>
              {percentual(item.valor, total).toLocaleString('pt-BR', {
                maximumFractionDigits: 1
              })}%
            </small>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Taser({ user }) {
  const [tasers, setTasers] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [todosTasers, setTodosTasers] = useState([])
  const [loadingResumo, setLoadingResumo] = useState(false)

  const [formAberto, setFormAberto] = useState(false)
  const [taserEditando, setTaserEditando] = useState(null)
  const [taserVisualizando, setTaserVisualizando] = useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [erroFotos, setErroFotos] = useState('')

  const [sortBy, setSortBy] = useState('criado_em')
  const [sortDirection, setSortDirection] = useState('desc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo_taser: '',
    marca: '',
    modelo: '',
    status_operacional: '',
    unidade: ''
  })

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const carregarTasers = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarTasers({
        filtros: {
          pesquisa: filtros.pesquisa.trim(),
          tipo_taser: filtros.tipo_taser,
          marca: filtros.marca,
          modelo: filtros.modelo,
          status_operacional: filtros.status_operacional,
          unidade: filtros.unidade
        },
        pagina,
        limite: LIMITE,
        sortBy,
        sortDirection
      })

      setTasers(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao carregar os Tasers.'
      )
    } finally {
      setLoading(false)
    }
  }, [
    filtros,
    pagina,
    sortBy,
    sortDirection
  ])

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true)

      const resultado = await listarTasers({
        filtros: {},
        pagina: 1,
        limite: LIMITE_RESUMO,
        sortBy: 'criado_em',
        sortDirection: 'desc'
      })

      setTodosTasers(resultado.data || [])
    } catch (error) {
      console.error('Erro ao carregar resumo dos Tasers:', error)
    } finally {
      setLoadingResumo(false)
    }
  }, [])

  useEffect(() => {
    carregarTasers()
  }, [carregarTasers])

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
      tipo_taser: '',
      marca: '',
      modelo: '',
      status_operacional: '',
      unidade: ''
    })

    setPagina(1)
  }

  function rolarParaFormulario() {
    requestAnimationFrame(() => {
      document
        .querySelector('.taser-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function limparVisualizacao() {
    setTaserVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirNovoCadastro() {
    setTaserEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(taser) {
    setTaserEditando(taser)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(taser) {
    setTaserVisualizando(taser)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos =
        await listarFotosTaser(taser.id)

      setFotosVisualizacao(
        Array.isArray(fotos)
          ? fotos
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar fotos do Taser:',
        error
      )

      setErroFotos(
        error.message ||
        'Não foi possível carregar as fotos do Taser.'
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
    setTaserEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await Promise.all([
      carregarTasers(),
      carregarResumo()
    ])
  }

  async function handleExcluir(taser) {
    const identificacao =
      taser.patrimonio ||
      taser.numero_serie ||
      'Taser'

    const confirmou = window.confirm(
      `Deseja realmente excluir o Taser "${identificacao}"?`
    )

    if (!confirmou) return

    try {
      await excluirTaser(taser.id, user)
      await Promise.all([
        carregarTasers(),
        carregarResumo()
      ])
    } catch (error) {
      window.alert(
        error.message ||
        'Erro ao excluir o Taser.'
      )
    }
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

  function obterValorOpcao(option) {
    return typeof option === 'string'
      ? option
      : option.value
  }

  function obterLabelOpcao(option) {
    return typeof option === 'string'
      ? option
      : option.label
  }

  const resumo = useMemo(
    () => resumirTasers(todosTasers),
    [todosTasers]
  )

  const dadosGrafico = useMemo(
    () => [
      { label: 'Depósito do P4', valor: resumo.p4, cor: '#22c55e' },
      { label: 'Cofre do SVDD', valor: resumo.svdd, cor: '#3b82f6' },
      { label: 'Carga permanente', valor: resumo.cargaPermanente, cor: '#f97316' },
      { label: 'Cautelas ativas', valor: resumo.cautelas, cor: '#eab308' },
      { label: 'Manutenção', valor: resumo.manutencao, cor: '#ef4444' },
      { label: 'Não localizados', valor: resumo.naoLocalizados, cor: '#dc2626' },
      { label: 'Outras situações', valor: resumo.outros, cor: '#64748b' }
    ],
    [resumo]
  )

  return (
    <main className="taser-page">
      <header className="taser-header">
        <div>
          <span className="taser-kicker">
            Gestão Patrimonial
          </span>

          <h1>Taser</h1>

          <p>
            Cadastro, consulta e controle dos
            Rádios Portáteis (Taser).
          </p>
        </div>

        <div className="taser-hero-actions">
          <button
            type="button"
            className="taser-btn-secondary"
            onClick={() => Promise.all([carregarTasers(), carregarResumo()])}
            disabled={loading || loadingResumo}
          >
            {loading || loadingResumo ? 'Atualizando...' : 'Atualizar'}
          </button>

          <button
            type="button"
            className="taser-btn-primary"
            onClick={abrirNovoCadastro}
          >
            + Novo Taser
          </button>
        </div>
      </header>

      {erro && (
        <div className="taser-alert-error">
          {erro}
        </div>
      )}

      <section
        className="taser-summary-grid"
        aria-label="Resumo patrimonial dos Tasers"
      >
        <ResumoCard
          titulo="Total de Tasers"
          valor={resumo.total}
          detalhe="equipamentos cadastrados"
          tone="blue"
        />
        <ResumoCard
          titulo="Depósito do P4"
          valor={resumo.p4}
          detalhe="sob guarda patrimonial do P4"
          tone="green"
        />
        <ResumoCard
          titulo="Cofre do SVDD"
          valor={resumo.svdd}
          detalhe="sob guarda do Serviço de Dia"
          tone="cyan"
        />
        <ResumoCard
          titulo="Carga permanente"
          valor={resumo.cargaPermanente}
          detalhe="vinculados permanentemente"
          tone="orange"
        />
        <ResumoCard
          titulo="Cautelas ativas"
          valor={resumo.cautelas}
          detalhe="entregas temporárias ativas"
          tone="yellow"
        />
        <ResumoCard
          titulo="Manutenção"
          valor={resumo.manutencao}
          detalhe="temporariamente indisponíveis"
          tone="red"
        />
        <ResumoCard
          titulo="Não localizados"
          valor={resumo.naoLocalizados}
          detalhe="localização pendente"
          tone="slate"
        />
        <ResumoCard
          titulo="Baixados"
          valor={resumo.baixados}
          detalhe="mantidos no histórico"
          tone="dark"
        />
      </section>

      <section
        className="taser-charts-grid"
        aria-label="Gráficos patrimoniais dos Tasers"
      >
        <GraficoRoscaTaser total={resumo.total} itens={dadosGrafico} />
        <GraficoBarrasTaser total={resumo.total} itens={dadosGrafico} />
      </section>

      <section className="taser-toolbar">
        <div className="taser-search">
          <label htmlFor="pesquisa">
            Pesquisar
          </label>

          <input
            id="pesquisa"
            name="pesquisa"
            type="search"
            value={filtros.pesquisa}
            onChange={handleFiltroChange}
            placeholder="Patrimônio, série, marca, modelo, equipe ou viatura"
          />
        </div>

        <div className="taser-filter">
          <label htmlFor="tipo_taser">
            Tipo
          </label>

          <select
            id="tipo_taser"
            name="tipo_taser"
            value={filtros.tipo_taser}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {tipoOptions.map((option) => {
              const valor =
                obterValorOpcao(option)

              return (
                <option
                  key={valor}
                  value={valor}
                >
                  {obterLabelOpcao(option)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="taser-filter">
          <label htmlFor="marca">
            Marca
          </label>

          <input
            id="marca"
            name="marca"
            value={filtros.marca}
            onChange={handleFiltroChange}
            placeholder="Ex.: Motorola"
          />
        </div>

        <div className="taser-filter">
          <label htmlFor="modelo">
            Modelo
          </label>

          <input
            id="modelo"
            name="modelo"
            value={filtros.modelo}
            onChange={handleFiltroChange}
            placeholder="Ex.: APX 2000"
          />
        </div>

        <div className="taser-filter">
          <label htmlFor="status_operacional">
            Status
          </label>

          <select
            id="status_operacional"
            name="status_operacional"
            value={filtros.status_operacional}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {statusOptions.map((option) => {
              const valor =
                obterValorOpcao(option)

              return (
                <option
                  key={valor}
                  value={valor}
                >
                  {obterLabelOpcao(option)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="taser-filter">
          <label htmlFor="unidade">
            Unidade
          </label>

          <select
            id="unidade"
            name="unidade"
            value={filtros.unidade}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todas
            </option>

            {UNIDADES_27_BPMM.map(
              (unidade) => (
                <option
                  key={unidade}
                  value={unidade}
                >
                  {unidade}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          className="taser-btn-secondary taser-toolbar-clear"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="taser-form-area">
          <TaserForm
            user={user}
            taserEditando={taserEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="taser-list-card">
        <div className="taser-list-header">
          <div>
            <h2>
              Tasers cadastrados
            </h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        <TaserTable
          tasers={tasers}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={abrirEdicao}
          onDelete={handleExcluir}
        />

        <footer className="taser-pagination">
          <button
            type="button"
            disabled={
              pagina <= 1 ||
              loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.max(
                  1,
                  prev - 1
                )
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
            {taserVisualizando && (
        <TaserDetalhesModal
          taser={taserVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={() =>
            abrirEdicao(
              taserVisualizando
            )
          }
        />
      )}
    </main>
  )
}
