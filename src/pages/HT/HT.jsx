import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  STATUS_HT,
  TIPOS_HT
} from '../../constants/hts'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import HTForm from './components/HTForm'
import HTTable from './components/HTTable'

import {
  excluirHT,
  listarHTs
} from '../../services/htsService'

import {
  listarFotosHT
} from '../../services/htsFotosService'

import './styles/HT.css'

const LIMITE = 20
const statusOptions = STATUS_HT
const tipoOptions = TIPOS_HT

export default function HT({ user }) {
  const [hts, setHTs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [formAberto, setFormAberto] = useState(false)
  const [htEditando, setHTEditando] = useState(null)
  const [htVisualizando, setHTVisualizando] = useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [erroFotos, setErroFotos] = useState('')

  const [sortBy, setSortBy] = useState('criado_em')
  const [sortDirection, setSortDirection] = useState('desc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo_ht: '',
    marca: '',
    modelo: '',
    status_operacional: '',
    unidade: ''
  })

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const carregarHTs = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarHTs({
        filtros: {
          pesquisa: filtros.pesquisa.trim(),
          tipo_ht: filtros.tipo_ht,
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

      setHTs(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao carregar os HTs.'
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
    carregarHTs()
  }, [carregarHTs])

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
      tipo_ht: '',
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
        .querySelector('.ht-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function limparVisualizacao() {
    setHTVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirNovoCadastro() {
    setHTEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(ht) {
    setHTEditando(ht)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(ht) {
    setHTVisualizando(ht)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos =
        await listarFotosHT(ht.id)

      setFotosVisualizacao(
        Array.isArray(fotos)
          ? fotos
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar fotos do HT:',
        error
      )

      setErroFotos(
        error.message ||
        'Não foi possível carregar as fotos do HT.'
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
    setHTEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await carregarHTs()
  }

  async function handleExcluir(ht) {
    const identificacao =
      ht.patrimonio ||
      ht.numero_serie ||
      'HT'

    const confirmou = window.confirm(
      `Deseja realmente excluir o HT "${identificacao}"?`
    )

    if (!confirmou) return

    try {
      await excluirHT(ht.id, user)
      await carregarHTs()
    } catch (error) {
      window.alert(
        error.message ||
        'Erro ao excluir o HT.'
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
    <main className="ht-page">
      <header className="ht-header">
        <div>
          <span className="ht-kicker">
            Gestão Patrimonial
          </span>

          <h1>HT</h1>

          <p>
            Cadastro, consulta e controle dos
            Rádios Portáteis (HT).
          </p>
        </div>

        <button
          type="button"
          className="ht-btn-primary"
          onClick={abrirNovoCadastro}
        >
          Novo HT
        </button>
      </header>

      {erro && (
        <div className="ht-alert-error">
          {erro}
        </div>
      )}

      <section className="ht-toolbar">
        <div className="ht-search">
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

        <div className="ht-filter">
          <label htmlFor="tipo_ht">
            Tipo
          </label>

          <select
            id="tipo_ht"
            name="tipo_ht"
            value={filtros.tipo_ht}
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

        <div className="ht-filter">
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

        <div className="ht-filter">
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

        <div className="ht-filter">
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

        <div className="ht-filter">
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
          className="ht-btn-secondary ht-toolbar-clear"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="ht-form-area">
          <HTForm
            user={user}
            htEditando={htEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="ht-list-card">
        <div className="ht-list-header">
          <div>
            <h2>
              HTs cadastrados
            </h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        <HTTable
          hts={hts}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={abrirEdicao}
          onDelete={handleExcluir}
        />

        <footer className="ht-pagination">
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
            {htVisualizando && (
        <HTDetalhesModal
          ht={htVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={() =>
            abrirEdicao(
              htVisualizando
            )
          }
        />
      )}
    </main>
  )
}

function HTDetalhesModal({
  ht,
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
      (ht.foto_url
        ? {
            id: 'foto-principal-ht',
            url: ht.foto_url,
            principal: true
          }
        : null)
    )
  }, [fotos, ht.foto_url])

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
      className="ht-modal-backdrop"
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
        className="ht-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do HT"
      >
        <header>
          <div>
            <span>
              {ht.tipo_ht ||
                'HT'}
            </span>

            <h2>
              {ht.patrimonio ||
                ht.numero_serie ||
                'Rádio Portátil'}
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

        <div className="ht-modal-content">
          <div className="ht-modal-grid">
            <Info label="Patrimônio" value={ht.patrimonio} />
            <Info label="Número de série" value={ht.numero_serie} />
            <Info label="Marca" value={ht.marca} />
            <Info label="Modelo" value={ht.modelo} />
            <Info label="Tipo" value={ht.tipo_ht} />
            <Info label="Unidade" value={ht.unidade} />
            <Info label="Status operacional" value={ht.status_operacional} />
            <Info label="Local atual" value={ht.local_atual} />
            <Info label="Equipe vinculada" value={ht.equipe_vinculada} />
            <Info label="Viatura vinculada" value={ht.viatura_vinculada} />
            <Info
              label="Situação do cadastro"
              value={
                ht.ativo === false
                  ? 'INATIVO'
                  : 'ATIVO'
              }
            />
          </div>

          <div className="ht-modal-media-grid">
            {ht.qr_code && (
              <div className="ht-modal-media-card">
                <span className="ht-modal-media-title">
                  QR Code
                </span>

                <div className="ht-modal-qr-box">
                  <QRCodeCanvas
                    value={ht.qr_code}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>

                <strong>
                  {ht.numero_serie ||
                    ht.patrimonio}
                </strong>
              </div>
            )}

            <div className="ht-modal-media-card ht-modal-gallery-card">
              <span className="ht-modal-media-title">
                Fotos do equipamento
              </span>

              {carregandoFotos && (
                <div className="ht-gallery-message">
                  Carregando fotos...
                </div>
              )}

              {!carregandoFotos &&
                erroFotos && (
                  <div className="ht-gallery-error">
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
                        ht.patrimonio ||
                        ht.numero_serie ||
                        'HT'
                      }
                      className="ht-modal-photo"
                    />

                    {fotosDisponiveis.length > 1 && (
                      <div className="ht-modal-thumbnails">
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
                                    ? 'ht-modal-thumbnail is-selected'
                                    : 'ht-modal-thumbnail'
                                }
                                onClick={() =>
                                  setFotoSelecionada(foto)
                                }
                                aria-label={`Visualizar foto ${index + 1}`}
                              >
                                <img
                                  src={foto.url}
                                  alt={`Miniatura ${index + 1} do HT`}
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

                    <small className="ht-gallery-counter">
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
                  <div className="ht-gallery-message">
                    Nenhuma foto cadastrada.
                  </div>
                )}
            </div>
          </div>

          <div className="ht-modal-observacoes">
            <strong>
              Observações
            </strong>

            <p>
              {ht.observacoes ||
                'Sem observações.'}
            </p>
          </div>
        </div>

        <footer>
          <button
            type="button"
            className="ht-btn-secondary"
            onClick={onClose}
          >
            Fechar
          </button>

          <button
            type="button"
            className="ht-btn-primary"
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
    <div className="ht-info">
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