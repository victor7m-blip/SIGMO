const STATUS_CONFIG = {
  aguardando_aprovacao: {
    label: 'Aguardando aprovação',
    classe: 'warning'
  },

  aguardando_recebimento: {
    label: 'Aguardando recebimento',
    classe: 'info'
  },

  alteracao_solicitada: {
    label: 'Alteração solicitada',
    classe: 'orange'
  },

  finalizada: {
    label: 'Finalizada',
    classe: 'success'
  },

  recusada: {
    label: 'Recusada',
    classe: 'danger'
  },

  cancelada: {
    label: 'Cancelada',
    classe: 'danger'
  }
}

const TIPOS_CONFIG = {
  transferencia: {
    label: 'Transferência',
    sigla: 'TR',
    classe: 'blue'
  },

  recebimento: {
    label: 'Recebimento',
    sigla: 'RE',
    classe: 'green'
  },

  baixa: {
    label: 'Baixa',
    sigla: 'BX',
    classe: 'red'
  },

  cautela: {
    label: 'Cautela',
    sigla: 'CT',
    classe: 'yellow'
  },

  devolucao: {
    label: 'Devolução',
    sigla: 'DV',
    classe: 'cyan'
  },

  recolhimento: {
    label: 'Recolhimento',
    sigla: 'RC',
    classe: 'orange'
  }
}

function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatarData(valor) {
  if (!valor) {
    return {
      data: 'Sem data',
      hora: ''
    }
  }

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return {
      data: 'Data inválida',
      hora: ''
    }
  }

  return {
    data: new Intl.DateTimeFormat(
      'pt-BR',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    ).format(data),

    hora: new Intl.DateTimeFormat(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(data)
  }
}

function obterTipo(movimentacao) {
  const chave = normalizar(
    movimentacao.tipo_movimentacao ||
    movimentacao.tipo
  )

  return (
    TIPOS_CONFIG[chave] || {
      label:
        movimentacao.tipo_movimentacao ||
        movimentacao.tipo ||
        'Movimentação',

      sigla: 'MV',
      classe: 'blue'
    }
  )
}

function obterStatus(status) {
  const chave = normalizar(status)
    .replace(/\s+/g, '_')

  return (
    STATUS_CONFIG[chave] || {
      label:
        String(status ?? '')
          .replace(/_/g, ' ') ||
        'Sem status',

      classe: 'neutral'
    }
  )
}

function obterQuantidadeItens(
  movimentacao
) {
  if (
    Array.isArray(movimentacao.itens)
  ) {
    return movimentacao.itens.length
  }

  return (
    Number(
      movimentacao.quantidade_itens
    ) || 0
  )
}

function obterNomeSolicitante(
  movimentacao
) {
  return (
    movimentacao.solicitante_nome ||
    movimentacao.criado_por_nome ||
    movimentacao.usuario_nome ||
    movimentacao.solicitante_re ||
    'SISTEMA'
  )
}

function obterRecebedor(
  movimentacao
) {
  return (
    movimentacao.recebedor_nome ||
    movimentacao.recebedor_re ||
    'NÃO INFORMADO'
  )
}

function obterLocal(
  movimentacao,
  tipo
) {
  if (tipo === 'origem') {
    return (
      movimentacao.origem_local ||
      movimentacao.local_origem ||
      movimentacao.origem_unidade ||
      'NÃO INFORMADO'
    )
  }

  return (
    movimentacao.destino_local ||
    movimentacao.local_destino ||
    movimentacao.destino_unidade ||
    'NÃO INFORMADO'
  )
}

function obterGrupoData(valor) {
  if (!valor) {
    return 'SEM DATA'
  }

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return 'SEM DATA'
  }

  const hoje = new Date()
  const inicioHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )

  const inicioEvento = new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate()
  )

  const diferencaDias = Math.floor(
    (
      inicioHoje.getTime() -
      inicioEvento.getTime()
    ) /
    86400000
  )

  if (diferencaDias === 0) {
    return 'HOJE'
  }

  if (diferencaDias === 1) {
    return 'ONTEM'
  }

  if (diferencaDias <= 7) {
    return 'ESTA SEMANA'
  }

  if (diferencaDias <= 30) {
    return 'ESTE MÊS'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      month: 'long',
      year: 'numeric'
    }
  )
    .format(data)
    .toUpperCase()
}

function agruparMovimentacoes(
  movimentacoes
) {
  return movimentacoes.reduce(
    (grupos, movimentacao) => {
      const grupo = obterGrupoData(
        movimentacao.created_at
      )

      if (!grupos[grupo]) {
        grupos[grupo] = []
      }

      grupos[grupo].push(
        movimentacao
      )

      return grupos
    },
    {}
  )
}

