import { useEffect, useMemo, useState } from 'react'
import { listarPoliciais } from '../../services/policiaisService'
import './PagarMaterial.css'

const materiaisSimulados = [
  {
    id: 1,
    patrimonio: 'MAT-000124',
    descricao: 'COLETE BALÍSTICO NÍVEL III-A',
    categoria: 'EPI',
    local: 'RESERVA DE MATERIAL',
    status: 'DISPONÍVEL'
  },
  {
    id: 2,
    patrimonio: 'MAT-000287',
    descricao: 'RÁDIO COMUNICADOR DIGITAL',
    categoria: 'COMUNICAÇÃO',
    local: 'P4',
    status: 'DISPONÍVEL'
  },
  {
    id: 3,
    patrimonio: 'ARM-000041',
    descricao: 'PISTOLA INSTITUCIONAL',
    categoria: 'ARMAMENTO',
    local: 'ARMARIA',
    status: 'DISPONÍVEL'
  },
  {
    id: 4,
    patrimonio: 'MAT-000389',
    descricao: 'ALGEMA DE AÇO',
    categoria: 'EQUIPAMENTO',
    local: 'RESERVA DE MATERIAL',
    status: 'DISPONÍVEL'
  },
  {
    id: 5,
    patrimonio: 'MAT-000472',
    descricao: 'CAPACETE BALÍSTICO',
    categoria: 'EPI',
    local: 'RESERVA DE MATERIAL',
    status: 'MANUTENÇÃO'
  }
]

const LOCAL_DESTINO_INICIAL = 'CAUTELA INDIVIDUAL'

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
}

function maskRE(value) {
  const limpo = String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 7)

  const numeros = limpo
    .slice(0, 6)
    .replace(/\D/g, '')

  const digito = limpo.slice(6, 7)

  if (numeros.length < 6) {
    return numeros
  }

  return digito
    ? `${numeros}-${digito}`
    : `${numeros}-`
}

function obterNomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    '-'
  )
}

