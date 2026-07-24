import { useEffect, useMemo, useState } from 'react'
import { buscarHistoricoPatrimonial } from '../../services/patrimonioHistoricoService'
import './HistoricoPatrimonial.css'

function numero(valor) {
  const n = Number(valor)

  if (!Number.isFinite(n)) return '0'

  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3
  }).format(n)
}

function dataHora(valor) {
  if (!valor) return '—'

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function texto(valor, fallback = '—') {
  const resultado = String(valor ?? '').trim()
  return resultado || fallback
}

function nomeItem(registro) {
  return texto(registro?.item?.nome || registro?.item?.categoria, 'Patrimônio')
}

function classeMovimentacao(tipo) {
  const valor = String(tipo || '').toUpperCase()

  if (valor.includes('RECEB')) return 'entrada'
  if (valor.includes('DEVOL')) return 'entrada'
  if (valor.includes('BAIXA')) return 'saida'
  if (valor.includes('CAUTELA')) return 'alerta'
  if (valor.includes('TRANSFER')) return 'transferencia'

  return 'neutra'
}

export default function HistoricoPatrimonial({
  aberto,
  onClose,
  codigos = ['TONFA-PADRAO', 'CASSETETE-PADRAO'],
  titulo = 'Histórico patrimonial'
}) {
  const [dados, setDados] = useState({
    itens: [],
    lotes: [],
    movimentacoes: [],
    saldos: [],
    saldoTotal: 0
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [filtroItem, setFiltroItem] = useState('TODOS')

  useEffect(() => {
    if (!aberto) return

    let ativo = true

    async function carregar() {
      try {
        setLoading(true)
        setErro('')

        const resultado = await buscarHistoricoPatrimonial({ codigos })

        if (ativo) setDados(resultado)
      } catch (error) {
        console.error('Erro ao carregar histórico patrimonial:', error)

        if (ativo) {
          setErro(error.message || 'Erro ao carregar o histórico patrimonial.')
        }
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [aberto, codigos])

  useEffect(() => {
    if (!aberto) return undefined

    function fecharComEscape(event) {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', fecharComEscape)
    return () => document.removeEventListener('keydown', fecharComEscape)
  }, [aberto, onClose])

  const itemSelecionado = useMemo(() => {
    if (filtroItem === 'TODOS') return null
    return dados.itens.find((item) => item.id === filtroItem) || null
  }, [dados.itens, filtroItem])

  const lotes = useMemo(
    () =>
      itemSelecionado
        ? dados.lotes.filter((lote) => lote.item_id === itemSelecionado.id)
        : dados.lotes,
    [dados.lotes, itemSelecionado]
  )

  const movimentacoes = useMemo(
    () =>
      itemSelecionado
        ? dados.movimentacoes.filter(
            (movimentacao) => movimentacao.item_id === itemSelecionado.id
          )
        : dados.movimentacoes,
    [dados.movimentacoes, itemSelecionado]
  )

  const saldos = useMemo(
    () =>
      itemSelecionado
        ? dados.saldos.filter((saldo) => saldo.item_id === itemSelecionado.id)
        : dados.saldos,
    [dados.saldos, itemSelecionado]
  )

  const saldoAtual = useMemo(
    () => saldos.reduce((total, saldo) => total + Number(saldo.quantidade || 0), 0),
    [saldos]
  )

  if (!aberto) return null

  return (
    <div className="historico-patrimonial-backdrop" onMouseDown={onClose}>
      <section
        className="historico-patrimonial-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="historico-patrimonial-header">
          <div>
            <span>Patrimônio Engine</span>
            <h2>{titulo}</h2>
            <p>Lotes recebidos e movimentações registradas separadamente.</p>
          </div>

          <button type="button" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="historico-patrimonial-toolbar">
          <label>
            <span>Material</span>
            <select
              value={filtroItem}
              onChange={(event) => setFiltroItem(event.target.value)}
            >
              <option value="TODOS">Todos</option>
              {dados.itens.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setFiltroItem('TODOS')}
            disabled={filtroItem === 'TODOS'}
          >
            Limpar filtro
          </button>
        </div>

        <div className="historico-patrimonial-conteudo">
          {loading && (
            <div className="historico-patrimonial-estado">
              Carregando histórico patrimonial...
            </div>
          )}

          {!loading && erro && (
            <div className="historico-patrimonial-estado historico-patrimonial-erro">
              {erro}
            </div>
          )}

          {!loading && !erro && (
            <>
              <section className="historico-patrimonial-resumo">
                <div>
                  <span>Saldo atual</span>
                  <strong>{numero(saldoAtual)}</strong>
                  <small>Unidades consolidadas na Engine</small>
                </div>

                <div>
                  <span>Lotes registrados</span>
                  <strong>{lotes.length}</strong>
                  <small>Cada recebimento permanece individualizado</small>
                </div>

                <div>
                  <span>Movimentações</span>
                  <strong>{movimentacoes.length}</strong>
                  <small>Histórico operacional completo</small>
                </div>
              </section>

              <section className="historico-patrimonial-section">
                <div className="historico-patrimonial-section-title">
                  <div>
                    <span>Entradas físicas</span>
                    <h3>Lotes recebidos</h3>
                  </div>
                  <strong>{lotes.length}</strong>
                </div>

                {lotes.length === 0 ? (
                  <div className="historico-patrimonial-vazio">
                    Nenhum lote registrado para este material.
                  </div>
                ) : (
                  <div className="historico-patrimonial-lotes">
                    {lotes.map((lote) => (
                      <article key={lote.id} className="historico-patrimonial-lote">
                        <div className="historico-patrimonial-lote-topo">
                          <div>
                            <span>{nomeItem(lote)}</span>
                            <h4>{texto(lote.codigo_lote, 'Lote sem código')}</h4>
                          </div>
                          <strong>+{numero(lote.quantidade_inicial)}</strong>
                        </div>

                        <dl>
                          <div>
                            <dt>Recebido em</dt>
                            <dd>{dataHora(lote.criado_em)}</dd>
                          </div>
                          <div>
                            <dt>Natureza</dt>
                            <dd>{texto(lote.natureza)}</dd>
                          </div>
                          <div>
                            <dt>Origem</dt>
                            <dd>{texto(lote.origem_nome)}</dd>
                          </div>
                          <div>
                            <dt>Saldo do lote</dt>
                            <dd>{numero(lote.quantidade_atual)}</dd>
                          </div>
                        </dl>

                        {lote.observacoes && (
                          <p className="historico-patrimonial-observacao">
                            {lote.observacoes}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="historico-patrimonial-section">
                <div className="historico-patrimonial-section-title">
                  <div>
                    <span>Rastreabilidade</span>
                    <h3>Movimentações</h3>
                  </div>
                  <strong>{movimentacoes.length}</strong>
                </div>

                {movimentacoes.length === 0 ? (
                  <div className="historico-patrimonial-vazio">
                    Nenhuma movimentação registrada para este material.
                  </div>
                ) : (
                  <div className="historico-patrimonial-timeline">
                    {movimentacoes.map((movimentacao) => (
                      <article
                        key={movimentacao.id}
                        className={`historico-patrimonial-movimento historico-patrimonial-${classeMovimentacao(
                          movimentacao.tipo_movimentacao
                        )}`}
                      >
                        <div className="historico-patrimonial-marcador" />

                        <div className="historico-patrimonial-movimento-conteudo">
                          <div className="historico-patrimonial-movimento-topo">
                            <div>
                              <span>{nomeItem(movimentacao)}</span>
                              <h4>{texto(movimentacao.tipo_movimentacao)}</h4>
                            </div>
                            <strong>{numero(movimentacao.quantidade)}</strong>
                          </div>

                          <div className="historico-patrimonial-meta">
                            <span>{dataHora(movimentacao.criado_em)}</span>
                            <span>{texto(movimentacao.protocolo, 'Sem protocolo')}</span>
                          </div>

                          {(movimentacao.origem_nome || movimentacao.destino_nome) && (
                            <p>
                              {texto(movimentacao.origem_nome, 'Origem não informada')}
                              {' → '}
                              {texto(movimentacao.destino_nome, 'Destino não informado')}
                            </p>
                          )}

                          {movimentacao.observacoes && (
                            <p className="historico-patrimonial-observacao">
                              {movimentacao.observacoes}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
