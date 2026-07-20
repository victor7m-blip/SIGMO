import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  listarUltimasAuditorias
} from '../services/auditoriaService'

import './auditoria.css'

import SigmoHorizontalScroll from '../components/SigmoHorizontalScroll/SigmoHorizontalScroll'

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

function formatarTexto(valor) {
  if (!valor) return '—'

  return String(valor)
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letra) =>
      letra.toUpperCase()
    )
}

function formatarAcao(acao) {
  const acoesConhecidas = {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    CADASTRAR_POLICIAL: 'Cadastro de policial',
    ATUALIZAR_POLICIAL: 'Atualização de policial',
    EXCLUIR_POLICIAL: 'Exclusão de policial',
    CADASTRAR_ARMA: 'Cadastro de arma',
    ATUALIZAR_ARMA: 'Atualização de arma',
    EXCLUIR_ARMA: 'Exclusão de arma',
    SOLICITACAO_CRIADA: 'Solicitação criada',
    SOLICITACAO_APROVADA: 'Solicitação aprovada',
    SOLICITACAO_REPROVADA: 'Solicitação reprovada',
    TENTATIVA_CADASTRO_COMANDANTE:
      'Tentativa de cadastro de Comandante'
  }

  return (
    acoesConhecidas[acao] ||
    formatarTexto(acao)
  )
}

function obterDescricaoResumida(registro) {
  const descricao = registro?.descricao

  if (!descricao) {
    return 'Registro sem descrição.'
  }

  if (typeof descricao === 'string') {
    const texto = descricao.trim()

    if (
      texto.startsWith('{') ||
      texto.startsWith('[')
    ) {
      try {
        const objeto = JSON.parse(texto)

        return (
          objeto.descricao ||
          objeto.mensagem ||
          objeto.message ||
          objeto.acao ||
          objeto.ACTION ||
          'Informações técnicas registradas.'
        )
      } catch {
        return texto
      }
    }

    return texto
  }

  if (typeof descricao === 'object') {
    return (
      descricao.descricao ||
      descricao.mensagem ||
      descricao.message ||
      descricao.acao ||
      descricao.ACTION ||
      'Informações técnicas registradas.'
    )
  }

  return String(descricao)
}

