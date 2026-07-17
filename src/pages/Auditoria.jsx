import { useEffect, useMemo, useState } from 'react'
import { listarUltimasAuditorias } from '../services/auditoriaService'
import './auditoria.css'

const ITENS_POR_PAGINA = 20

function normalizarBusca(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatarDataHora(dataHora) {
  if (!dataHora) return '—'
  const data = new Date(dataHora)
  if (Number.isNaN(data.getTime())) return '—'

  return data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  })
}

function obterClasseSeveridade(severidade) {
  const valor = normalizarBusca(severidade)

  if (valor.includes('critic') || valor.includes('grave')) {
    return 'auditoria-badge--critico'
  }

  if (
    valor.includes('alert') ||
    valor.includes('atenc') ||
    valor.includes('medio')
  ) {
    return 'auditoria-badge--alerta'
  }

  if (valor.includes('sucesso') || valor.includes('concluido')) {
    return 'auditoria-badge--sucesso'
  }

  return 'auditoria-badge--informativo'
}

function obterClasseAcao(acao) {
  const valor = normalizarBusca(acao)

  if (
    valor.includes('reprov') ||
    valor.includes('exclu') ||
    valor.includes('erro') ||
    valor.includes('falha')
  ) {
    return 'auditoria-acao--negativa'
  }

  if (
    valor.includes('aprov') ||
    valor.includes('criad') ||
    valor.includes('login') ||
    valor.includes('receb')
  ) {
    return 'auditoria-acao--positiva'
  }

  if (
    valor.includes('logout') ||
    valor.includes('alter') ||
    valor.includes('solicit') ||
    valor.includes('transfer')
  ) {
    return 'auditoria-acao--atencao'
  }

  return 'auditoria-acao--neutra'
}

function escaparCsv(valor) {
  const texto = String(valor ?? '')
  return `"${texto.replace(/"/g, '""')}"`
}

