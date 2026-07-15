import {
  useEffect,
  useMemo,
  useState
} from 'react'

import './Policiais.css'
import './styles/policiaisForm.css'
import './styles/policiaisHeader.css'
import './styles/policiaisModal.css'
import './styles/policiaisTable.css'
import './components/policialViewModal.css'

import PolicialForm from './components/PolicialForm'
import PolicialTable from './components/PolicialTable'
import PolicialViewModal from './components/PolicialViewModal'
import UltimasAlteracoes from './components/UltimasAlteracoes'
import QrScanner from '../../components/QrScanner/QrScanner'

import {
  listarFotosPolicial
} from '../../services/policiaisFotosService'

import {
  listarPoliciais
} from '../../services/policiaisService'

import {
  ehUsuario,
  podeCadastrarPolicial,
  podeEditarPolicial,
  podePesquisarOutrosPoliciais,
  podeVisualizarPolicial
} from '../../services/permissionService'

const initialFilters = {
  nome: '',
  nome_guerra: '',
  re: '',
  perfil: '',
  posto_graduacao: '',
  companhia: '',
  pelotao: '',
  situacao: '',
  qr_code: ''
}

const postosGraduacoes = [
  'SD PM',
  'CB PM',
  '3º SGT PM',
  '2º SGT PM',
  '1º SGT PM',
  'SUBTEN PM',
  'ASP OF PM',
  '2º TEN PM',
  '1º TEN PM',
  'CAP PM',
  'MAJ PM',
  'TEN CEL PM',
  'CEL PM'
]

const perfis = [
  'ADMINISTRADOR',
  'COMANDANTE DE CIA',
  'ENCARREGADO DO SVDD',
  'AUXILIAR DO SVDD',
  'USUÁRIO'
]

const companhias = [
  '1ª CIA',
  '2ª CIA',
  '3ª CIA',
  '4ª CIA',
  '5ª CIA',
  '6ª CIA',
  'FT',
  'BTL'
]

const pelotoes = [
  'A',
  'B',
  'C',
  'D',
  'POP',
  'ESCOLAR',
  'ADM'
]

const situacoes = [
  'ATIVO',
  'AFASTADO',
  'FÉRIAS',
  'LICENÇA',
  'TRANSFERIDO',
  'INATIVO'
]

const LIMITE_POR_PAGINA = 20

function maskRE(value) {
  const limpo = String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 7)

  const numeros = limpo
    .slice(0, 6)
    .replace(/\D/g, '')

  const digito =
    limpo.slice(6, 7)

  if (numeros.length < 6) {
    return numeros
  }

  return digito
    ? `${numeros}-${digito}`
    : `${numeros}-`
}

function obterReUsuario(user) {
  return String(
    user?.re ||
    user?.policial?.re ||
    ''
  )
    .trim()
    .toUpperCase()
}