function obterDetalhesTecnicos(registro) {
  if (!registro) return '—'

  try {
    return JSON.stringify(registro, null, 2)
  } catch {
    return String(registro)
  }
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
    valor.includes('medio') ||
    valor.includes('importante')
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
    valor.includes('erro') ||
    valor.includes('tentativa')
  ) {
    return 'auditoria-acao--negativa'
  }

  if (
    valor.includes('aprov') ||
    valor.includes('criad') ||
    valor.includes('login') ||
    valor.includes('cadastr')
  ) {
    return 'auditoria-acao--positiva'
  }

  if (
    valor.includes('logout') ||
    valor.includes('alter') ||
    valor.includes('solicit') ||
    valor.includes('atualiz')
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
  const [filtroSeveridade, setFiltroSeveridade] =
    useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] =
    useState(null)
  const [registroSelecionado, setRegistroSelecionado] =
    useState(null)

  const scrollSuperiorRef = useRef(null)
  const scrollTabelaRef = useRef(null)
  const sincronizandoScrollRef = useRef(false)

  async function carregarAuditoria() {
    try {
      setLoading(true)
      setErro('')

      const dados = await listarUltimasAuditorias({
        limite: 50
      })

      const ordenados = [...(dados || [])].sort(
        (a, b) => {
          const dataA = new Date(
            a.data_hora ||
            a.created_at ||
            0
          ).getTime()

          const dataB = new Date(
            b.data_hora ||
            b.created_at ||
            0
          ).getTime()

          return dataB - dataA
        }
      )

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

  function sincronizarScrollSuperior(event) {
    if (
      sincronizandoScrollRef.current ||
      !scrollTabelaRef.current
    ) {
      return
    }

    sincronizandoScrollRef.current = true

    scrollTabelaRef.current.scrollLeft =
      event.currentTarget.scrollLeft

    requestAnimationFrame(() => {
      sincronizandoScrollRef.current = false
    })
  }

  function sincronizarScrollTabela(event) {
    if (
      sincronizandoScrollRef.current ||
      !scrollSuperiorRef.current
    ) {
      return
    }

    sincronizandoScrollRef.current = true

    scrollSuperiorRef.current.scrollLeft =
      event.currentTarget.scrollLeft

    requestAnimationFrame(() => {
      sincronizandoScrollRef.current = false
    })
  }

  function abrirDetalhes(registro) {
    setRegistroSelecionado(registro)
  }

  function fecharDetalhes() {
    setRegistroSelecionado(null)
  }

  useEffect(() => {
    carregarAuditoria()
  }, [])

  useEffect(() => {
    function fecharComEscape(event) {
      if (event.key === 'Escape') {
        fecharDetalhes()
      }
    }

    window.addEventListener(
      'keydown',
      fecharComEscape
    )

    return () => {
      window.removeEventListener(
        'keydown',
        fecharComEscape
      )
    }
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
          .map(
            (registro) =>
              registro.severidade
          )
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

      const descricao =
        obterDescricaoResumida(registro)

      const correspondePesquisa =
        !busca ||
        [
          registro.acao,
          formatarAcao(registro.acao),
          descricao,
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
        registro.severidade ===
          filtroSeveridade

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
          registro.data_hora ||
          registro.created_at ||
          0
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
            registro.ator_nome ||
            registro.usuario_id
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
      'Código da ação',
      'Descrição',
      'Usuário',
      'RE',
      'Perfil',
      'Módulo',
      'Severidade'
    ]

    const linhas = registrosFiltrados.map(
      (registro) => [
        formatarDataHora(
          registro.data_hora ||
          registro.created_at
        ),
        formatarAcao(registro.acao),
        registro.acao,
        obterDescricaoResumida(registro),
        registro.ator_nome,
        registro.ator_re,
        registro.ator_perfil ||
          registro.perfil,
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
                {formatarAcao(acao)}
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

  
  <div
    className="auditoria-table-wrapper"
    ref={scrollTabelaRef}
    onScroll={sincronizarScrollTabela}
  >
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
          <th>Detalhes</th>
        </tr>
      </thead>

            <tbody>
        {registrosFiltrados.map(
          (registro, index) => {
            const descricaoResumida =
              obterDescricaoResumida(registro)

            const dataHora =
              registro.data_hora ||
              registro.created_at

            return (
              <tr
                key={
                  registro.id ||
                  `${dataHora}-${index}`
                }
              >
                <td
                  data-label="Data/Hora"
                  className="auditoria-data"
                >
                  {formatarDataHora(dataHora)}
                </td>

                <td data-label="Ação">
                  <span
                    className={`auditoria-acao ${obterClasseAcao(
                      registro.acao
                    )}`}
                    title={registro.acao || ''}
                  >
                    {formatarAcao(registro.acao)}
                  </span>
                </td>

                <td
                  data-label="Descrição"
                  className="auditoria-descricao"
                  title={descricaoResumida}
                >
                  <span className="auditoria-descricao-texto">
                    {descricaoResumida}
                  </span>
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
                  {formatarTexto(
                    registro.ator_perfil ||
                    registro.perfil
                  )}
                </td>

                <td data-label="Módulo">
                  {formatarTexto(
                    registro.modulo
                  )}
                </td>

                <td data-label="Severidade">
                  <span
                    className={`auditoria-badge ${obterClasseSeveridade(
                      registro.severidade
                    )}`}
                  >
                    {formatarTexto(
                      registro.severidade ||
                      'Informativo'
                    )}
                  </span>
                </td>

                <td
                  data-label="Detalhes"
                  className="auditoria-detalhes-coluna"
                >
                  <button
                    type="button"
                    className="auditoria-button auditoria-button--details"
                    onClick={() =>
                      abrirDetalhes(registro)
                    }
                  >
                    Ver
                  </button>
                </td>
              </tr>
            )
          }
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

{registroSelecionado && (
  <div
    className="auditoria-modal-backdrop"
    onClick={fecharDetalhes}
  >
    <div
      className="auditoria-modal"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <header className="auditoria-modal-header">
        <h2>Detalhes da Auditoria</h2>

        <button
          type="button"
          className="auditoria-modal-close"
          onClick={fecharDetalhes}
          aria-label="Fechar detalhes"
        >
          ✕
        </button>
      </header>

      <div className="auditoria-modal-body">
        <div className="auditoria-modal-grid">
          <div>
            <strong>Data/Hora</strong>

            <p>
              {formatarDataHora(
                registroSelecionado.data_hora ||
                registroSelecionado.created_at
              )}
            </p>
          </div>

          <div>
            <strong>Ação</strong>

            <p>
              {formatarAcao(
                registroSelecionado.acao
              )}
            </p>
          </div>

          <div>
            <strong>Usuário</strong>

            <p>
              {registroSelecionado.ator_nome ||
                '—'}
            </p>
          </div>

          <div>
            <strong>RE</strong>

            <p>
              {registroSelecionado.ator_re ||
                '—'}
            </p>
          </div>

          <div>
            <strong>Perfil</strong>

            <p>
              {formatarTexto(
                registroSelecionado.ator_perfil ||
                registroSelecionado.perfil
              )}
            </p>
          </div>

          <div>
            <strong>Módulo</strong>

            <p>
              {formatarTexto(
                registroSelecionado.modulo
              )}
            </p>
          </div>

          <div>
            <strong>Severidade</strong>

            <p>
              {formatarTexto(
                registroSelecionado.severidade ||
                'Informativo'
              )}
            </p>
          </div>
        </div>

        <h3>Descrição</h3>

        <p>
          {obterDescricaoResumida(
            registroSelecionado
          )}
        </p>

        <h3>Registro técnico</h3>

               <pre className="auditoria-json">
          {obterDetalhesTecnicos(
            registroSelecionado
          )}
        </pre>
      </div>
    </div>
  </div>
)}

<SigmoHorizontalScroll
  targetRef={scrollTabelaRef}
/>

    </section>
  )
}