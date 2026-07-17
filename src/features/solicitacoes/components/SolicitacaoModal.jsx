import {
  useEffect,
  useMemo,
  useState
} from 'react'

import StatusBadge from './StatusBadge'

const CAMPOS = {
  nome: 'Nome completo',
  nome_guerra: 'Nome de guerra',
  re: 'RE',
  posto_graduacao: 'Posto/Graduação',
  companhia: 'Companhia',
  pelotao: 'Pelotão',
  equipe: 'Equipe',
  funcao: 'Função',
  telefone: 'Telefone',
  email: 'E-mail',
  cpf: 'CPF',
  rg: 'RG',
  perfil: 'Perfil',
  situacao: 'Situação',
  observacoes: 'Observações',
  foto_url: 'Foto',
  qr_code: 'QR Code'
}

function formatarDataHora(valor) {
  if (!valor) {
    return 'Não informado'
  }

  const data = new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
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

function formatarCampo(campo) {
  return (
    CAMPOS[campo] ||
    String(campo || '')
      .replace(/_/g, ' ')
      .replace(
        /(^|\s)\S/g,
        (letra) =>
          letra.toUpperCase()
      )
  )
}

function valorTexto(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 'Não informado'
  }

  if (
    typeof valor === 'boolean'
  ) {
    return valor
      ? 'Sim'
      : 'Não'
  }

  if (
    typeof valor === 'object'
  ) {
    try {
      return JSON.stringify(
        valor,
        null,
        2
      )
    } catch {
      return String(valor)
    }
  }

  return String(valor)
}

function obterAlteracoes(
  solicitacao
) {
  if (
    Array.isArray(
      solicitacao?.alteracoes
    )
  ) {
    return solicitacao.alteracoes.map(
      (item) => ({
        campo:
          item.campo,
        label:
          item.label ||
          formatarCampo(
            item.campo
          ),
        anterior:
          item.anterior,
        novo:
          item.novo
      })
    )
  }

  const anteriores =
    solicitacao?.dados_atuais ||
    solicitacao?.dados_anteriores ||
    {}

  const novos =
    solicitacao?.dados_solicitados ||
    solicitacao?.dados_novos ||
    {}

  const campos = Array.from(
    new Set([
      ...Object.keys(anteriores),
      ...Object.keys(novos)
    ])
  )

  return campos
    .filter(
      (campo) =>
        JSON.stringify(
          anteriores[campo]
        ) !==
        JSON.stringify(
          novos[campo]
        )
    )
    .map(
      (campo) => ({
        campo,
        label:
          formatarCampo(campo),
        anterior:
          anteriores[campo],
        novo:
          novos[campo]
      })
    )
}

function obterTitulo(
  solicitacao
) {
  return (
    solicitacao?.titulo ||
    'Solicitação'
  )
}

function obterSolicitante(
  solicitacao
) {
  return (
    solicitacao?.solicitante_nome ||
    solicitacao?.policial_nome ||
    solicitacao?.solicitante
      ?.nome_guerra ||
    solicitacao?.solicitante
      ?.nome ||
    'Não informado'
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

  const status =
    String(
      solicitacao.status || ''
    ).toUpperCase()

  const podeAnalisar =
    status === 'PENDENTE' ||
    status === 'EM_ANALISE'

  async function aprovar() {
    await onAprovar(
      solicitacao.id
    )
  }

  async function reprovar() {
    const motivoLimpo =
      motivo.trim()

    if (!motivoLimpo) {
      return
    }

    await onReprovar(
      motivoLimpo
    )
  }

  return (
    <div className="solicitacao-modal-overlay">
      <section className="solicitacao-modal">
        <header className="solicitacao-modal-header">
          <div>
            <span>
              SOLICITAÇÃO
            </span>

            <h2>
              {obterTitulo(
                solicitacao
              )}
            </h2>

            <p>
              Protocolo{' '}
              <strong>
                {solicitacao.protocolo ||
                  'Não informado'}
              </strong>
            </p>
          </div>

          <button
            type="button"
            className="solicitacao-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
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
            {solicitacao.tipo ||
              'OUTRA'}
          </strong>

          <span>
            Solicitante:{' '}
            {obterSolicitante(
              solicitacao
            )}
          </span>

          <span>
            Data:{' '}
            {formatarDataHora(
              solicitacao.created_at ||
              solicitacao.criado_em
            )}
          </span>
        </div>

        <section className="solicitacao-comparacoes">
          {alteracoes.length === 0 ? (
            <div className="solicitacao-feedback">
              Nenhuma alteração encontrada para esta solicitação.
            </div>
          ) : (
            alteracoes.map(
              (
                alteracao,
                index
              ) => (
                <article
                  key={`${alteracao.campo}-${index}`}
                  className="solicitacao-comparacao"
                >
                  <h3>
                    {alteracao.label}
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

        {podeAnalisar && (
          <section className="solicitacao-reprovacao">
            <label>
              Motivo da reprovação

              <textarea
                rows={5}
                value={motivo}
                onChange={
                  (event) =>
                    setMotivo(
                      event.target.value
                    )
                }
                placeholder="Informe o motivo da reprovação..."
                disabled={loading}
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

          {podeAnalisar && (
            <>
              <button
                type="button"
                className="solicitacao-btn-reprovar"
                disabled={
                  loading ||
                  !motivo.trim()
                }
                onClick={reprovar}
              >
                {loading
                  ? 'Processando...'
                  : 'Reprovar'}
              </button>

              <button
                type="button"
                className="solicitacao-btn-aprovar"
                disabled={loading}
                onClick={aprovar}
              >
                {loading
                  ? 'Processando...'
                  : 'Aprovar'}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  )
}