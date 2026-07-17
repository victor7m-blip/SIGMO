import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CALIBRES_ARMAS,
  ESPECIES_ARMAS,
  PROPRIEDADES_ARMAS,
  STATUS_ARMAS
} from '../../constants/armas'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import ArmaForm from './components/ArmaForm'

import {
  excluirArma,
  listarArmas
} from '../../services/armasService'

import './styles/Armas.css'

const LIMITE = 20

const statusOptions = [
  'RESERVA',
  'CAUTELADO',
  'RECOLHIDO',
  'BAIXADO',
  'APREENDIDO'
]

const propriedadeOptions = [
  'PMESP',
  'PARTICULAR'
]

export default function Armas({ user }) {
  const [armas, setArmas] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [formAberto, setFormAberto] = useState(false)
  const [armaEditando, setArmaEditando] = useState(null)
  const [armaVisualizando, setArmaVisualizando] = useState(null)

  const [sortBy, setSortBy] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    propriedade: '',
    especie: '',
    calibre: '',
    status: '',
    unidade: ''
  })

  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(total / LIMITE))
  }, [total])

  const carregarArmas = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const pesquisa = filtros.pesquisa.trim()

      const filtrosService = {
        propriedade: filtros.propriedade,
        especie: filtros.especie,
        calibre: filtros.calibre,
        status: filtros.status,
        unidade: filtros.unidade
      }

      if (pesquisa) {
        filtrosService.patrimonio = pesquisa
      }

      const resultado = await listarArmas({
        filtros: filtrosService,
        pagina,
        limite: LIMITE,
        sortBy,
        sortDirection
      })

      setArmas(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao carregar as armas.'
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
    carregarArmas()
  }, [carregarArmas])

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
      propriedade: '',
      especie: '',
      calibre: '',
      status: '',
      unidade: ''
    })

    setPagina(1)
  }

  function abrirNovoCadastro() {
    setArmaEditando(null)
    setArmaVisualizando(null)
    setFormAberto(true)

    requestAnimationFrame(() => {
      document
        .querySelector('.armas-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function abrirEdicao(arma) {
    setArmaEditando(arma)
    setArmaVisualizando(null)
    setFormAberto(true)

    requestAnimationFrame(() => {
      document
        .querySelector('.armas-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function fecharFormulario() {
    setFormAberto(false)
    setArmaEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await carregarArmas()
  }

  async function handleExcluir(arma) {
    const identificacao =
      arma.patrimonio ||
      arma.numero_serie ||
      'registro selecionado'

    const confirmou = window.confirm(
      `Deseja realmente excluir a arma ${identificacao}?`
    )

    if (!confirmou) return

    try {
      setErro('')

      await excluirArma(arma.id, user)

      if (armaVisualizando?.id === arma.id) {
        setArmaVisualizando(null)
      }

      if (
        armas.length === 1 &&
        pagina > 1
      ) {
        setPagina((prev) => prev - 1)
      } else {
        await carregarArmas()
      }
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
          'Erro ao excluir a arma.'
      )
    }
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) =>
        prev === 'asc' ? 'desc' : 'asc'
      )

      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function indicadorOrdenacao(campo) {
    if (sortBy !== campo) return ''

    return sortDirection === 'asc'
      ? ' ↑'
      : ' ↓'
  }

  return (
    <main className="armas-page">
      <header className="armas-header">
        <div>
          <span className="armas-kicker">
            Gestão Patrimonial
          </span>

          <h1>Armas</h1>

          <p>
            Cadastro, consulta e controle do
            armamento institucional e particular.
          </p>
        </div>

        <button
          type="button"
          className="armas-btn-primary"
          onClick={abrirNovoCadastro}
        >
          Nova arma
        </button>
      </header>

      {erro && (
        <div className="armas-alert-error">
          {erro}
        </div>
      )}

      <section className="armas-toolbar">
        <div className="armas-search">
          <label htmlFor="pesquisa">
            Pesquisar
          </label>

          <input
            id="pesquisa"
            name="pesquisa"
            type="search"
            value={filtros.pesquisa}
            onChange={handleFiltroChange}
            placeholder="Patrimônio ou número de série"
          />
        </div>

        <div className="armas-filter">
          <label htmlFor="propriedade">
            Propriedade
          </label>

          <select
            id="propriedade"
            name="propriedade"
            value={filtros.propriedade}
            onChange={handleFiltroChange}
          >
            <option value="">Todas</option>

            {propriedadeOptions.map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              )
            )}
          </select>
        </div>

        <div className="armas-filter">
  <label htmlFor="especie">
    Espécie
  </label>

  <select
    id="especie"
    name="especie"
    value={filtros.especie}
    onChange={handleFiltroChange}
  >
    <option value="">
      Todas
    </option>

    {ESPECIES_ARMAS.map((especie) => (
      <option
        key={especie}
        value={especie}
      >
        {especie}
      </option>
    ))}
  </select>
</div>

        <div className="armas-filter">
  <label htmlFor="calibre">
    Calibre
  </label>

  <select
    id="calibre"
    name="calibre"
    value={filtros.calibre}
    onChange={handleFiltroChange}
  >
    <option value="">
      Todos
    </option>

    {CALIBRES_ARMAS.map((calibre) => (
      <option
        key={calibre}
        value={calibre}
      >
        {calibre}
      </option>
    ))}
  </select>
</div>

        <div className="armas-filter">
          <label htmlFor="status">
            Status
          </label>

          <select
            id="status"
            name="status"
            value={filtros.status}
            onChange={handleFiltroChange}
          >
            <option value="">Todos</option>

            {statusOptions.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="armas-filter">
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

    {UNIDADES_27_BPMM.map((unidade) => (
      <option
        key={unidade}
        value={unidade}
      >
        {unidade}
      </option>
    ))}
  </select>
</div>

        <button
          type="button"
          className="armas-btn-secondary"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="armas-form-area">
          <ArmaForm
            user={user}
            armaEditando={armaEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="armas-list-card">
        <div className="armas-list-header">
          <div>
            <h2>Armamento cadastrado</h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="armas-empty">
            Carregando armas...
          </div>
        ) : armas.length === 0 ? (
          <div className="armas-empty">
            Nenhuma arma encontrada.
          </div>
        ) : (
          <div className="armas-table-wrap">
            <table className="armas-table">
              <thead>
                <tr>
                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar('propriedade')
                      }
                    >
                      Propriedade
                      {indicadorOrdenacao(
                        'propriedade'
                      )}
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar('patrimonio')
                      }
                    >
                      Patrimônio
                      {indicadorOrdenacao(
                        'patrimonio'
                      )}
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar('numero_serie')
                      }
                    >
                      Número de série
                      {indicadorOrdenacao(
                        'numero_serie'
                      )}
                    </button>
                  </th>

                  <th>Espécie</th>
                  <th>Marca / Modelo</th>
                  <th>Calibre</th>

                  <th>
                    <button
                      type="button"
                      onClick={() =>
                        ordenar(
                          'status_operacional'
                        )
                      }
                    >
                      Status
                      {indicadorOrdenacao(
                        'status_operacional'
                      )}
                    </button>
                  </th>

                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {armas.map((arma) => (
                  <tr key={arma.id}>
                    <td>
                      <span
                        className={
                          arma.propriedade ===
                          'PARTICULAR'
                            ? 'armas-badge particular'
                            : 'armas-badge pmesp'
                        }
                      >
                        {arma.propriedade ||
                          'PMESP'}
                      </span>
                    </td>

                    <td>
                      {arma.patrimonio || '-'}
                    </td>

                    <td>
                      {arma.numero_serie || '-'}
                    </td>

                    <td>
                      {arma.especie || '-'}
                    </td>

                    <td>
                      {[arma.marca, arma.modelo]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>

                    <td>
                      {arma.calibre || '-'}
                    </td>

                    <td>
                      <span className="armas-status">
                        {arma.status_operacional ||
                          arma.status ||
                          '-'}
                      </span>
                    </td>

                    <td>
                      <div className="armas-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setArmaVisualizando(
                              arma
                            )
                          }
                        >
                          Ver
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            abrirEdicao(arma)
                          }
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            handleExcluir(arma)
                          }
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="armas-pagination">
          <button
            type="button"
            disabled={pagina <= 1 || loading}
            onClick={() =>
              setPagina((prev) =>
                Math.max(1, prev - 1)
              )
            }
          >
            Anterior
          </button>

          <span>
            Página {pagina} de {totalPaginas}
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

      {armaVisualizando && (
        <div
          className="armas-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setArmaVisualizando(null)
            }
          }}
        >
          <section
            className="armas-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da arma"
          >
            <header>
              <div>
                <span>
                  {armaVisualizando.propriedade ||
                    'PMESP'}
                </span>

                <h2>
                  {armaVisualizando.patrimonio ||
                    armaVisualizando.numero_serie ||
                    'Arma'}
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setArmaVisualizando(null)
                }
              >
                ×
              </button>
            </header>

            <div className="armas-modal-grid">
              <Info
                label="Número de série"
                value={
                  armaVisualizando.numero_serie
                }
              />

              <Info
                label="Espécie"
                value={armaVisualizando.especie}
              />

              <Info
                label="Marca"
                value={armaVisualizando.marca}
              />

              <Info
                label="Modelo"
                value={armaVisualizando.modelo}
              />

              <Info
                label="Calibre"
                value={armaVisualizando.calibre}
              />

              <Info
                label="Acabamento"
                value={
                  armaVisualizando.acabamento
                }
              />

              <Info
                label="Unidade"
                value={armaVisualizando.unidade}
              />

              <Info
                label="Status"
                value={
                  armaVisualizando.status_operacional ||
                  armaVisualizando.status
                }
              />

              {armaVisualizando.propriedade ===
                'PARTICULAR' && (
                <>
                  <Info
                    label="Número SIGMA"
                    value={
                      armaVisualizando.numero_sigma
                    }
                  />

                  <Info
                    label="Número do registro"
                    value={
                      armaVisualizando.numero_registro
                    }
                  />

                  <Info
                    label="Validade do registro"
                    value={
                      armaVisualizando.validade_registro
                    }
                  />

                  <Info
                    label="Comprimento do cano"
                    value={
                      armaVisualizando.comprimento_cano
                    }
                  />

                  <Info
                    label="Capacidade"
                    value={
                      armaVisualizando.capacidade
                    }
                  />

                  <Info
                    label="País de fabricação"
                    value={
                      armaVisualizando.pais_fabricacao
                    }
                  />

                  <Info
                    label="Ano de fabricação"
                    value={
                      armaVisualizando.ano_fabricacao
                    }
                  />

                  <Info
                    label="Proprietário"
                    value={
                      armaVisualizando.proprietario_nome
                    }
                  />

                  <Info
                    label="RE do proprietário"
                    value={
                      armaVisualizando.proprietario_re
                    }
                  />

                  <Info
                    label="Situação documental"
                    value={
                      armaVisualizando.situacao_documental
                    }
                  />
                </>
              )}
            </div>

            <div className="armas-modal-observacoes">
              <strong>Observações</strong>

              <p>
                {armaVisualizando.observacoes ||
                  'Sem observações.'}
              </p>
            </div>

            <footer>
              <button
                type="button"
                className="armas-btn-secondary"
                onClick={() =>
                  setArmaVisualizando(null)
                }
              >
                Fechar
              </button>

              <button
                type="button"
                className="armas-btn-primary"
                onClick={() => {
                  const arma =
                    armaVisualizando

                  setArmaVisualizando(null)
                  abrirEdicao(arma)
                }}
              >
                Editar
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}

function Info({ label, value }) {
  return (
    <div className="armas-info">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}