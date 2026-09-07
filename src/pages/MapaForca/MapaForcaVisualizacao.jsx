import './MapaForcaVisualizacao.css'

const ORDEM_HIERARQUICA = [
  'comando-cia',
  'cgp',
  'servico-dia',
  'radio-patrulhamento',
  'ronda-escolar',
  'base-comunitaria',
  'pop',
  'rpm'
]

const ICONE_GRUPO = {
  'comando-cia': '★',
  cgp: '🚓',
  'servico-dia': '☀',
  'radio-patrulhamento': '🚓',
  'ronda-escolar': '▣',
  'base-comunitaria': '⌂',
  pop: '♟',
  rpm: '◆'
}

function normalizar(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nomePolicial(policial) {
  return policial?.nome_guerra || policial?.nome || 'NÃO DEFINIDO'
}

function identificacaoPolicial(policial) {
  if (!policial) return ''
  return [policial.posto_graduacao, policial.re]
    .filter(Boolean)
    .join(' ')
}

function tipoEquipamento(item) {
  const texto = normalizar([
    item?.tipo,
    item?.tipo_patrimonio,
    item?.categoria,
    item?.especie,
    item?.descricao
  ].filter(Boolean).join(' '))

  if (texto.includes('CASSETETE')) return 'CASSETETE'
  if (texto.includes('TONFA')) return 'TONFA'
  if (texto.includes('TASER')) return 'TASER'
  if (texto.includes('TPD')) return 'TPD'
  if (texto.includes('HT') || texto.includes('RADIO')) return 'HT'
  if (
    texto.includes('ARMA') ||
    texto.includes('PISTOLA') ||
    texto.includes('REVOLVER') ||
    texto.includes('FUZIL') ||
    texto.includes('CARABINA')
  ) return 'ARMA'

  return normalizar(item?.tipo || item?.tipo_patrimonio || 'EQUIPAMENTO')
}

function identificacaoEquipamento(item) {
  const tipo = tipoEquipamento(item)

  const candidatos = [
    item?.patrimonio,
    item?.numero_patrimonio,
    item?.numero_serie,
    item?.serie,
    item?.prefixo,
    item?.modelo
  ].filter(Boolean)

  const id = candidatos.find((valor) => {
    const texto = normalizar(valor)
    return texto && texto !== tipo
  })

  if (tipo === 'ARMA') {
    const arma = [
      item?.especie,
      item?.marca,
      item?.modelo
    ].filter(Boolean).join(' ')
    return arma || id || ''
  }

  return id || ''
}

function equipamentos(itens = []) {
  const vistos = new Set()

  return (itens || []).reduce((lista, item) => {
    const tipo = tipoEquipamento(item)
    const identificacao = identificacaoEquipamento(item)
    const chave = `${tipo}|${identificacao}`

    if (vistos.has(chave)) return lista
    vistos.add(chave)

    lista.push({ tipo, identificacao })
    return lista
  }, [])
}

function iconeEquipamento(tipo) {
  if (tipo === 'ARMA') return '▰'
  if (tipo === 'HT') return '▥'
  if (tipo === 'TASER') return '▰'
  if (tipo === 'TPD') return '▣'
  if (tipo === 'TONFA' || tipo === 'CASSETETE') return '╱'
  return '◇'
}

function hora(valor) {
  if (!valor) return '—'
  const texto = String(valor)

  if (texto.includes('T') && texto.length >= 16) {
    return texto.slice(11, 16)
  }

  const data = new Date(valor)
  return Number.isNaN(data.getTime())
    ? '—'
    : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function dataCurta(valor) {
  if (!valor) return '—'
  const texto = String(valor)

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    const [ano, mes, dia] = texto.slice(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
  }

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

function resumoMapa(salvas, materiaisPorPolicial) {
  const policiais = new Set()
  const viaturas = new Set()
  const equipamentosUnicos = new Set()
  let pops = 0

  salvas.forEach((item) => {
    Object.values(item.unidade.policiais || {}).forEach((policial) => {
      if (!policial?.id) return

      const id = String(policial.id)
      policiais.add(id)

      equipamentos(materiaisPorPolicial[id] || []).forEach((equipamento) => {
        equipamentosUnicos.add(`${id}|${equipamento.tipo}|${equipamento.identificacao}`)
      })
    })

    if (item.unidade.viatura?.id) viaturas.add(String(item.unidade.viatura.id))
    if (item.grupo.id === 'pop') pops += 1
  })

  return {
    us: salvas.length,
    policiais: policiais.size,
    viaturas: viaturas.size,
    pops,
    equipamentos: equipamentosUnicos.size
  }
}

function PolicialVisual({ funcao, policial, materiais = [], compacto = false }) {
  const listaEquipamentos = equipamentos(materiais)

  const cop =
    listaEquipamentos.find(
      (equipamento) =>
        equipamento?.tipo === 'COP'
    ) || null

  const equipamentosRestantes =
    listaEquipamentos.filter(
      (equipamento) =>
        equipamento?.tipo !== 'COP'
    )

  return (
    <article className={`mfv-policial ${compacto ? 'mfv-policial-compacto' : ''}`}>
      <div className="mfv-funcao">
        <span className="mfv-funcao-icone">♟</span>
        {funcao}
      </div>

      <div className="mfv-policial-corpo">
        <div className="mfv-foto">
          {policial?.foto_url ? (
            <img src={policial.foto_url} alt={nomePolicial(policial)} />
          ) : (
            <span aria-hidden="true">👮</span>
          )}
        </div>

        <div className="mfv-policial-dados">
          {policial ? (
            <>
              <strong className="mfv-identificacao-policial">
                {identificacaoPolicial(policial) || 'POLICIAL'}
              </strong>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minWidth: 0
                }}
              >
                {cop && (
                  <div
                    className="mfv-equipamento"
                    style={{
                      flex: '0 0 auto',
                      minWidth: '46px',
                      margin: 0
                    }}
                  >
                    <span
                      className="mfv-equipamento-icone"
                      aria-hidden="true"
                    >
                      {iconeEquipamento('COP')}
                    </span>

                    <span>
                      <b>COP</b>
                      <small>
                        {cop.identificacao || 'COP'}
                      </small>
                    </span>
                  </div>
                )}

                <strong className="mfv-nome">
                  {nomePolicial(policial)}
                </strong>
              </div>
            </>
          ) : (
            <strong className="mfv-nome">NÃO DEFINIDO</strong>
          )}

          {policial && equipamentosRestantes.length > 0 && (
            <div className="mfv-equipamentos">
              {equipamentosRestantes.map((equipamento, index) => (
                <div
                  className="mfv-equipamento"
                  key={`${policial.id}-${equipamento.tipo}-${equipamento.identificacao}-${index}`}
                >
                  <span className="mfv-equipamento-icone" aria-hidden="true">
                    {iconeEquipamento(equipamento.tipo)}
                  </span>
                  <span>
                    <b>{equipamento.tipo}</b>
                    {equipamento.identificacao && <small>{equipamento.identificacao}</small>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function UnidadeVisual({ item, materiaisPorPolicial, compacto = false }) {
  const unidade = item.unidade
  const policiais = unidade.policiais || {}
  const funcoes = unidade.campos || Object.keys(policiais)

  return (
    <article className={`mfv-us ${compacto ? 'mfv-us-compacta' : ''}`}>
      <header className="mfv-us-cabecalho">
        <div className="mfv-us-identificacao">
          {unidade.viatura?.prefixo ? (
            <span className="mfv-vtr-principal">
              {unidade.viatura.prefixo}
            </span>
          ) : (
            <span className="mfv-prefixo">{unidade.prefixo}</span>
          )}

          {unidade.viatura?.prefixo && unidade.prefixo && (
            <span className="mfv-us-tipo">{unidade.prefixo}</span>
          )}
        </div>

      </header>

      {unidade.vtrDiferenteEscala && (
        <div className="mfv-alerta-vtr">
          <b>VTR DIFERENTE DA ESCALA</b>
          <span>
            PREVISTA: <strong>{unidade.viaturaPrevista?.prefixo || 'NÃO INFORMADA'}</strong>
          </span>
          {unidade.motivoTrocaVtr && (
            <span>
              MOTIVO: <strong>{unidade.motivoTrocaVtr}</strong>
            </span>
          )}
        </div>
      )}

      <div className="mfv-efetivo">
        {funcoes.map((funcao) => (
          <PolicialVisual
            key={`${unidade.id}-${funcao}`}
            funcao={funcao}
            policial={policiais[funcao]}
            materiais={materiaisPorPolicial[String(policiais[funcao]?.id || '')] || []}
            compacto={compacto}
          />
        ))}
      </div>

      {(unidade.inicioUs || unidade.fimUs) && (
        <footer className="mfv-horario-us">
          {hora(unidade.inicioUs)} ÀS {hora(unidade.fimUs)}
        </footer>
      )}
    </article>
  )
}

export default function MapaForcaVisualizacao({
  salvas = [],
  policiaisCadastro = [],
  materiaisPorPolicial = {},
  onVoltarMontagem
}) {
  const policiaisPorId = new Map(
    (policiaisCadastro || [])
      .filter((policial) => policial?.id)
      .map((policial) => [String(policial.id), policial])
  )

  const salvasVisual = salvas.map((item) => ({
    ...item,
    unidade: {
      ...item.unidade,
      policiais: Object.fromEntries(
        Object.entries(item.unidade?.policiais || {}).map(([funcao, policial]) => {
          const cadastro = policiaisPorId.get(String(policial?.id || ''))

          return [
            funcao,
            cadastro
              ? {
                  ...policial,
                  ...cadastro,
                  foto_url: cadastro.foto_url || policial?.foto_url || null
                }
              : policial
          ]
        })
      )
    }
  }))

  const resumo = resumoMapa(salvasVisual, materiaisPorPolicial)
  const primeiraUS = salvasVisual[0]?.unidade || null

  const gruposPorId = new Map(
    salvasVisual.map((item) => [item.grupo.id, item.grupo])
  )

  const grupos = Array.from(gruposPorId.values()).sort((a, b) => {
    const posA = ORDEM_HIERARQUICA.indexOf(a.id)
    const posB = ORDEM_HIERARQUICA.indexOf(b.id)

    return (
      (posA === -1 ? ORDEM_HIERARQUICA.length : posA) -
      (posB === -1 ? ORDEM_HIERARQUICA.length : posB)
    )
  })

  return (
    <section className="mfv-root">
      <header className="mfv-topo">
        <div className="mfv-titulo">
          <h1>MAPA FORÇA</h1>
          <h2>27º BATALHÃO - 5ª CIA</h2>
          <strong>
            TURNO {hora(primeiraUS?.inicioUs)} ÀS {hora(primeiraUS?.fimUs)}
          </strong>
        </div>

        <div className="mfv-acoes">
          <div className="mfv-data">
            {dataCurta(primeiraUS?.inicioUs)}
            <span aria-hidden="true">▣</span>
          </div>

          <button type="button" className="mfv-btn-principal" onClick={onVoltarMontagem}>
            ← VOLTAR À MONTAGEM
          </button>
        </div>
      </header>

      <div className="mfv-resumo">
        {[
          ['▰', 'UNIDADES DE SERVIÇO', resumo.us],
          ['♟', 'POLICIAIS EM SERVIÇO', resumo.policiais],
          ['▰', 'VIATURAS EMPREGADAS', resumo.viaturas],
          ['♟', "POP'S ATIVOS", resumo.pops],
          ['◇', 'EQUIPAMENTOS ENTREGUES', resumo.equipamentos]
        ].map(([icone, label, valor]) => (
          <div className="mfv-resumo-card" key={label}>
            <span>{icone}</span>
            <div>
              <small>{label}</small>
              <strong>{valor}</strong>
            </div>
          </div>
        ))}
      </div>

      {salvasVisual.length === 0 ? (
        <div className="mfv-vazio">
          <strong>Nenhuma US salva.</strong>
          <span>Volte para a montagem e crie a primeira equipe.</span>
        </div>
      ) : (
        <div className="mfv-grupos">
          {grupos.map((grupo, indice) => {
            const unidadesGrupo = salvasVisual.filter(
              (item) => item.grupo.id === grupo.id
            )

            const compacto = unidadesGrupo.length >= 3

            return (
              <section className={`mfv-grupo mfv-grupo-${grupo.id}`} key={grupo.id}>
                <header
                  className="mfv-grupo-cabecalho"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                    alignItems: 'center',
                    gap: '14px'
                  }}
                >
                  <div
                    style={{
                      justifySelf: 'start'
                    }}
                  >
                    <span className="mfv-numero">{indice + 1}</span>
                    <span className="mfv-grupo-icone" aria-hidden="true">
                      {ICONE_GRUPO[grupo.id] || '◆'}
                    </span>
                    <strong>{grupo.titulo}</strong>
                  </div>

                  {(() => {
                    const viaturasEmUso = unidadesGrupo
                      .map((item) => item?.unidade?.viatura?.prefixo)
                      .filter(Boolean)

                    if (viaturasEmUso.length === 0) {
                      return <span />
                    }

                    return (
                      <div
                        style={{
                          justifySelf: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          minHeight: '30px',
                          padding: '4px 11px',
                          border: '1px solid #d7e0eb',
                          borderRadius: '6px',
                          background: '#f7f9fc',
                          color: '#12346d',
                          fontSize: '11px',
                          fontWeight: 900,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span aria-hidden="true">🚓</span>
                        <span>VIATURA EM USO:</span>
                        <strong>
                          {viaturasEmUso.join(' • ')}
                        </strong>
                      </div>
                    )
                  })()}

                  <span
                    className="mfv-grupo-status"
                    style={{
                      justifySelf: 'end'
                    }}
                  >
                    {unidadesGrupo.length > 1 ? (
                      <>{unidadesGrupo.length} UNIDADES</>
                    ) : (
                      <>
                        <i />
                        EM SERVIÇO
                      </>
                    )}
                  </span>
                </header>

                <div className={`mfv-grid ${compacto ? 'mfv-grid-compacto' : ''}`}>
                  {unidadesGrupo.map((item) => (
                    <UnidadeVisual
                      key={item.unidade.id}
                      item={item}
                      materiaisPorPolicial={materiaisPorPolicial}
                      compacto={compacto}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
