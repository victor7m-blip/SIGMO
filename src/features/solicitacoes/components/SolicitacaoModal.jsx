import { useEffect, useMemo, useState } from 'react'

import StatusBadge from './StatusBadge'

function formatarDataHora(valor) {
  if (!valor) {
    return 'Não informado'
  }

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return 'Não informado'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(data)
}

function valorTexto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return '—'
  }

  if (typeof valor === 'boolean') {
    return valor ? 'Sim' : 'Não'
  }

  return String(valor)
}

function obterAlteracoes(solicitacao) {
  if (
    Array.isArray(
      solicitacao?.alteracoes
    )
  ) {
    return solicitacao.alteracoes
  }

  const antigos =
    solicitacao?.dados_anteriores ||
    {}

  const novos =
    solicitacao?.dados_novos ||
    {}

  return Object.keys(novos).map(
    (campo) => ({
      campo,
      anterior:
        antigos[campo],
      novo:
        novos[campo]
    })
  )
}

export default function SolicitacaoModal({
  open,
  solicitacao,
  loading,
  onClose,
  onAprovar,
  onReprovar
}) {
  const [
    motivo,
    setMotivo
  ] = useState('')

  useEffect(() => {
    if (!open) {
      setMotivo('')
    }
  }, [open])

  const alteracoes =
    useMemo(
      () =>
        obterAlteracoes(
          solicitacao
        ),
      [solicitacao]
    )

  if (
    !open ||
    !solicitacao
  ) {
    return null
  }

  const podeAprovar =
    solicitacao.status ===
      'PENDENTE' ||
    solicitacao.status ===
      'EM_ANALISE'

  async function aprovar() {
    await onAprovar(
      solicitacao.id
    )
  }

  async function reprovar() {
    await onReprovar(
      solicitacao.id,
      {
        motivo
      }
    )
  }

  return (
    <div className="solicitacao-modal-overlay">

      <div className="solicitacao-modal">

        <header className="solicitacao-modal-header">

          <div>

            <span>

              SOLICITAÇÃO

            </span>

            <h2>

              {
                solicitacao.titulo
              }

            </h2>

            <p>

              Protocolo{' '}

              <strong>

                {
                  solicitacao.protocolo
                }

              </strong>

            </p>

          </div>

          <button
            type="button"
            className="solicitacao-modal-close"
            onClick={onClose}
          >
            ×
          </button>

        </header>

        <div className="solicitacao-modal-status-row">

          <StatusBadge
            status={
              solicitacao.status
            }
          />

          <strong>

            {
              solicitacao.tipo
            }

          </strong>

          <span>

            Solicitante:

            {' '}

            {
              solicitacao.solicitante_nome
            }

          </span>

          <span>

            Data:

            {' '}

            {
              formatarDataHora(
                solicitacao.created_at
              )
            }

          </span>

        </div>

        <section className="solicitacao-comparacoes">
                  {alteracoes.length === 0 && (

            <div className="solicitacao-feedback">

              Nenhuma alteração encontrada para esta solicitação.

            </div>

          )}

          {alteracoes.map(
            (alteracao, index) => (

              <article
                key={`${alteracao.campo}-${index}`}
                className="solicitacao-comparacao"
              >

                <h3>

                  {alteracao.campo}

                </h3>

                <div className="solicitacao-valores">

                  <div className="solicitacao-valor solicitacao-valor-anterior">

                    <span>

                      VALOR ATUAL

                    </span>

                    <strong>

                      {valorTexto(
                        alteracao.anterior
                      )}

                    </strong>

                  </div>

                  <div className="solicitacao-seta">

                    →

                  </div>

                  <div className="solicitacao-valor solicitacao-valor-novo">

                    <span>

                      NOVO VALOR

                    </span>

                    <strong>

                      {valorTexto(
                        alteracao.novo
                      )}

                    </strong>

                  </div>

                </div>

              </article>

            )
          )}

        </section>

        {solicitacao.descricao && (

          <section className="solicitacao-observacao">

            <span>

              DESCRIÇÃO

            </span>

            <p>

              {solicitacao.descricao}

            </p>

          </section>

        )}

        {podeAprovar && (

          <section className="solicitacao-reprovacao">

            <label>

              Motivo da reprovação

              <textarea
                rows={5}
                value={motivo}
                onChange={(e) =>
                  setMotivo(
                    e.target.value
                  )
                }
                placeholder="Informe o motivo da reprovação (obrigatório somente ao reprovar)..."
              />

            </label>

          </section>

        )}

        <footer className="solicitacao-modal-actions">

          <button
            type="button"
            className="solicitacao-btn-visualizar"
            onClick={onClose}
            disabled={loading}
          >

            Fechar

          </button>

          {podeAprovar && (

            <>

              <button
                type="button"
                className="solicitacao-btn-reprovar"
                disabled={loading}
                onClick={reprovar}
              >

                Reprovar

              </button>

              <button
                type="button"
                className="solicitacao-btn-aprovar"
                disabled={loading}
                onClick={aprovar}
              >

                Aprovar

              </button>

            </>

          )}
                  </footer>

      </div>

    </div>
  )
}