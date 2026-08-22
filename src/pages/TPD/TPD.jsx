import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  STATUS_TPD,
  TIPOS_TPD
} from '../../constants/tpds'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import TPDForm from './components/TPDForm'
import TPDTable from './components/TPDTable'
import TPDDetalhesModal from './components/TPDDetalhesModal'

import {
  excluirTPD,
  listarTPDs,
  obterResumoTPDs
} from '../../services/tpdsService'

import {
  listarFotosTPD
} from '../../services/tpdsFotosService'

import "./styles/TPD.css";

const LIMITE = 20
const statusOptions = STATUS_TPD
const tipoOptions = TIPOS_TPD

export default function TPD({ user }) {
  const [tpds, setTPDs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [resumo, setResumo] = useState({
    total: 0,
    cofreSvdd: 0,
    cautelasAtivas: 0,
    manutencao: 0,
    recolhidos: 0,
    baixados: 0,
    outros: 0
  })

  const [formAberto, setFormAberto] = useState(false)
  const [tpdEditando, setTPDEditando] = useState(null)
  const [tpdVisualizando, setTPDVisualizando] = useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [erroFotos, setErroFotos] = useState('')

  const [sortBy, setSortBy] = useState('criado_em')
  const [sortDirection, setSortDirection] = useState('desc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo_equipamento: '',
    marca: '',
    modelo: '',
    status_operacional: '',
    unidade: ''
  })

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const carregarResumo = useCallback(async () => {
    try {
      const dados =
        await obterResumoTPDs()

      setResumo(
        dados || {
          total: 0,
          cofreSvdd: 0,
          cautelasAtivas: 0,
          manutencao: 0,
          recolhidos: 0,
          baixados: 0,
          outros: 0
        }
      )
    } catch (error) {
      console.error(
        'Erro ao carregar resumo dos TPDs:',
        error
      )
    }
  }, [])

  const carregarTPDs = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarTPDs({
        filtros: {
          pesquisa: filtros.pesquisa.trim(),
          tipo_equipamento: filtros.tipo_equipamento,
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

      setTPDs(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao carregar os TPDs.'
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

  useEffect(() => {
    carregarTPDs()
  }, [carregarTPDs])

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
      tipo_equipamento: '',
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
        .querySelector('.tpd-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function limparVisualizacao() {
    setTPDVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirNovoCadastro() {
    setTPDEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(tpd) {
    setTPDEditando(tpd)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(tpd) {
    setTPDVisualizando(tpd)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos = await listarFotosTPD(tpd.id)

      setFotosVisualizacao(
        Array.isArray(fotos)
          ? fotos
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar fotos do TPD:',
        error
      )

      setErroFotos(
        error.message ||
        'Não foi possível carregar as fotos do TPD.'
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
    setTPDEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await Promise.all([
      carregarTPDs(),
      carregarResumo()
    ])
  }

  async function handleExcluir(tpd) {
    const identificacao =
      tpd.patrimonio ||
      tpd.numero_serie ||
      'TPD'

    const confirmou = window.confirm(
      `Deseja realmente excluir o TPD "${identificacao}"?`
    )

    if (!confirmou) return

    try {
      await excluirTPD(tpd.id, user)
      await Promise.all([
        carregarTPDs(),
        carregarResumo()
      ])
    } catch (error) {
      window.alert(
        error.message ||
        'Erro ao excluir o TPD.'
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

  const distribuicao = [
    {
      chave: 'cofreSvdd',
      label: 'Cofre do SVDD',
      valor: resumo.cofreSvdd,
      classe: 'azul'
    },
    {
      chave: 'cautelasAtivas',
      label: 'Cautelas ativas',
      valor: resumo.cautelasAtivas,
      classe: 'amarelo'
    },
    {
      chave: 'manutencao',
      label: 'Manutenção',
      valor: resumo.manutencao,
      classe: 'laranja'
    },
    {
      chave: 'recolhidos',
      label: 'Recolhidos',
      valor: resumo.recolhidos,
      classe: 'roxo'
    },
    {
      chave: 'outros',
      label: 'Outras situações',
      valor: resumo.outros,
      classe: 'cinza'
    }
  ]

  const totalGrafico =
    Math.max(
      1,
      distribuicao.reduce(
        (soma, item) =>
          soma + Number(item.valor || 0),
        0
      )
    )

  let acumuladoGrafico = 0

  const coresGrafico = {
    azul: '#1677d2',
    amarelo: '#e4ad13',
    laranja: '#e47c15',
    roxo: '#7450c8',
    cinza: '#8796a8'
  }

  const gradienteRosca =
    distribuicao
      .filter(
        (item) =>
          Number(item.valor || 0) > 0
      )
      .map((item) => {
        const inicio =
          acumuladoGrafico

        acumuladoGrafico +=
          (
            Number(item.valor || 0) /
            totalGrafico
          ) * 100

        return `${coresGrafico[item.classe]} ${inicio}% ${acumuladoGrafico}%`
      })
      .join(', ') ||
    '#d8e3ef 0% 100%'

  function filtrarPorResumo(chave) {
    setPagina(1)

    if (chave === 'cofreSvdd') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'RESERVA',
        pesquisa: 'COFRE DO SVDD'
      }))
      return
    }

    if (chave === 'cautelasAtivas') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'EM_SERVICO',
        pesquisa: ''
      }))
      return
    }

    if (chave === 'manutencao') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'MANUTENCAO',
        pesquisa: ''
      }))
      return
    }

    if (chave === 'recolhidos') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'RECOLHIDO',
        pesquisa: ''
      }))
      return
    }

    setFiltros((prev) => ({
      ...prev,
      status_operacional: '',
      pesquisa: ''
    }))
  }

  return (
    <main className="tpd-page">
      <header className="tpd-header">
        <div>
          <span className="tpd-kicker">
            Gestão Patrimonial
          </span>

          <h1>TPD</h1>

          <p>
            Cadastro, consulta e controle dos
            Terminais Portáteis de Dados.
          </p>
        </div>

        <button
          type="button"
          className="tpd-btn-primary"
          onClick={abrirNovoCadastro}
        >
          Novo TPD
        </button>
      </header>

      <section className="tpd-resumo-grid">
        <article className="tpd-resumo-card tpd-resumo-total">
          <small>Carga patrimonial</small>
          <strong>{resumo.total}</strong>
          <span>Total de TPDs cadastrados</span>
        </article>

        <article className="tpd-resumo-card">
          <small>TPDs</small>
          <strong>{resumo.total}</strong>
          <span>Equipamentos ativos</span>
        </article>

        <article className="tpd-resumo-card">
          <small>Em manutenção</small>
          <strong>{resumo.manutencao}</strong>
          <span>Equipamentos indisponíveis</span>
        </article>
      </section>

      <section className="tpd-distribuicao">
        <div className="tpd-section-title">
          <div>
            <span>DISTRIBUIÇÃO ATUAL</span>
            <h2>Onde estão os TPDs</h2>
          </div>
        </div>

        <div className="tpd-distribuicao-cards">
          {distribuicao.map((item) => (
            <button
              type="button"
              key={item.chave}
              className={`tpd-local-card tpd-local-${item.classe}`}
              onClick={() =>
                filtrarPorResumo(item.chave)
              }
            >
              <span>{item.label}</span>
              <strong>{item.valor}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="tpd-graficos-grid">
        <article className="tpd-grafico-card">
          <div className="tpd-grafico-titulo">
            <span>DISTRIBUIÇÃO</span>
            <h3>TPDs por situação</h3>
          </div>

          <div className="tpd-rosca-layout">
            <div
              className="tpd-rosca"
              style={{
                background:
                  `conic-gradient(${gradienteRosca})`
              }}
            >
              <div>
                <strong>{resumo.total}</strong>
                <small>TOTAL</small>
              </div>
            </div>

            <div className="tpd-legenda">
              {distribuicao.map((item) => {
                const percentual =
                  resumo.total > 0
                    ? (
                        Number(item.valor || 0) /
                        resumo.total
                      ) * 100
                    : 0

                return (
                  <div
                    key={item.chave}
                    className="tpd-legenda-linha"
                  >
                    <i
                      className={`tpd-cor tpd-cor-${item.classe}`}
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

        <article className="tpd-grafico-card">
          <div className="tpd-grafico-titulo">
            <span>COMPARATIVO</span>
            <h3>TPDs por local</h3>
          </div>

          <div className="tpd-barras">
            {distribuicao.map((item) => {
              const percentual =
                resumo.total > 0
                  ? (
                      Number(item.valor || 0) /
                      resumo.total
                    ) * 100
                  : 0

              return (
                <div
                  key={item.chave}
                  className="tpd-barra-linha"
                >
                  <span>{item.label}</span>

                  <div className="tpd-barra-trilho">
                    <i
                      className={`tpd-barra-preenchimento tpd-barra-${item.classe}`}
                      style={{
                        width:
                          `${percentual}%`
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
        <div className="tpd-alert-error">
          {erro}
        </div>
      )}

      <section className="tpd-toolbar">
        <div className="tpd-search">
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

        <div className="tpd-filter">
          <label htmlFor="tipo_equipamento">
            Tipo
          </label>

          <select
            id="tipo_equipamento"
            name="tipo_equipamento"
            value={filtros.tipo_equipamento}
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

        <div className="tpd-filter">
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

        <div className="tpd-filter">
          <label htmlFor="modelo">
            Modelo
          </label>

          <input
            id="modelo"
            name="modelo"
            value={filtros.modelo}
            onChange={handleFiltroChange}
            placeholder="Ex.: G56"
          />
        </div>

        <div className="tpd-filter">
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

        <div className="tpd-filter">
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
          className="tpd-btn-secondary tpd-toolbar-clear"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="tpd-form-area">
          <TPDForm
            user={user}
            tpdEditando={tpdEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="tpd-list-card">
        <div className="tpd-list-header">
          <div>
            <h2>
              TPDs cadastrados
            </h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        <TPDTable
          tpds={tpds}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={abrirEdicao}
          onDelete={handleExcluir}
        />

        <footer className="tpd-pagination">
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

               

      {tpdVisualizando && (
        <TPDDetalhesModal
          tpd={tpdVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={() =>
            abrirEdicao(
              tpdVisualizando
            )
          }
        />
      )}
    </main>
  )
}
