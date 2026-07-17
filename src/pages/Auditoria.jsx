import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarUltimasAuditorias
} from '../services/auditoriaService'

import './auditoria.css'

function formatarDataHora(dataHora) {
  if (!dataHora) return '—'

  const data = new Date(dataHora)

  if (Number.isNaN(data.getTime())) {
    return '—'
  }

  return data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  })
}

function normalizarBusca(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function obterClasseSeveridade(severidade) {
  const valor = normalizarBusca(severidade)

  if (
    valor.includes('critic') ||
    valor.includes('grave')
  ) {
    return 'auditoria-badge--critico'
  }

  if (
    valor.includes('alert') ||
    valor.includes('atenc') ||
    valor.includes('medio')
  ) {
    return 'auditoria-badge--alerta'
  }

  if (
    valor.includes('sucesso') ||
    valor.includes('concluido')
  ) {
    return 'auditoria-badge--sucesso'
  }

  return 'auditoria-badge--informativo'
}

function obterClasseAcao(acao) {
  const valor = normalizarBusca(acao)

  if (
    valor.includes('reprov') ||
    valor.includes('exclu') ||
    valor.includes('erro')
  ) {
    return 'auditoria-acao--negativa'
  }

  if (
    valor.includes('aprov') ||
    valor.includes('criad') ||
    valor.includes('login')
  ) {
    return 'auditoria-acao--positiva'
  }

  if (
    valor.includes('logout') ||
    valor.includes('alter') ||
    valor.includes('solicit')
  ) {
    return 'auditoria-acao--atencao'
  }

  return 'auditoria-acao--neutra'
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
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)

  async function carregarAuditoria() {
    try {
      setLoading(true)
      setErro('')

      const dados = await listarUltimasAuditorias({
        limite: 50
      })

      const ordenados = [...(dados || [])].sort((a, b) => {
        const dataA = new Date(a.data_hora || 0).getTime()
        const dataB = new Date(b.data_hora || 0).getTime()

        return dataB - dataA
      })

      setRegistros(ordenados)
      setUltimaAtualizacao(new Date())
    } catch (error) {
      console.error(
        'Erro ao carregar auditoria:',
        error
      )

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

  const acoes = useMemo(() => {
    return [
      ...new Set(
        registros
          .map((registro) => registro.acao)
          .filter(Boolean)
      )
    ].sort()
  }, [registros])

  const modulos = useMemo(() => {
    return [
      ...new Set(
        registros
          .map((registro) => registro.modulo)
          .filter(Boolean)
      )
    ].sort()
  }, [registros])

  const perfis = useMemo(() => {
    return [
      ...new Set(
        registros
          .map(
            (registro) =>
              registro.ator_perfil ||
              registro.perfil
          )
          .filter(Boolean)
      )
    ].sort()
  }, [registros])

  const severidades = useMemo(() => {
    return [
      ...new Set(
        registros
          .map((registro) => registro.severidade)
          .filter(Boolean)
      )
    ].sort()
  }, [registros])

  const registrosFiltrados = useMemo(() => {
    const busca = normalizarBusca(pesquisa)

    return registros.filter((registro) => {
      const perfil =
        registro.ator_perfil ||
        registro.perfil ||
        ''

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
        ].some((campo) =>
          normalizarBusca(campo).includes(busca)
        )

      const correspondeAcao =
        !filtroAcao ||
        registro.acao === filtroAcao

      const correspondeModulo =
        !filtroModulo ||
        registro.modulo === filtroModulo

      const correspondePerfil =
        !filtroPerfil ||
        perfil === filtroPerfil

      const correspondeSeveridade =
        !filtroSeveridade ||
        registro.severidade === filtroSeveridade

      return (
        correspondePesquisa &&
        correspondeAcao &&
        correspondeModulo &&
        correspondePerfil &&
        correspondeSeveridade
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

    const registrosHoje = registros.filter(
      (registro) => {
        const horario = new Date(
          registro.data_hora
        ).getTime()

        return (
          !Number.isNaN(horario) &&
          horario >= inicioHoje
        )
      }
    ).length

    const registrosCriticos = registros.filter(
      (registro) => {
        const severidade = normalizarBusca(
          registro.severidade
        )

        return (
          severidade.includes('critic') ||
          severidade.includes('grave')
        )
      }
    ).length

    const atores = new Set(
      registros
        .map(
          (registro) =>
            registro.ator_id ||
            registro.ator_nome
        )
        .filter(Boolean)
    ).size

    return {
      total: registros.length,
      hoje: registrosHoje,
      criticos: registrosCriticos,
      atores
    }
  }, [registros])

  function limparFiltros() {
    setPesquisa('')
    setFiltroAcao('')
    setFiltroModulo('')
    setFiltroPerfil('')
    setFiltroSeveridade('')
  }

  function escaparCsv(valor) {
    const texto = String(valor ?? '')

    return `"${texto.replace(/"/g, '""')}"`
  }

  function exportarCsv() {
    const cabecalho = [
      'Data e hora',
      'Ação',
      'Descrição',
      'Usuário',
      'RE',
      'Perfil',
      'Módulo',
      'Severidade'
    ]

    const linhas = registrosFiltrados.map(
      (registro) => [
        formatarDataHora(registro.data_hora),
        registro.acao,
        registro.descricao,
        registro.ator_nome,
        registro.ator_re,
        registro.ator_perfil || registro.perfil,
        registro.modulo,
        registro.severidade
      ]
    )

    const conteudo = [
      cabecalho,
      ...linhas
    ]
      .map((linha) =>
        linha.map(escaparCsv).join(';')
      )
      .join('\n')

    const blob = new Blob(
      [`\uFEFF${conteudo}`],
      {
        type: 'text/csv;charset=utf-8;'
      }
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dataArquivo = new Date()
      .toISOString()
      .slice(0, 10)

    link.href = url
    link.download =
      `auditoria-sigmo-${dataArquivo}.csv`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="auditoria-page">
      <header className="auditoria-header">
        <div>
          <span className="auditoria-kicker">
            SIGMO
          </span>

          <h1>Auditoria</h1>

          <p>
            Consulte os registros de acesso,
            movimentações e alterações realizadas
            no sistema.
          </p>
        </div>

        <button
          type="button"
          className="auditoria-button auditoria-button--primary"
          onClick={carregarAuditoria}
          disabled={loading}
        >
          {loading
            ? 'Atualizando...'
            : 'Atualizar registros'}
        </button>
      </header>

      <div className="auditoria-resumo">
        <article className="auditoria-resumo-card">
          <span>Registros carregados</span>
          <strong>{resumo.total}</strong>
          <small>Últimos eventos do sistema</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Eventos de hoje</span>
          <strong>{resumo.hoje}</strong>
          <small>Registros desde 00h</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Eventos críticos</span>
          <strong>{resumo.criticos}</strong>
          <small>Requerem atenção</small>
        </article>

        <article className="auditoria-resumo-card">
          <span>Usuários envolvidos</span>
          <strong>{resumo.atores}</strong>
          <small>Atores distintos</small>
        </article>
      </div>

      <section className="auditoria-filtros">
        <div className="auditoria-filtro auditoria-filtro--pesquisa">
          <label htmlFor="auditoria-pesquisa">
            Pesquisa
          </label>

          <input
            id="auditoria-pesquisa"
            type="text"
            placeholder="Ação, usuário, RE, descrição..."
            value={pesquisa}
            onChange={(event) =>
              setPesquisa(event.target.value)
            }
          />
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-acao">
            Ação
          </label>

          <select
            id="auditoria-acao"
            value={filtroAcao}
            onChange={(event) =>
              setFiltroAcao(event.target.value)
            }
          >
            <option value="">
              Todas as ações
            </option>

            {acoes.map((acao) => (
              <option
                key={acao}
                value={acao}
              >
                {acao}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-modulo">
            Módulo
          </label>

          <select
            id="auditoria-modulo"
            value={filtroModulo}
            onChange={(event) =>
              setFiltroModulo(event.target.value)
            }
          >
            <option value="">
              Todos os módulos
            </option>

            {modulos.map((modulo) => (
              <option
                key={modulo}
                value={modulo}
              >
                {modulo}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-perfil">
            Perfil
          </label>

          <select
            id="auditoria-perfil"
            value={filtroPerfil}
            onChange={(event) =>
              setFiltroPerfil(event.target.value)
            }
          >
            <option value="">
              Todos os perfis
            </option>

            {perfis.map((perfil) => (
              <option
                key={perfil}
                value={perfil}
              >
                {perfil}
              </option>
            ))}
          </select>
        </div>

        <div className="auditoria-filtro">
          <label htmlFor="auditoria-severidade">
            Severidade
          </label>

          <select
            id="auditoria-severidade"
            value={filtroSeveridade}
            onChange={(event) =>
              setFiltroSeveridade(
                event.target.value
              )
            }
          >
            <option value="">
              Todas as severidades
            </option>

            {severidades.map((severidade) => (
              <option
                key={severidade}
                value={severidade}
              >
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
      </section>

      <div className="auditoria-resultados">
        <strong>{registrosFiltrados.length}</strong>
        <span>
          de {registros.length} registros
        </span>
      </div>

      {erro && (
        <div className="auditoria-feedback auditoria-feedback--erro">
          <strong>Falha ao carregar auditoria</strong>
          <span>{erro}</span>

          <button
            type="button"
            className="auditoria-button auditoria-button--secondary"
            onClick={carregarAuditoria}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!erro && loading && (
        <div className="auditoria-feedback">
          <strong>Carregando registros...</strong>
          <span>
            Aguarde enquanto os dados são consultados.
          </span>
        </div>
      )}

      {!erro &&
        !loading &&
        registrosFiltrados.length === 0 && (
          <div className="auditoria-feedback">
            <strong>Nenhum registro encontrado</strong>
            <span>
              Ajuste os filtros ou atualize os registros.
            </span>
          </div>
        )}

      {!erro &&
        !loading &&
        registrosFiltrados.length > 0 && (
          <div className="auditoria-table-card">
            <div className="auditoria-table-wrapper">
              <table className="auditoria-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Ação</th>
                    <th>Descrição</th>
                    <th>Usuário</th>
                    <th>RE</th>
                    <th>Perfil</th>
                    <th>Módulo</th>
                    <th>Severidade</th>
                  </tr>
                </thead>

                <tbody>
                  {registrosFiltrados.map(
                    (registro, index) => (
                      <tr
                        key={
                          registro.id ||
                          `${registro.data_hora}-${index}`
                        }
                      >
                        <td
                          data-label="Data/Hora"
                          className="auditoria-data"
                        >
                          {formatarDataHora(
                            registro.data_hora
                          )}
                        </td>

                        <td data-label="Ação">
                          <span
                            className={`auditoria-acao ${obterClasseAcao(
                              registro.acao
                            )}`}
                          >
                            {registro.acao || '—'}
                          </span>
                        </td>

                        <td
                          data-label="Descrição"
                          className="auditoria-descricao"
                        >
                          {registro.descricao || '—'}
                        </td>

                        <td data-label="Usuário">
                          <span className="auditoria-ator">
                            {registro.ator_nome || '—'}
                          </span>
                        </td>

                        <td
                          data-label="RE"
                          className="auditoria-re"
                        >
                          {registro.ator_re || '—'}
                        </td>

                        <td data-label="Perfil">
                          {registro.ator_perfil ||
                            registro.perfil ||
                            '—'}
                        </td>

                        <td data-label="Módulo">
                          {registro.modulo || '—'}
                        </td>

                        <td data-label="Severidade">
                          <span
                            className={`auditoria-badge ${obterClasseSeveridade(
                              registro.severidade
                            )}`}
                          >
                            {registro.severidade ||
                              'Informativo'}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <div className="auditoria-resultados">
        <span>
          Última atualização:{' '}
          <strong>
            {ultimaAtualizacao
              ? formatarDataHora(
                  ultimaAtualizacao
                )
              : '—'}
          </strong>
        </span>

        <button
          type="button"
          className="auditoria-button auditoria-button--secondary"
          onClick={exportarCsv}
          disabled={
            loading ||
            registrosFiltrados.length === 0
          }
        >
          Exportar CSV
        </button>
      </div>
    </section>
  )
}
