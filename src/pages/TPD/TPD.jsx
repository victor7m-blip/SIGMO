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

import {
  excluirTPD,
  listarTPDs
} from '../../services/tpdsService'

import {
  listarFotosTPD
} from '../../services/tpdsFotosService'

import './styles/TPD.css'

const LIMITE = 20
const statusOptions = STATUS_TPD
const tipoOptions = TIPOS_TPD

export default function TPD({ user }) {
  const [tpds, setTPDs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

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
    await carregarTPDs()
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
      await carregarTPDs()
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

function TPDDetalhesModal({
  tpd,
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
      (tpd.foto_url
        ? {
            id: 'foto-principal-tpd',
            url: tpd.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, tpd.foto_url])

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
      className="tpd-modal-backdrop"
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
        className="tpd-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do TPD"
      >
        <header>
          <div>
            <span>
              {tpd.tipo_equipamento ||
                'TPD'}
            </span>

            <h2>
              {tpd.patrimonio ||
                tpd.numero_serie ||
                'Terminal Portátil de Dados'}
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

        <div className="tpd-modal-content">
          <div className="tpd-modal-grid">
            <Info
              label="Patrimônio"
              value={tpd.patrimonio}
            />

            <Info
              label="Número de série"
              value={tpd.numero_serie}
            />

            <Info
              label="Marca"
              value={tpd.marca}
            />

            <Info
              label="Modelo"
              value={tpd.modelo}
            />

            <Info
              label="Tipo de equipamento"
              value={
                tpd.tipo_equipamento
              }
            />

            <Info
              label="Unidade"
              value={tpd.unidade}
            />

            <Info
              label="Status operacional"
              value={
                tpd.status_operacional
              }
            />

            <Info
              label="Local atual"
              value={tpd.local_atual}
            />

            <Info
              label="Equipe vinculada"
              value={
                tpd.equipe_vinculada
              }
            />

            <Info
              label="Viatura vinculada"
              value={
                tpd.viatura_vinculada
              }
            />

            <Info
              label="Situação do cadastro"
              value={
                tpd.ativo === false
                  ? 'INATIVO'
                  : 'ATIVO'
              }
            />
          </div>

          <div className="tpd-modal-media-grid">
            {tpd.qr_code && (
              <div className="tpd-modal-media-card">
                <span className="tpd-modal-media-title">
                  QR Code
                </span>

                <div className="tpd-modal-qr-box">
                  <QRCodeCanvas
                    value={tpd.qr_code}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>

                <strong>
                  {tpd.numero_serie ||
                    tpd.patrimonio}
                </strong>
              </div>
            )}

            <div className="tpd-modal-media-card tpd-modal-gallery-card">
              <span className="tpd-modal-media-title">
                Fotos do equipamento
              </span>

              {carregandoFotos && (
                <div className="tpd-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="tpd-gallery-error">
                    {erroFotos}
                  </div>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                fotoSelecionada && (
                  <>
                    <img
                      src={
                        fotoSelecionada.url
                      }
                      alt={
                        tpd.patrimonio ||
                        tpd.numero_serie ||
                        'TPD'
                      }
                      className="tpd-modal-photo"
                    />

                    {fotosDisponiveis.length >
                      1 && (
                      <div className="tpd-modal-thumbnails">
                        {fotosDisponiveis.map(
                          (
                            foto,
                            index
                          ) => {
                            const selecionada =
                              fotoSelecionada?.id ===
                                foto.id ||
                              fotoSelecionada?.url ===
                                foto.url

                            return (
                              <button
                                key={
                                  foto.id ||
                                  `${foto.url}-${index}`
                                }
                                type="button"
                                className={
                                  selecionada
                                    ? 'tpd-modal-thumbnail is-selected'
                                    : 'tpd-modal-thumbnail'
                                }
                                onClick={() =>
                                  setFotoSelecionada(
                                    foto
                                  )
                                }
                                aria-label={`Visualizar foto ${
                                  index + 1
                                }`}
                              >
                                <img
                                  src={foto.url}
                                  alt={`Miniatura ${
                                    index + 1
                                  } do TPD`}
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

                    <small className="tpd-gallery-counter">
                      {
                        fotosDisponiveis.length
                      }{' '}
                      {fotosDisponiveis.length ===
                      1
                        ? 'foto cadastrada'
                        : 'fotos cadastradas'}
                    </small>
                  </>
                )}

              {!carregandoFotos &&
                !erroFotos &&
                !fotoSelecionada && (
                  <div className="tpd-gallery-message">
                    Nenhuma foto
                    cadastrada.
                  </div>
                )}
            </div>
          </div>

          <div className="tpd-modal-observacoes">
            <strong>
              Observações
            </strong>

            <p>
              {tpd.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        <footer>
          <button
            type="button"
            className="tpd-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          <button
            type="button"
            className="tpd-btn-primary"
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
    <div className="tpd-info">
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