export default function Policiais({
  user
}) {
  const usuarioRestrito =
    ehUsuario(user)

  const podePesquisar =
    podePesquisarOutrosPoliciais(
      user
    )

  const podeCadastrar =
    podeCadastrarPolicial(user)

  const reUsuario =
    obterReUsuario(user)

  const [
    showForm,
    setShowForm
  ] = useState(false)

  const [
    policialEditando,
    setPolicialEditando
  ] = useState(null)

  const [
    policialVisualizando,
    setPolicialVisualizando
  ] = useState(null)

  const [
    fotosModal,
    setFotosModal
  ] = useState([])

  const [
    policiais,
    setPoliciais
  ] = useState([])

  const [
    filters,
    setFilters
  ] = useState(initialFilters)

  const [
    debouncedFilters,
    setDebouncedFilters
  ] = useState(initialFilters)

  const [
    pagina,
    setPagina
  ] = useState(1)

  const [
    total,
    setTotal
  ] = useState(0)

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState('')

  const [
    reloadKey,
    setReloadKey
  ] = useState(0)

  const [
    sortBy,
    setSortBy
  ] = useState('nome_guerra')

  const [
    sortDirection,
    setSortDirection
  ] = useState('asc')

  const [
    scannerAberto,
    setScannerAberto
  ] = useState(false)

  const totalPaginas =
    Math.ceil(
      total /
      LIMITE_POR_PAGINA
    ) || 1

  const registroInicial =
    total === 0
      ? 0
      : (
          pagina - 1
        ) *
          LIMITE_POR_PAGINA +
        1

  const registroFinal =
    Math.min(
      pagina *
        LIMITE_POR_PAGINA,
      total
    )

  const paginasVisiveis =
    useMemo(() => {
      const paginas = []

      const inicio =
        Math.max(
          1,
          pagina - 2
        )

      const fim =
        Math.min(
          totalPaginas,
          pagina + 2
        )

      for (
        let numero = inicio;
        numero <= fim;
        numero += 1
      ) {
        paginas.push(numero)
      }

      return paginas
    }, [
      pagina,
      totalPaginas
    ])
      useEffect(() => {
    if (
      !usuarioRestrito
    ) {
      return
    }

    const filtrosUsuario = {
      ...initialFilters,
      re: reUsuario
    }

    setFilters(
      filtrosUsuario
    )

    setDebouncedFilters(
      filtrosUsuario
    )

    setPagina(1)
  }, [
    usuarioRestrito,
    reUsuario
  ])

  useEffect(() => {
    if (
      usuarioRestrito
    ) {
      return
    }

    const timer =
      setTimeout(() => {
        setDebouncedFilters(
          filters
        )

        setPagina(1)
      }, 400)

    return () =>
      clearTimeout(timer)
  }, [
    filters,
    usuarioRestrito
  ])

  useEffect(() => {
    carregarPoliciais()
  }, [
    debouncedFilters,
    pagina,
    reloadKey,
    sortBy,
    sortDirection,
    usuarioRestrito,
    reUsuario
  ])

  async function carregarPoliciais() {
    try {
      setLoading(true)
      setErro('')

      if (
        usuarioRestrito &&
        !reUsuario
      ) {
        setPoliciais([])
        setTotal(0)

        setErro(
          'Não foi possível identificar o RE do usuário autenticado.'
        )

        return
      }

      const filtrosConsulta =
        usuarioRestrito
          ? {
              ...initialFilters,
              re: reUsuario
            }
          : debouncedFilters

      const resultado =
        await listarPoliciais({
          filtros:
            filtrosConsulta,

          pagina:
            usuarioRestrito
              ? 1
              : pagina,

          limite:
            usuarioRestrito
              ? 1
              : LIMITE_POR_PAGINA,

          sortBy,

          sortDirection
        })

      const listaRecebida =
        resultado.data || []

      const listaPermitida =
        usuarioRestrito
          ? listaRecebida.filter(
              (policial) =>
                podeVisualizarPolicial(
                  user,
                  policial
                )
            )
          : listaRecebida

      setPoliciais(
        listaPermitida
      )

      setTotal(
        usuarioRestrito
          ? listaPermitida.length
          : resultado.total || 0
      )
    } catch (error) {
      console.error(error)

      setPoliciais([])
      setTotal(0)

      setErro(
        'Erro ao carregar policiais.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleNovoPolicial() {
    if (
      !podeCadastrar
    ) {
      return
    }

    setPolicialEditando(null)
    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  async function handleView(
    policial
  ) {
    if (
      !podeVisualizarPolicial(
        user,
        policial
      )
    ) {
      return
    }

    setPolicialVisualizando(
      policial
    )

    try {
      const fotos =
        await listarFotosPolicial(
          policial.id
        )

      setFotosModal(
        fotos || []
      )
    } catch (error) {
      console.error(error)

      setFotosModal([])
    }
  }

  function handleEditar(
    policial
  ) {
    if (
      !podeEditarPolicial(
        user,
        policial
      )
    ) {
      return
    }

    setPolicialEditando(
      policial
    )

    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  function handleCancel() {
    setPolicialEditando(null)
    setShowForm(false)
  }

  function handleSaved(
    policialAtualizado,
    opcoes = {}
  ) {
    setReloadKey(
      (prev) => prev + 1
    )

    if (
      opcoes.manterAberto
    ) {
      setPolicialEditando(
        policialAtualizado
      )

      return
    }

    setPolicialEditando(null)
    setShowForm(false)
  }

  function handleFiltersChange(
    newFilters
  ) {
    if (
      !podePesquisar
    ) {
      return
    }

    setFilters(
      newFilters
    )
  }

  function handleClearFilters() {
    if (
      !podePesquisar
    ) {
      return
    }

    setFilters(
      initialFilters
    )

    setDebouncedFilters(
      initialFilters
    )

    setPagina(1)
  }

  function handleDeleted(id) {
    if (
      usuarioRestrito
    ) {
      return
    }

    setPoliciais(
      (listaAtual) =>
        listaAtual.filter(
          (policial) =>
            policial.id !== id
        )
    )

    setTotal(
      (atual) =>
        Math.max(
          atual - 1,
          0
        )
    )
  }

  function handleSort(campo) {
    if (
      usuarioRestrito
    ) {
      return
    }

    setPagina(1)

    if (
      sortBy === campo
    ) {
      setSortDirection(
        (atual) =>
          atual === 'asc'
            ? 'desc'
            : 'asc'
      )

      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function handleQrRead(valor) {
    if (
      !podePesquisar
    ) {
      setScannerAberto(false)
      return
    }

    const novosFiltros = {
      ...initialFilters,
      qr_code: valor
    }

    setFilters(
      novosFiltros
    )

    setDebouncedFilters(
      novosFiltros
    )

    setPagina(1)
    setScannerAberto(false)
  }

  function handlePrintFicha() {
    window.print()
  }

  function handlePrintCredencial() {
    window.print()
  }

  return (
    <main className="page policiais-page">
      <header className="policiais-header">
        <div>
          <span className="policiais-kicker">
            SIGMO
          </span>

          <h1>
            {usuarioRestrito
              ? 'Meu Cadastro'
              : 'Cadastro de Policiais'}
          </h1>

          <p>
            {usuarioRestrito
              ? 'Consulte e mantenha seus dados pessoais atualizados.'
              : 'Gestão, consulta e controle do efetivo institucional.'}
          </p>
        </div>

        {podeCadastrar && (
          <button
            type="button"
            className="btn-primary"
            onClick={
              handleNovoPolicial
            }
          >
            + Novo Policial
          </button>
        )}
      </header>

      {showForm && (
        <PolicialForm
          user={user}
          policialEditando={
            policialEditando
          }
          onCancel={
            handleCancel
          }
          onSaved={
            handleSaved
          }
        />
      )}
            <section className="panel">
        {podePesquisar ? (
          <div className="policiais-filters-card">
            <div className="policiais-filters-header">
              <div>
                <strong>
                  Filtros
                </strong>

                <span>
                  Pesquise por nome, RE ou dados funcionais.
                </span>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={
                  handleClearFilters
                }
              >
                Limpar filtros
              </button>
            </div>

            <div className="policiais-filters-grid">
              <label>
                Nome

                <input
                  value={
                    filters.nome
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      nome:
                        event.target.value
                          .toUpperCase()
                    })
                  }
                  placeholder="Nome completo"
                />
              </label>

              <label>
                Nome de guerra

                <input
                  value={
                    filters.nome_guerra
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      nome_guerra:
                        event.target.value
                          .toUpperCase()
                    })
                  }
                  placeholder="Ex: SILVA"
                />
              </label>

              <label>
                RE

                <input
                  value={
                    filters.re
                  }
                  maxLength={8}
                  placeholder="123456-A"
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      re:
                        maskRE(
                          event.target.value
                        )
                    })
                  }
                />
              </label>

              <label>
                Perfil

                <select
                  value={
                    filters.perfil
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      perfil:
                        event.target.value
                    })
                  }
                >
                  <option value="">
                    Todos
                  </option>

                  {perfis.map(
                    (perfil) => (
                      <option
                        key={perfil}
                        value={perfil}
                      >
                        {perfil}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Posto / Graduação

                <select
                  value={
                    filters.posto_graduacao
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      posto_graduacao:
                        event.target.value
                    })
                  }
                >
                  <option value="">
                    Todos
                  </option>

                  {postosGraduacoes.map(
                    (posto) => (
                      <option
                        key={posto}
                        value={posto}
                      >
                        {posto}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Companhia

                <select
                  value={
                    filters.companhia
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      companhia:
                        event.target.value
                    })
                  }
                >
                  <option value="">
                    Todas
                  </option>

                  {companhias.map(
                    (companhia) => (
                      <option
                        key={companhia}
                        value={companhia}
                      >
                        {companhia}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Pelotão

                <select
                  value={
                    filters.pelotao
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      pelotao:
                        event.target.value
                    })
                  }
                >
                  <option value="">
                    Todos
                  </option>

                  {pelotoes.map(
                    (pelotao) => (
                      <option
                        key={pelotao}
                        value={pelotao}
                      >
                        {pelotao}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Situação

                <select
                  value={
                    filters.situacao
                  }
                  onChange={(event) =>
                    handleFiltersChange({
                      ...filters,

                      situacao:
                        event.target.value
                    })
                  }
                >
                  <option value="">
                    Todas
                  </option>

                  {situacoes.map(
                    (situacao) => (
                      <option
                        key={situacao}
                        value={situacao}
                      >
                        {situacao}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="policiais-qr-toolbar">
              <button
                type="button"
                className="qr-filter-button"
                onClick={() =>
                  setScannerAberto(
                    true
                  )
                }
              >
                📷 Ler QR
              </button>

              {filters.qr_code && (
                <span className="policiais-qr-filter-active">
                  QR Code aplicado
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="policiais-filters-card">
            <div className="policiais-filters-header">
              <div>
                <strong>
                  Acesso ao próprio cadastro
                </strong>

                <span>
                  Você pode consultar e solicitar alterações somente nos seus próprios dados.
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="policiais-table-toolbar">
          <span>
            {usuarioRestrito
              ? total === 1
                ? 'Seu cadastro foi localizado.'
                : 'Nenhum cadastro vinculado ao usuário foi localizado.'
              : (
                  <>
                    Mostrando{' '}
                    {registroInicial}
                    –
                    {registroFinal}
                    {' '}de{' '}
                    {total} registros
                  </>
                )}
          </span>
        </div>

        <PolicialTable
          user={user}
          policiais={
            policiais
          }
          loading={
            loading
          }
          erro={
            erro
          }
          sortBy={
            sortBy
          }
          sortDirection={
            sortDirection
          }
          onSort={
            handleSort
          }
          onView={
            handleView
          }
          onEdit={
            handleEditar
          }
          onDeleted={
            handleDeleted
          }
        />

        {!usuarioRestrito && (
          <div className="policiais-pagination">
            <button
              type="button"
              disabled={
                pagina <= 1
              }
              onClick={() =>
                setPagina(1)
              }
            >
              Primeira
            </button>

            <button
              type="button"
              disabled={
                pagina <= 1
              }
              onClick={() =>
                setPagina(
                  (prev) =>
                    prev - 1
                )
              }
            >
              Anterior
            </button>

            {pagina > 3 && (
              <span className="policiais-pagination-dots">
                ...
              </span>
            )}

            {paginasVisiveis.map(
              (numero) => (
                <button
                  key={numero}
                  type="button"
                  className={
                    numero === pagina
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setPagina(
                      numero
                    )
                  }
                >
                  {numero}
                </button>
              )
            )}
                        {pagina <
              totalPaginas - 2 && (
              <span className="policiais-pagination-dots">
                ...
              </span>
            )}

            <button
              type="button"
              disabled={
                pagina >=
                totalPaginas
              }
              onClick={() =>
                setPagina(
                  (prev) =>
                    prev + 1
                )
              }
            >
              Próxima
            </button>

            <button
              type="button"
              disabled={
                pagina >=
                totalPaginas
              }
              onClick={() =>
                setPagina(
                  totalPaginas
                )
              }
            >
              Última
            </button>
          </div>
        )}

        <UltimasAlteracoes
          reloadKey={
            reloadKey
          }
          user={
            user
          }
          somenteProprio={
            usuarioRestrito
          }
        />
      </section>

      <PolicialViewModal
        policial={
          policialVisualizando
        }
        fotos={
          fotosModal
        }
        user={
          user
        }
        somenteProprio={
          usuarioRestrito
        }
        onClose={() => {
          setPolicialVisualizando(
            null
          )

          setFotosModal(
            []
          )
        }}
        onPrintFicha={
          handlePrintFicha
        }
        onPrintCredencial={
          handlePrintCredencial
        }
      />

      {podePesquisar && (
        <QrScanner
          open={
            scannerAberto
          }
          onRead={
            handleQrRead
          }
          onClose={() =>
            setScannerAberto(
              false
            )
          }
        />
      )}
    </main>
  )
}