function baixarCsv(registros) {
  const cabecalho = [
    'Data e hora',
    'Ação',
    'Ator',
    'RE',
    'Perfil',
    'Módulo',
    'Severidade',
    'Descrição'
  ]

  const linhas = registros.map((registro) => [
    formatarDataHora(registro.data_hora),
    registro.acao,
    registro.ator_nome,
    registro.ator_re,
    registro.ator_perfil || registro.perfil,
    registro.modulo,
    registro.severidade,
    registro.descricao
  ])

  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(escaparCsv).join(';'))
    .join('\n')

  const blob = new Blob([`\uFEFF${conteudo}`], {
    type: 'text/csv;charset=utf-8;'
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const agora = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

  link.href = url
  link.download = `sigmo-auditoria-${agora}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [filtroSeveridade, setFiltroSeveridade] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)

  async function carregarAuditoria() {
    try {
      setLoading(true)
      setErro('')

      const dados = await listarUltimasAuditorias({ limite: 500 })
      setRegistros(dados || [])
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error)
      setErro(
        error?.message ||
          'Não foi possível carregar os registros de auditoria.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAuditoria()
  }, [])

  useEffect(() => {
    setPaginaAtual(1)
  }, [
    pesquisa,
    filtroAcao,
    filtroModulo,
    filtroPerfil,
    filtroSeveridade
  ])

  const acoes = useMemo(
    () =>
      [...new Set(registros.map((registro) => registro.acao).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [registros]
  )

  const modulos = useMemo(
    () =>
      [...new Set(registros.map((registro) => registro.modulo).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [registros]
  )

  const perfis = useMemo(
    () =>
      [
        ...new Set(
          registros
            .map((registro) => registro.ator_perfil || registro.perfil)
            .filter(Boolean)
        )
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [registros]
  )

  const severidades = useMemo(
    () =>
      [
        ...new Set(
          registros.map((registro) => registro.severidade).filter(Boolean)
        )
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [registros]
  )

  const registrosFiltrados = useMemo(() => {
    const busca = normalizarBusca(pesquisa)

    return registros.filter((registro) => {
      const perfil = registro.ator_perfil || registro.perfil || ''

      const correspondePesquisa =
        !busca ||
        [
          registro.acao,
          registro.descricao,
          registro.ator_nome,
          registro.ator_re,
          perfil,
          registro.modulo,
          registro.severidade
        ].some((campo) => normalizarBusca(campo).includes(busca))

      return (
        correspondePesquisa &&
        (!filtroAcao || registro.acao === filtroAcao) &&
        (!filtroModulo || registro.modulo === filtroModulo) &&
        (!filtroPerfil || perfil === filtroPerfil) &&
        (!filtroSeveridade || registro.severidade === filtroSeveridade)
      )
    })
  }, [
    registros,
    pesquisa,
    filtroAcao,
    filtroModulo,
    filtroPerfil,
    filtroSeveridade
  ])

  const resumo = useMemo(() => {
    const agora = new Date()
    const inicioHoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate()
    ).getTime()

    const hoje = registros.filter((registro) => {
      const horario = new Date(registro.data_hora).getTime()
      return !Number.isNaN(horario) && horario >= inicioHoje
    }).length

    const criticos = registros.filter((registro) => {
      const severidade = normalizarBusca(registro.severidade)
      return severidade.includes('critic') || severidade.includes('grave')
    }).length

    const logins = registros.filter((registro) =>
      normalizarBusca(registro.acao).includes('login')
    ).length

    const atores = new Set(
      registros
        .map((registro) => registro.ator_id || registro.ator_re || registro.ator_nome)
        .filter(Boolean)
    ).size

    return {
      total: registros.length,
      hoje,
      criticos,
      logins,
      atores
    }
  }, [registros])

  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosFiltrados.length / ITENS_POR_PAGINA)
  )

  const registrosPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return registrosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [registrosFiltrados, paginaAtual])

  function limparFiltros() {
    setPesquisa('')
    setFiltroAcao('')
    setFiltroModulo('')
    setFiltroPerfil('')
    setFiltroSeveridade('')
  }

  function exportarCsv() {
    if (registrosFiltrados.length > 0) {
      baixarCsv(registrosFiltrados)
    }
  }

  return (
    <section className="auditoria-page">
      <header className="auditoria-header">
        <div>
          <span className="auditoria-kicker">SIGMO</span>
          <h1>Auditoria</h1>
          <p>
            Consulte acessos, movimentações e alterações realizadas no sistema.
          </p>
        </div>

        <div className="auditoria-header-actions">
          <button
            type="button"
            className="auditoria-button auditoria-button--secondary auditoria-button--header"
            onClick={exportarCsv}
            disabled={loading || registrosFiltrados.length === 0}
          >
            Exportar CSV
          </button>

          <button
            type="button"
            className="auditoria-button auditoria-button--primary"
            onClick={carregarAuditoria}
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar registros'}
          </button>
        </div>
      </header>

      <div className="auditoria-resumo">
        <article className="auditoria-resumo-card">
          <span>Registros carregados</span>
          <strong>{resumo.total}</strong>
          <small>Últimos eventos consultados</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Registros de hoje</span>
          <strong>{resumo.hoje}</strong>
          <small>Eventos realizados hoje</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Logins registrados</span>
          <strong>{resumo.logins}</strong>
          <small>Acessos entre os eventos carregados</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Eventos críticos</span>
          <strong>{resumo.criticos}</strong>
          <small>Ocorrências críticas ou graves</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Atores identificados</span>
          <strong>{resumo.atores}</strong>
          <small>Usuários distintos identificados</small>
        </article>
      </div>

      <div className="auditoria-filtros">
        <div className="auditoria-filtro auditoria-filtro--pesquisa">
          <label htmlFor="auditoria-pesquisa">Pesquisar</label>
          <input
            id="auditoria-pesquisa"
            type="search"
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
            placeholder="Ator, RE, descrição, ação..."
          />
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-acao">Ação</label>
          <select
            id="auditoria-acao"
            value={filtroAcao}
            onChange={(event) => setFiltroAcao(event.target.value)}
          >
            <option value="">Todas</option>
            {acoes.map((acao) => (
              <option key={acao} value={acao}>
                {acao}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-modulo">Módulo</label>
          <select
            id="auditoria-modulo"
            value={filtroModulo}
            onChange={(event) => setFiltroModulo(event.target.value)}
          >
            <option value="">Todos</option>
            {modulos.map((modulo) => (
              <option key={modulo} value={modulo}>
                {modulo}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-perfil">Perfil</label>
          <select
            id="auditoria-perfil"
            value={filtroPerfil}
            onChange={(event) => setFiltroPerfil(event.target.value)}
          >
            <option value="">Todos</option>
            {perfis.map((perfil) => (
              <option key={perfil} value={perfil}>
                {perfil}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-severidade">Severidade</label>
          <select
            id="auditoria-severidade"
            value={filtroSeveridade}
            onChange={(event) => setFiltroSeveridade(event.target.value)}
          >
            <option value="">Todas</option>
            {severidades.map((severidade) => (
              <option key={severidade} value={severidade}>
                {severidade}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro-acao">
          <button
            type="button"
            className="auditoria-button auditoria-button--secondary"
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="auditoria-resultados">
        <div>
          <strong>{registrosFiltrados.length}</strong>{' '}
          <span>
            {registrosFiltrados.length === 1
              ? 'registro encontrado'
              : 'registros encontrados'}
          </span>
        </div>

        {registrosFiltrados.length > 0 && (
          <span>
            Página {paginaAtual} de {totalPaginas}
          </span>
        )}
      </div>

      {erro && (
        <div className="auditoria-feedback auditoria-feedback--erro">
          <strong>Erro ao carregar auditoria</strong>
          <span>{erro}</span>
        </div>
      )}

      {!erro && loading && (
        <div className="auditoria-feedback">
          <strong>Carregando registros...</strong>
          <span>Aguarde enquanto os eventos são consultados.</span>
        </div>
      )}

      {!erro && !loading && registrosFiltrados.length === 0 && (
        <div className="auditoria-feedback">
          <strong>Nenhum registro encontrado</strong>
          <span>Altere ou remova os filtros utilizados.</span>
        </div>
      )}

      {!erro && !loading && registrosFiltrados.length > 0 && (
        <>
          <div className="auditoria-table-card">
            <div className="auditoria-table-wrapper">
              <table className="auditoria-table">
                <thead>
                  <tr>
                    <th>Data e hora</th>
                    <th>Ação</th>
                    <th>Ator</th>
                    <th>RE</th>
                    <th>Perfil</th>
                    <th>Módulo</th>
                    <th>Severidade</th>
                    <th>Descrição</th>
                  </tr>
                </thead>

                <tbody>
                  {registrosPagina.map((registro) => {
                    const perfil =
                      registro.ator_perfil ||
                      registro.perfil ||
                      'Não identificado'

                    return (
                      <tr key={registro.id}>
                        <td data-label="Data e hora" className="auditoria-data">
                          {formatarDataHora(registro.data_hora)}
                        </td>

                        <td data-label="Ação">
                          <span
                            className={`auditoria-acao ${obterClasseAcao(
                              registro.acao
                            )}`}
                          >
                            {registro.acao || 'EVENTO'}
                          </span>
                        </td>

                        <td data-label="Ator">
                          <strong className="auditoria-ator">
                            {registro.ator_nome || 'Não identificado'}
                          </strong>
                        </td>

                        <td data-label="RE">
                          <span className="auditoria-re">
                            {registro.ator_re || '—'}
                          </span>
                        </td>

                        <td data-label="Perfil">{perfil}</td>
                        <td data-label="Módulo">{registro.modulo || 'Sistema'}</td>

                        <td data-label="Severidade">
                          <span
                            className={`auditoria-badge ${obterClasseSeveridade(
                              registro.severidade
                            )}`}
                          >
                            {registro.severidade || 'Informativo'}
                          </span>
                        </td>

                        <td data-label="Descrição" className="auditoria-descricao">
                          {registro.descricao ||
                            'Evento registrado no sistema.'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPaginas > 1 && (
            <nav className="auditoria-paginacao" aria-label="Paginação da auditoria">
              <button
                type="button"
                onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaAtual === 1}
              >
                Anterior
              </button>

              <span>
                {paginaAtual} / {totalPaginas}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1))
                }
                disabled={paginaAtual === totalPaginas}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