export default function PagarMaterial({ user }) {
  const [busca, setBusca] = useState('')
  const [recebedor, setRecebedor] = useState('')
  const [reRecebedor, setReRecebedor] = useState('')
  const [localDestino, setLocalDestino] = useState(
    LOCAL_DESTINO_INICIAL
  )
  const [observacoes, setObservacoes] = useState('')
  const [itensSelecionados, setItensSelecionados] =
    useState([])
  const [mensagem, setMensagem] = useState('')

  const [policialRecebedor, setPolicialRecebedor] =
    useState(null)

  const [buscandoRecebedor, setBuscandoRecebedor] =
    useState(false)

  const [erroRecebedor, setErroRecebedor] =
    useState('')

  const materiaisFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca)

    if (!termo) {
      return materiaisSimulados
    }

    return materiaisSimulados.filter((material) => {
      return [
        material.patrimonio,
        material.descricao,
        material.categoria,
        material.local,
        material.status
      ].some((valor) =>
        normalizarTexto(valor).includes(termo)
      )
    })
  }, [busca])

  useEffect(() => {
    const somenteCaracteres = reRecebedor.replace(
      /[^0-9A-Z]/g,
      ''
    )

    if (somenteCaracteres.length < 7) {
      setPolicialRecebedor(null)
      setRecebedor('')
      setErroRecebedor('')
      return
    }

    const timer = setTimeout(() => {
      pesquisarPolicialPorRE(reRecebedor)
    }, 450)

    return () => clearTimeout(timer)
  }, [reRecebedor])

  async function pesquisarPolicialPorRE(reInformado) {
    try {
      setBuscandoRecebedor(true)
      setErroRecebedor('')
      setPolicialRecebedor(null)
      setRecebedor('')

      const resultado = await listarPoliciais({
        filtros: {
          nome: '',
          nome_guerra: '',
          re: reInformado,
          qr_code: '',
          posto_graduacao: '',
          companhia: '',
          pelotao: '',
          situacao: ''
        },
        pagina: 1,
        limite: 10,
        sortBy: 'nome_guerra',
        sortDirection: 'asc'
      })

      const policiais = resultado?.data || []

      const reNormalizado =
        normalizarTexto(reInformado)

      const policialEncontrado =
        policiais.find(
          (policial) =>
            normalizarTexto(policial.re) ===
            reNormalizado
        ) || policiais[0]

      if (!policialEncontrado) {
        setErroRecebedor(
          'Nenhum policial encontrado com este RE.'
        )
        return
      }

      setPolicialRecebedor(policialEncontrado)
      setRecebedor(
        obterNomePolicial(policialEncontrado)
      )
    } catch (error) {
      console.error(error)

      setErroRecebedor(
        'Não foi possível consultar o policial.'
      )
    } finally {
      setBuscandoRecebedor(false)
    }
  }

  function materialSelecionado(materialId) {
    return itensSelecionados.some(
      (item) => item.id === materialId
    )
  }

  function adicionarMaterial(material) {
    if (material.status !== 'DISPONÍVEL') {
      setMensagem(
        'Este material não está disponível para entrega.'
      )
      return
    }

    if (materialSelecionado(material.id)) {
      setMensagem(
        'Este material já foi adicionado à movimentação.'
      )
      return
    }

    setItensSelecionados((listaAtual) => [
      ...listaAtual,
      material
    ])

    setMensagem('')
  }

  function removerMaterial(materialId) {
    setItensSelecionados((listaAtual) =>
      listaAtual.filter(
        (material) => material.id !== materialId
      )
    )
  }

  function limparMovimentacao() {
    setRecebedor('')
    setReRecebedor('')
    setPolicialRecebedor(null)
    setErroRecebedor('')
    setLocalDestino(LOCAL_DESTINO_INICIAL)
    setObservacoes('')
    setItensSelecionados([])
    setMensagem('')
  }

  function confirmarEntrega() {
    if (!policialRecebedor) {
      setMensagem(
        'Informe um RE válido e aguarde a localização do policial.'
      )
      return
    }

    if (!localDestino) {
      setMensagem('Informe o local de destino.')
      return
    }

    if (itensSelecionados.length === 0) {
      setMensagem(
        'Adicione pelo menos um material à movimentação.'
      )
      return
    }

    setMensagem(
      'Simulação concluída. A movimentação ainda não foi gravada no banco.'
    )
  }

  return (
    <main className="pagar-material-page">
      <header className="pagar-material-header">
        <div>
          <span className="pagar-material-kicker">
            SIGMO • MOVIMENTAÇÃO
          </span>

          <h1>Pagar Material</h1>

          <p>
            Registre a entrega de materiais, equipamentos
            ou armamentos ao policial responsável.
          </p>
        </div>

        <div className="pagar-material-operador">
          <span>Operador</span>

          <strong>
            {user?.nome ||
              user?.nome_guerra ||
              user?.email ||
              'USUÁRIO SIGMO'}
          </strong>
        </div>
      </header>

      {mensagem && (
        <div className="pagar-material-feedback">
          {mensagem}
        </div>
      )}

      <section className="pagar-material-layout">
        <div className="pagar-material-main">
          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>ETAPA 1</span>
                <h2>Dados da entrega</h2>
              </div>

              <span className="pagar-material-status">
                RASCUNHO
              </span>
            </div>

            <div className="pagar-material-form-grid">
              <label>
                Tipo de movimentação

                <select defaultValue="CAUTELA">
                  <option value="CAUTELA">
                    CAUTELA
                  </option>

                  <option value="TRANSFERÊNCIA">
                    TRANSFERÊNCIA
                  </option>

                  <option value="ENTREGA">
                    ENTREGA
                  </option>
                </select>
              </label>

              <label>
                RE do recebedor

                <div className="pagar-material-re-field">
                  <input
                    value={reRecebedor}
                    maxLength={8}
                    onChange={(event) =>
                      setReRecebedor(
                        maskRE(event.target.value)
                      )
                    }
                    placeholder="000000-A"
                    autoComplete="off"
                  />

                  {buscandoRecebedor && (
                    <span className="pagar-material-re-loading">
                      Pesquisando...
                    </span>
                  )}
                </div>

                {erroRecebedor && (
                  <small className="pagar-material-re-error">
                    {erroRecebedor}
                  </small>
                )}
              </label>

              <label>
                Recebedor

                <input
                  value={recebedor}
                  placeholder="Preenchido pelo RE"
                  readOnly
                />
              </label>

              <label>
                Local de origem

                <input
                  value="RESERVA DE MATERIAL"
                  readOnly
                />
              </label>

              <label>
                Local de destino

                <select
                  value={localDestino}
                  onChange={(event) =>
                    setLocalDestino(event.target.value)
                  }
                >
                  <option value="CAUTELA INDIVIDUAL">
                    CAUTELA INDIVIDUAL
                  </option>

                  <option value="P4">
                    P4
                  </option>

                  <option value="1ª CIA">
                    1ª CIA
                  </option>

                  <option value="2ª CIA">
                    2ª CIA
                  </option>

                  <option value="3ª CIA">
                    3ª CIA
                  </option>
                </select>
              </label>

              {policialRecebedor && (
                <div className="pagar-material-policial-card">
                  <div className="pagar-material-policial-avatar">
                    {policialRecebedor.foto_url ? (
                      <img
                        src={policialRecebedor.foto_url}
                        alt={obterNomePolicial(
                          policialRecebedor
                        )}
                      />
                    ) : (
                      <span>
                        {obterNomePolicial(
                          policialRecebedor
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="pagar-material-policial-info">
                    <span>Policial localizado</span>

                    <strong>
                      {obterNomePolicial(
                        policialRecebedor
                      )}
                    </strong>

                    <p>
                      {policialRecebedor.posto_graduacao ||
                        'POSTO NÃO INFORMADO'}

                      {' • '}

                      {policialRecebedor.companhia ||
                        'COMPANHIA NÃO INFORMADA'}

                      {policialRecebedor.pelotao
                        ? ` • ${policialRecebedor.pelotao}`
                        : ''}
                    </p>

                    <small>
                      Situação:{' '}
                      {policialRecebedor.situacao ||
                        'NÃO INFORMADA'}
                    </small>
                  </div>
                </div>
              )}

              <label className="pagar-material-field-full">
                Observações

                <textarea
                  value={observacoes}
                  onChange={(event) =>
                    setObservacoes(
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="Informações adicionais sobre a entrega"
                />
              </label>
            </div>
          </section>

          <section className="pagar-material-card">
            <div className="pagar-material-card-header">
              <div>
                <span>ETAPA 2</span>
                <h2>Selecionar materiais</h2>
              </div>

              <strong className="pagar-material-count">
                {materiaisFiltrados.length} encontrados
              </strong>
            </div>

            <div className="pagar-material-search">
              <input
                value={busca}
                onChange={(event) =>
                  setBusca(event.target.value)
                }
                placeholder="Pesquisar por patrimônio, descrição, categoria ou local"
              />

              <button type="button">
                Ler QR Code
              </button>
            </div>

            <div className="pagar-material-table-wrap">
              <table className="pagar-material-table">
                <thead>
                  <tr>
                    <th>Patrimônio</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Local</th>
                    <th>Status</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>

                <tbody>
                  {materiaisFiltrados.map((material) => {
                    const selecionado =
                      materialSelecionado(material.id)

                    return (
                      <tr key={material.id}>
                        <td>
                          <strong>
                            {material.patrimonio}
                          </strong>
                        </td>

                        <td>{material.descricao}</td>
                        <td>{material.categoria}</td>
                        <td>{material.local}</td>

                        <td>
                          <span
                            className={[
                              'pagar-material-badge',
                              material.status ===
                              'DISPONÍVEL'
                                ? 'is-success'
                                : 'is-warning'
                            ].join(' ')}
                          >
                            {material.status}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="pagar-material-add"
                            disabled={
                              selecionado ||
                              material.status !==
                                'DISPONÍVEL'
                            }
                            onClick={() =>
                              adicionarMaterial(material)
                            }
                          >
                            {selecionado
                              ? 'Adicionado'
                              : 'Adicionar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="pagar-material-summary">
          <section className="pagar-material-card pagar-material-summary-card">
            <div className="pagar-material-card-header">
              <div>
                <span>ETAPA 3</span>
                <h2>Resumo da entrega</h2>
              </div>
            </div>

            <div className="pagar-material-summary-data">
              <div>
                <span>Recebedor</span>

                <strong>
                  {recebedor || 'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>RE</span>

                <strong>
                  {reRecebedor || 'NÃO INFORMADO'}
                </strong>
              </div>

              <div>
                <span>Destino</span>

                <strong>
                  {localDestino}
                </strong>
              </div>

              <div>
                <span>Total de itens</span>

                <strong>
                  {itensSelecionados.length}
                </strong>
              </div>
            </div>

            <div className="pagar-material-selected">
              <h3>Materiais selecionados</h3>

              {itensSelecionados.length === 0 ? (
                <div className="pagar-material-empty">
                  Nenhum material adicionado.
                </div>
              ) : (
                itensSelecionados.map((material) => (
                  <article
                    key={material.id}
                    className="pagar-material-selected-item"
                  >
                    <div>
                      <strong>
                        {material.patrimonio}
                      </strong>

                      <span>
                        {material.descricao}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removerMaterial(material.id)
                      }
                    >
                      ×
                    </button>
                  </article>
                ))
              )}
            </div>

            <div className="pagar-material-actions">
              <button
                type="button"
                className="pagar-material-cancel"
                onClick={limparMovimentacao}
              >
                Limpar
              </button>

              <button
                type="button"
                className="pagar-material-confirm"
                onClick={confirmarEntrega}
              >
                Confirmar entrega
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}