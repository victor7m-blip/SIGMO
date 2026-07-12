import { useEffect, useState } from 'react'

import {
  listarHistoricoPatrimonio,
} from '../../../../services/movimentacoesService'

import './PatrimonioMovimentacoes.css'

function TimelineIcon({ tipo }) {
  const tipoNormalizado = String(tipo || '').toUpperCase()

  if (tipoNormalizado.includes('STATUS')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }

  if (
    tipoNormalizado.includes('LOCAL') ||
    tipoNormalizado.includes('TRANSFER') ||
    tipoNormalizado.includes('MOVIMENT')
  ) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11z" />
        <circle cx="12" cy="10" r="2" />
      </svg>
    )
  }

  if (tipoNormalizado.includes('FOTO')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M21 15l-5-5L5 19" />
      </svg>
    )
  }

  if (tipoNormalizado.includes('QR')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" />
        <rect x="15" y="3" width="6" height="6" />
        <rect x="3" y="15" width="6" height="6" />
        <path d="M15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" />
      </svg>
    )
  }

  if (
    tipoNormalizado.includes('ETIQUETA') ||
    tipoNormalizado.includes('IMPRESS')
  ) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" />
      </svg>
    )
  }

  if (
    tipoNormalizado.includes('CADASTR') ||
    tipoNormalizado.includes('CRIAD')
  ) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function obterTipo(mov) {
  return (
    mov.tipo_movimentacao ||
    mov.tipo_evento ||
    mov.tipo ||
    mov.acao ||
    'MOVIMENTAÇÃO'
  )
}

function obterUsuario(mov) {
  return (
    mov.usuario_nome ||
    mov.nome_usuario ||
    mov.autor_nome ||
    mov.responsavel_nome ||
    mov.solicitante_nome ||
    mov.created_by_nome ||
    mov.usuario ||
    'Sistema'
  )
}

function obterValorAnterior(mov) {
  return (
    mov.valor_anterior ??
    mov.de ??
    mov.origem_local ??
    mov.status_anterior ??
    mov.local_anterior ??
    null
  )
}

function obterValorNovo(mov) {
  return (
    mov.valor_novo ??
    mov.para ??
    mov.destino_local ??
    mov.status_novo ??
    mov.novo_status ??
    mov.novo_local ??
    mov.status ??
    null
  )
}