function BotaoAcao({
  children,
  classe = '',
  onClick,
  disabled
}) {
  return (
    <button
      type="button"
      className={`movimentacao-action-btn ${classe}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function AcoesMovimentacao({
  movimentacao,
  processando,
  onAprovar,
  onRecusar,
  onReceber,
  onCancelar
}) {
  const status =
    movimentacao.status

  const encerrada = [
    'finalizada',
    'cancelada',
    'recusada'
  ].includes(status)

  if (encerrada) {
    return (
      <span className="movimentacao-sem-acoes">
        Fluxo encerrado
      </span>
    )
  }

  return (
    <div className="movimentacao-timeline-actions">
      {status ===
        'aguardando_aprovacao' && (
        <>
          <BotaoAcao
            classe="movimentacao-action-success"
            onClick={() =>
              onAprovar(movimentacao)
            }
            disabled={processando}
          >
            Aprovar
          </BotaoAcao>

          <BotaoAcao
            classe="movimentacao-action-danger"
            onClick={() =>
              onRecusar(movimentacao)
            }
            disabled={processando}
          >
            Recusar
          </BotaoAcao>
        </>
      )}

      {status ===
        'aguardando_recebimento' && (
        <BotaoAcao
          classe="movimentacao-action-primary"
          onClick={() =>
            onReceber(movimentacao)
          }
          disabled={processando}
        >
          Confirmar recebimento
        </BotaoAcao>
      )}

      <BotaoAcao
        onClick={() =>
          onCancelar(movimentacao)
        }
        disabled={processando}
      >
        Cancelar
      </BotaoAcao>
    </div>
  )
}

export default function MovimentacaoTable({
  movimentacoes = [],
  loading,
  processandoId,
  onAprovar,
  onRecusar,
  onReceber,
  onCancelar
}) {
  if (loading) {
    return (
      <div className="movimentacoes-state">
        <span className="movimentacoes-spinner" />
        Carregando movimentações...
      </div>
    )
  }

  if (!movimentacoes.length) {
    return (
      <div className="movimentacoes-state">
        Nenhuma movimentação encontrada.
      </div>
    )
  }

  const grupos =
    agruparMovimentacoes(
      movimentacoes
    )

  return (
    <section className="movimentacao-timeline">
      {Object.entries(grupos).map(
        ([grupo, itens]) => (
          <div
            className="movimentacao-timeline-group"
            key={grupo}
          >
            <div className="movimentacao-timeline-group-header">
              <span>{grupo}</span>

              <strong>
                {itens.length}{' '}
                {itens.length === 1
                  ? 'movimentação'
                  : 'movimentações'}
              </strong>
            </div>

            <div className="movimentacao-timeline-list">
              {itens.map(
                (movimentacao) => {
                  const tipo =
                    obterTipo(
                      movimentacao
                    )

                  const status =
                    obterStatus(
                      movimentacao.status
                    )

                  const data =
                    formatarData(
                      movimentacao.created_at
                    )

                  const processando =
                    processandoId ===
                    movimentacao.id

                  return (
                    <article
                      className="movimentacao-timeline-item"
                      key={movimentacao.id}
                    >
                      <div
                        className={`movimentacao-timeline-marker movimentacao-marker-${tipo.classe}`}
                      >
                        {tipo.sigla}
                      </div>

                      <div className="movimentacao-timeline-line" />

                      <div className="movimentacao-timeline-card">
                        <header className="movimentacao-card-header">
                          <div>
                            <div className="movimentacao-card-title">
                              <strong>
                                {tipo.label}
                              </strong>

                              <span
                                className={`movimentacao-status movimentacao-status-${status.classe}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            <p>
                              Registrada por{' '}
                              <strong>
                                {obterNomeSolicitante(
                                  movimentacao
                                )}
                              </strong>
                            </p>
                          </div>

                          <time>
                            <strong>
                              {data.data}
                            </strong>

                            <span>
                              {data.hora}
                            </span>
                          </time>
                        </header>

                        <div className="movimentacao-route">
                          <div>
                            <span>Origem</span>
                            <strong>
                              {obterLocal(
                                movimentacao,
                                'origem'
                              )}
                            </strong>
                          </div>

                          <span className="movimentacao-route-arrow">
                            →
                          </span>

                          <div>
                            <span>Destino</span>
                            <strong>
                              {obterLocal(
                                movimentacao,
                                'destino'
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="movimentacao-card-details">
                          <div>
                            <span>Recebedor</span>
                            <strong>
                              {obterRecebedor(
                                movimentacao
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Itens</span>
                            <strong>
                              {obterQuantidadeItens(
                                movimentacao
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Identificação</span>
                            <strong>
                              {String(
                                movimentacao.id
                              ).slice(0, 8)}
                            </strong>
                          </div>
                        </div>

                        {movimentacao.observacao && (
                          <div className="movimentacao-observacao">
                            <span>Observação</span>

                            <p>
                              {
                                movimentacao.observacao
                              }
                            </p>
                          </div>
                        )}

                        <footer className="movimentacao-card-footer">
                          {processando && (
                            <span className="movimentacao-processando">
                              Processando...
                            </span>
                          )}

                          <AcoesMovimentacao
                            movimentacao={
                              movimentacao
                            }
                            processando={
                              processando
                            }
                            onAprovar={
                              onAprovar
                            }
                            onRecusar={
                              onRecusar
                            }
                            onReceber={
                              onReceber
                            }
                            onCancelar={
                              onCancelar
                            }
                          />
                        </footer>
                      </div>
                    </article>
                  )
                }
              )}
            </div>
          </div>
        )
      )}
    </section>
  )
}