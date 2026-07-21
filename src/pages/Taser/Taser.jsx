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

import {
  excluirTaser,
  listarTasers
} from '../../services/tasersService'

import {
  listarFotosTaser
} from '../../services/tasersFotosService'

import './styles/Taser.css'

const LIMITE = 20
const statusOptions = STATUS_TASER
const tipoOptions = TIPOS_TASER

export default function Taser({ user }) {
  const [tasers, setTasers] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

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

  useEffect(() => {
    carregarTasers()
  }, [carregarTasers])

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
    await carregarTasers()
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
      await carregarTasers()
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

        <button
          type="button"
          className="taser-btn-primary"
          onClick={abrirNovoCadastro}
        >
          Novo Taser
        </button>
      </header>

      {erro && (
        <div className="taser-alert-error">
          {erro}
        </div>
      )}

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

function TaserDetalhesModal({
  taser,
  fotos = [],
  carregandoFotos = false,
  erroFotos = '',
  onClose,
  onEdit
}) {
  const fotoPrincipal = useMemo(() => {
    return (
      fotos.find(
        (foto) => foto.principal
      ) ||
      fotos[0] ||
      (taser.foto_url
        ? {
            id: 'foto-principal-taser',
            url: taser.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, taser.foto_url])

  const [
    fotoSelecionada,
    setFotoSelecionada
  ] = useState(fotoPrincipal)

  useEffect(() => {
    setFotoSelecionada(
      fotoPrincipal
    )
  }, [fotoPrincipal])

  const fotosDisponiveis =
    fotos.length > 0
      ? fotos
      : fotoPrincipal
        ? [fotoPrincipal]
        : []

  return (
    <div
      className="taser-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <section
        className="taser-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do Taser"
      >
        <header>
          <div>
            <span>
              {taser.tipo_taser ||
                'Taser'}
            </span>

            <h2>
              {taser.patrimonio ||
                taser.numero_serie ||
                'TASER'}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="taser-modal-content">
          <div className="taser-modal-grid">
            <Info label="Patrimônio" value={taser.patrimonio} />
            <Info label="Número de série" value={taser.numero_serie} />
            <Info label="Marca" value={taser.marca} />
            <Info label="Modelo" value={taser.modelo} />
            <Info label="Tipo" value={taser.tipo_taser} />
            <Info label="Unidade" value={taser.unidade} />
            <Info label="Status operacional" value={taser.status_operacional} />
            <Info label="Local atual" value={taser.local_atual} />
            <Info label="Equipe vinculada" value={taser.equipe_vinculada} />
            <Info label="Viatura vinculada" value={taser.viatura_vinculada} />
            <Info
              label="Situação do cadastro"
              value={
                taser.ativo === false
                  ? 'INATIVO'
                  : 'ATIVO'
              }
            />
          </div>

          <div className="taser-modal-media-grid">
            {taser.qr_code && (
              <div className="taser-modal-media-card">
                <span className="taser-modal-media-title">
                  QR Code
                </span>

                <div className="taser-modal-qr-box">
                  <QRCodeCanvas
                    value={taser.qr_code}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>

                <strong>
                  {taser.numero_serie ||
                    taser.patrimonio}
                </strong>
              </div>
            )}

            <div className="taser-modal-media-card taser-modal-gallery-card">
              <span className="taser-modal-media-title">
                Fotos do equipamento
              </span>

              {carregandoFotos && (
                <div className="taser-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="taser-gallery-error">
                    {erroFotos}
                  </div>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                fotoSelecionada && (
                  <>
                    <img
                      src={fotoSelecionada.url}
                      alt={
                        taser.patrimonio ||
                        taser.numero_serie ||
                        'Taser'
                      }
                      className="taser-modal-photo"
                    />

                    {fotosDisponiveis.length > 1 && (
                      <div className="taser-modal-thumbnails">
                        {fotosDisponiveis.map(
                          (
                            foto,
                            index
                          ) => {
                            const selecionada =
                              fotoSelecionada?.id === foto.id ||
                              fotoSelecionada?.url === foto.url

                            return (
                              <button
                                key={
                                  foto.id ||
                                  `${foto.url}-${index}`
                                }
                                type="button"
                                className={
                                  selecionada
                                    ? 'taser-modal-thumbnail is-selected'
                                    : 'taser-modal-thumbnail'
                                }
                                onClick={() =>
                                  setFotoSelecionada(foto)
                                }
                                aria-label={`Visualizar foto ${index + 1}`}
                              >
                                <img
                                  src={foto.url}
                                  alt={`Miniatura ${index + 1} do Taser`}
                                />

                                {foto.principal && (
                                  <span>
                                    Principal
                                  </span>
                                )}
                              </button>
                            )
                          }
                        )}
                      </div>
                    )}

                    <small className="taser-gallery-counter">
                      {fotosDisponiveis.length}{' '}
                      {fotosDisponiveis.length === 1
                        ? 'foto cadastrada'
                        : 'fotos cadastradas'}
                    </small>
                  </>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                !fotoSelecionada && (
                  <div className="taser-gallery-message">
                    Nenhuma foto cadastrada.
                  </div>
                )}
            </div>
          </div>

          <div className="taser-modal-observacoes">
            <strong>
              Observações
            </strong>

            <p>
              {taser.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        <footer>
          <button
            type="button"
            className="taser-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          <button
            type="button"
            className="taser-btn-primary"
            onClick={onEdit}
          >
            Editar
          </button>
        </footer>
      </section>
    </div>
  )
}

function Info({
  label,
  value
}) {
  return (
    <div className="taser-info">
      <span>
        {label}
      </span>

      <strong>
        {value === null ||
        value === undefined ||
        value === ''
          ? '—'
          : value}
      </strong>
    </div>
  )
}