function formatarData(data) {
  if (!data) return 'Data não informada'

  const valor = new Date(data)

  if (Number.isNaN(valor.getTime())) {
    return 'Data não informada'
  }

  return valor.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function criarDescricao(mov) {
  const tipo = String(obterTipo(mov)).toUpperCase()
  const usuario = obterUsuario(mov)
  const anterior = obterValorAnterior(mov)
  const novo = obterValorNovo(mov)

  if (tipo.includes('STATUS')) {
    if (anterior && novo && anterior !== novo) {
      return (
        <>
          <strong>{usuario}</strong> alterou o status de{' '}
          <span className="patrimonio-mov-value patrimonio-mov-value-old">
            {anterior}
          </span>

          <span className="patrimonio-mov-arrow">→</span>

          <span className="patrimonio-mov-value patrimonio-mov-value-new">
            {novo}
          </span>
        </>
      )
    }

    return (
      <>
        <strong>{usuario}</strong> alterou o status para{' '}
        <span className="patrimonio-mov-value patrimonio-mov-value-new">
          {novo || 'não informado'}
        </span>
      </>
    )
  }

  if (
    tipo.includes('LOCAL') ||
    tipo.includes('TRANSFER') ||
    tipo.includes('MOVIMENT')
  ) {
    if (anterior && novo && anterior !== novo) {
      return (
        <>
          <strong>{usuario}</strong> alterou o local de{' '}
          <span className="patrimonio-mov-value patrimonio-mov-value-old">
            {anterior}
          </span>

          <span className="patrimonio-mov-arrow">→</span>

          <span className="patrimonio-mov-value patrimonio-mov-value-new">
            {novo}
          </span>
        </>
      )
    }

    return (
      <>
        <strong>{usuario}</strong> registrou uma movimentação patrimonial
      </>
    )
  }

  if (tipo.includes('FOTO')) {
    return (
      <>
        <strong>{usuario}</strong> adicionou uma foto
      </>
    )
  }

  if (tipo.includes('QR')) {
    return (
      <>
        <strong>{usuario}</strong> gerou o QR Code
      </>
    )
  }

  if (
    tipo.includes('ETIQUETA') ||
    tipo.includes('IMPRESS')
  ) {
    return (
      <>
        <strong>{usuario}</strong> imprimiu a etiqueta patrimonial
      </>
    )
  }

  if (
    tipo.includes('CADASTR') ||
    tipo.includes('CRIAD')
  ) {
    return (
      <>
        <strong>{usuario}</strong> cadastrou o patrimônio
      </>
    )
  }

  return (
    <>
      <strong>{usuario}</strong> registrou uma movimentação
    </>
  )
}

function obterClasseTipo(mov) {
  const tipo = String(obterTipo(mov)).toUpperCase()

  if (tipo.includes('STATUS')) return 'status'
  if (tipo.includes('FOTO')) return 'foto'
  if (tipo.includes('QR')) return 'qrcode'

  if (
    tipo.includes('ETIQUETA') ||
    tipo.includes('IMPRESS')
  ) {
    return 'etiqueta'
  }

  if (
    tipo.includes('LOCAL') ||
    tipo.includes('TRANSFER') ||
    tipo.includes('MOVIMENT')
  ) {
    return 'local'
  }

  if (
    tipo.includes('CADASTR') ||
    tipo.includes('CRIAD')
  ) {
    return 'cadastro'
  }

  return 'padrao'
}

function obterDetalhes(mov) {
  const detalhes = []

  if (mov.solicitante_nome) {
    detalhes.push({
      label: 'Solicitante',
      valor: mov.solicitante_nome,
    })
  }

  if (mov.recebedor_nome) {
    detalhes.push({
      label: 'Recebedor',
      valor: mov.recebedor_nome,
    })
  }

  if (mov.documento) {
    detalhes.push({
      label: 'Documento',
      valor: mov.documento,
    })
  }

  return detalhes
}

export default function PatrimonioMovimentacoes({ item }) {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!item?.id) {
        setHistorico([])
        return
      }

      try {
        setLoading(true)
        setErro('')

        const dados = await listarHistoricoPatrimonio(item.id)

        if (ativo) {
          setHistorico(Array.isArray(dados) ? dados : [])
        }
      } catch (error) {
        console.error(error)

        if (ativo) {
          setErro('Erro ao carregar movimentações.')
          setHistorico([])
        }
      } finally {
        if (ativo) {
          setLoading(false)
        }
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [item?.id])

  return (
    <section className="patrimonio-section patrimonio-mov-section">
      <header className="patrimonio-section-header">
        <div>
          <h3>Movimentações</h3>
          <p>Histórico completo deste patrimônio.</p>
        </div>

        {!loading && !erro && historico.length > 0 && (
          <span className="patrimonio-mov-count">
            {historico.length}{' '}
            {historico.length === 1 ? 'evento' : 'eventos'}
          </span>
        )}
      </header>

      {loading && (
        <div className="patrimonio-mov-state">
          <span className="patrimonio-mov-spinner" />
          Carregando movimentações...
        </div>
      )}

      {!loading && erro && (
        <div className="patrimonio-mov-state patrimonio-mov-state-error">
          {erro}
        </div>
      )}

      {!loading && !erro && historico.length === 0 && (
        <div className="patrimonio-mov-state patrimonio-mov-state-empty">
          Nenhuma movimentação encontrada.
        </div>
      )}

      {!loading && !erro && historico.length > 0 && (
        <div className="patrimonio-timeline">
          {historico.map((mov, index) => {
            const tipo = obterTipo(mov)
            const classeTipo = obterClasseTipo(mov)
            const detalhes = obterDetalhes(mov)

            return (
              <article
                key={mov.id || `${tipo}-${mov.created_at}-${index}`}
                className={`patrimonio-timeline-item patrimonio-timeline-item-${classeTipo}`}
              >
                <div className="patrimonio-timeline-rail">
                  <span className="patrimonio-timeline-icon">
                    <TimelineIcon tipo={tipo} />
                  </span>

                  {index < historico.length - 1 && (
                    <span className="patrimonio-timeline-line" />
                  )}
                </div>

                <div className="patrimonio-timeline-content">
                  <div className="patrimonio-timeline-top">
                    <span className="patrimonio-mov-type">
                      {tipo}
                    </span>

                    <time dateTime={mov.created_at || undefined}>
                      {formatarData(mov.created_at)}
                    </time>
                  </div>

                  <div className="patrimonio-timeline-description">
                    {criarDescricao(mov)}
                  </div>

                  {detalhes.length > 0 && (
                    <div className="patrimonio-timeline-details">
                      {detalhes.map((detalhe) => (
                        <div key={detalhe.label}>
                          <small>{detalhe.label}</small>
                          <strong>{detalhe.valor}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {mov.observacoes && (
                    <div className="patrimonio-timeline-note">
                      {mov.observacoes}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}